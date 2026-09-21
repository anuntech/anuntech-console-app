"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, companies, notificationPreferences } from "@/db/schema";
import { getActor } from "./access";
import type { ActionState } from "./action-state";
import { db } from "./db";
import { companyIdentity, companyEmail, companyPhone } from "./company-input";
import { companyBillingInput } from "./company-billing";
import { AccessChangeError, lockManagedCompany } from "./company-management";
import { preferenceKey } from "./notification-preferences";
const blocked = { error: "Você não tem permissão para realizar esta ação." };
function failure(error: unknown): ActionState {
  if (error instanceof z.ZodError) return { error: error.issues[0].message };
  if (error instanceof AccessChangeError) return blocked;
  const cause = (error as { cause?: { constraint?: string } })?.cause;
  if (cause?.constraint === "console_companies_document_unique")
    return { error: "Já existe uma empresa com este CPF/CNPJ." };
  return {
    error: "Não foi possível salvar. Confira os dados e tente novamente.",
  };
}
function refresh() {
  revalidatePath("/", "layout");
}
export async function saveCompanySettings(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = companyIdentity
      .extend({ id: z.string().uuid() })
      .parse(Object.fromEntries(form));
    const { billingAddress } = companyBillingInput(form);
    await db.transaction(async (tx) => {
      await lockManagedCompany(tx, actor, input.id);
      const [before] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, input.id));
      await tx
        .update(companies)
        .set({ ...input, billingAddress })
        .where(eq(companies.id, input.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: input.id,
        entityId: input.id,
        action: "company.updated",
        details: {
          source: "settings",
          document: { before: before.document, after: input.document },
        },
      });
    });
    refresh();
    return { success: "Dados da empresa atualizados." };
  } catch (error) {
    return failure(error);
  }
}
export async function saveNotificationPreferences(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  try {
    const companyId =
      z
        .union([z.string().uuid(), z.literal("")])
        .parse(form.get("companyId")) || null;
    const topic = z.enum(["billing", "tickets"]).parse(form.get("topic"));
    if (!companyId && (!actor.admin || topic !== "tickets")) return blocked;
    const emailEnabled = form.get("emailEnabled") === "yes";
    const whatsappEnabled = form.get("whatsappEnabled") === "yes";
    const emailRaw = String(form.get("email") || "").trim();
    const phoneRaw = String(form.get("phone") || "").trim();
    const email = emailRaw || emailEnabled ? companyEmail.parse(emailRaw) : "";
    const phone =
      phoneRaw || whatsappEnabled ? companyPhone.parse(phoneRaw) : "";
    const key = preferenceKey(companyId, topic);
    await db.transaction(async (tx) => {
      if (companyId) await lockManagedCompany(tx, actor, companyId);
      const values = {
        key,
        companyId,
        topic,
        email,
        phone,
        emailEnabled,
        whatsappEnabled,
        updatedAt: new Date(),
      };
      await tx
        .insert(notificationPreferences)
        .values(values)
        .onConflictDoUpdate({
          target: notificationPreferences.key,
          set: values,
        });
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId,
          entityId: key,
          action: "notifications.preferences_updated",
          details: { topic, emailEnabled, whatsappEnabled },
        });
    });
    refresh();
    return { success: "Preferências de notificações atualizadas." };
  } catch (error) {
    return failure(error);
  }
}
