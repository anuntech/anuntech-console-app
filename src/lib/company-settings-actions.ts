"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  auditEvents,
  companies,
  notificationPreferences,
  environmentProfile,
} from "@/db/schema";
import { getActor } from "./access";
import type { ActionState } from "./action-state";
import { db } from "./db";
import { lockTicketNotifications } from "./notification-settings";
import { companyIdentity, companyEmail, companyPhone } from "./company-input";
import { companyBillingInput } from "./company-billing";
import { AccessChangeError, lockManagedCompany } from "./company-management";
import {
  preferenceKey,
  lockCompanyNotifications,
} from "./notification-preferences";
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
      .extend({ id: z.union([z.string().uuid(), z.literal("console")]) })
      .parse(Object.fromEntries(form));
    if (actor.admin && input.id !== "console") return blocked;
    const { billingAddress } = companyBillingInput(form);
    await db.transaction(async (tx) => {
      if (input.id === "console") {
        if (!actor.admin) throw new AccessChangeError(blocked.error);
        const values = { ...input, billingAddress, updatedAt: new Date() };
        await tx
          .insert(environmentProfile)
          .values(values)
          .onConflictDoUpdate({ target: environmentProfile.id, set: values });
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          action: "environment.updated",
          entityId: "console",
        });
        return;
      }
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
    if (form.getAll("emails").length > 10 || form.getAll("phones").length > 10)
      return { error: "Cadastre até 10 e-mails e 10 telefones por assunto." };
    const readContacts = (
      name: string,
      legacy: string,
      schema: typeof companyEmail | typeof companyPhone,
    ) => {
      const raw = form.has(name) ? form.getAll(name) : form.getAll(legacy);
      if (raw.length > 10) throw new Error("Limite de contatos excedido");
      return [
        ...new Set(
          raw
            .map((value) => String(value).trim())
            .filter(Boolean)
            .map((value) => schema.parse(value)),
        ),
      ];
    };
    const emails = readContacts("emails", "email", companyEmail);
    const phones = readContacts("phones", "phone", companyPhone);
    if (emailEnabled && !emails.length)
      return { error: "Adicione um e-mail ou desative esse canal." };
    if (whatsappEnabled && !phones.length)
      return { error: "Adicione um telefone ou desative esse canal." };
    const email = emails[0] || "",
      phone = phones[0] || "";
    const key = preferenceKey(companyId, topic);
    await db.transaction(async (tx) => {
      if (companyId) {
        await lockCompanyNotifications(tx, companyId, true);
        await lockManagedCompany(tx, actor, companyId);
      }
      if (!companyId) await lockTicketNotifications(tx, true);
      const values = {
        key,
        companyId,
        topic,
        email,
        phone,
        emails,
        phones,
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
      await tx.insert(auditEvents).values({
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
