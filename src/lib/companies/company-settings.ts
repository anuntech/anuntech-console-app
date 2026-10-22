import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  auditEvents,
  companies,
  environmentProfile,
  notificationPreferences,
} from "@/db/schema";
import type { Actor } from "../access/access";
import type { ActionState } from "../action-state";
import { logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { billingProblemsLabel, billingReadiness } from "../billing/billing-readiness";
import { sendOpsMail } from "../notifications/ops-alerts";
import { lockTicketNotifications } from "../notifications/notification-settings";
import {
  lockCompanyNotifications,
  preferenceKey,
} from "../notifications/notification-preferences";
import { companyEmail, companyIdentity, companyPhone } from "./company-input";
import { addressLabel, parseCompanyAddress, type CompanyAddressFields } from "./company-billing";
import { AccessChangeError, lockManagedCompany } from "./company-management";

/*
 * Configurações → Dados da empresa and Notificações: the web's server actions
 * (company-settings-actions.ts) and the app's API call these with the actor.
 */

const blocked = { error: "Você não tem permissão para fazer isso." };

function failure(error: unknown): ActionState {
  if (error instanceof z.ZodError) return { error: error.issues[0].message };
  if (error instanceof AccessChangeError) return blocked;
  const cause = (error as { cause?: { constraint?: string } })?.cause;
  if (cause?.constraint === "console_companies_document_unique")
    return { error: "Já existe uma empresa com este CPF/CNPJ." };
  logDatabaseFault("company settings", error);
  return {
    error: "Não foi possível salvar. Confira os dados e tente novamente.",
  };
}

export type CompanySettingsInput = {
  /** The company's id, or "console" for the team's own issuer profile. */
  id: string;
  name: string;
  document: string;
  billingEmail: string;
  phone: string;
  /** Every field blank (or null) is no address. */
  address: CompanyAddressFields | null;
};

/**
 * Saves the registration a client's Administrador (or the team, for the
 * Anuntech profile) keeps in Configurações. The company is locked and the
 * manager grant re-checked inside the transaction.
 */
export async function updateCompanySettings(
  actor: Actor,
  raw: CompanySettingsInput,
): Promise<ActionState> {
  try {
    const input = companyIdentity
      .extend({ id: z.union([z.string().uuid(), z.literal("console")]) })
      .parse(raw);
    if (actor.admin && input.id !== "console") return blocked;
    const billingAddress = parseCompanyAddress(raw.address);
    // Filled inside the transaction; read after it commits.
    const record: { changed: { before: typeof companies.$inferSelect; after: RecordFields } | null } = { changed: null };
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
      record.changed = { before, after: { ...input, billingAddress } };
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
    // The client changed what goes on the next boleto: the team hears it before the bank does.
    if (record.changed && !actor.admin) await alertRecordChange(record.changed.before, record.changed.after, actor.user.name || actor.user.email);
    return { success: "Dados da empresa atualizados." };
  } catch (error) {
    return failure(error);
  }
}

export type NoticePreferencesInput = {
  /** null: the team's own ticket notices. */
  companyId: string | null;
  topic: string;
  emails: string[];
  phones: string[];
  emailEnabled: boolean;
  whatsappEnabled: boolean;
};

/** Who receives a company's notices on one subject (or the team's ticket notices). */
export async function updateNoticePreferences(
  actor: Actor,
  raw: NoticePreferencesInput,
): Promise<ActionState> {
  try {
    const companyId = z.string().uuid().nullable().parse(raw.companyId);
    const topic = z.enum(["billing", "tickets"]).parse(raw.topic);
    if (!companyId && (!actor.admin || topic !== "tickets")) return blocked;
    const { emailEnabled, whatsappEnabled } = raw;
    if (raw.emails.length > 10 || raw.phones.length > 10)
      return { error: "Cadastre até 10 e-mails e 10 telefones por assunto." };
    const readContacts = (
      values: string[],
      schema: typeof companyEmail | typeof companyPhone,
    ) => [
      ...new Set(
        values
          .map((value) => String(value).trim())
          .filter(Boolean)
          .map((value) => schema.parse(value)),
      ),
    ];
    const emails = readContacts(raw.emails, companyEmail);
    const phones = readContacts(raw.phones, companyPhone);
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
    return { success: "Preferências de notificações atualizadas." };
  } catch (error) {
    return failure(error);
  }
}

type RecordFields = { name: string; document: string; billingEmail: string; phone?: string | null; billingAddress: typeof companies.$inferSelect["billingAddress"] };

/** What the client changed in the billing record, before and after, to the team. */
async function alertRecordChange(before: typeof companies.$inferSelect, after: RecordFields, who: string) {
  const address = (value: typeof before.billingAddress) => (value ? addressLabel(value) : "sem endereço");
  const lines = [
    before.name !== after.name ? `Razão social: ${before.name} → ${after.name}` : null,
    before.document !== after.document ? `CPF/CNPJ: ${before.document} → ${after.document}` : null,
    before.billingEmail !== after.billingEmail ? `E-mail financeiro: ${before.billingEmail} → ${after.billingEmail}` : null,
    (before.phone ?? "") !== (after.phone ?? "") ? `Telefone: ${before.phone || "sem telefone"} → ${after.phone || "sem telefone"}` : null,
    address(before.billingAddress) !== address(after.billingAddress) ? `Endereço: ${address(before.billingAddress)} → ${address(after.billingAddress)}` : null,
  ].filter(Boolean);
  if (!lines.length) return;
  const problems = billingReadiness({ ...before, ...after });
  await sendOpsMail(
    `[Console] Cadastro alterado pelo cliente: ${after.name}`,
    `${who} alterou o cadastro de ${after.name} em Configurações → Dados da empresa.\n\n${lines.join("\n")}${
      problems.length ? `\n\nAtenção: ${billingProblemsLabel(problems)}. Sem isso, as próximas cobranças não saem no Inter.` : ""
    }${before.document !== after.document ? "\n\nO CPF/CNPJ mudou: as próximas cobranças saem com o novo pagador." : ""}\n\nConsole da Anuntech`,
  ).catch(() => undefined);
}
