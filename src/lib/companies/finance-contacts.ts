import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, notificationPreferences } from "@/db/schema";
import type { db } from "../db";
import { lockCompanyNotifications, preferenceKey } from "../notifications/notification-preferences";
import { companyEmail, companyPhone } from "./company-input";

/** Up to ten of each, like the client's Notificações; the first is the company's own e-mail and phone. */
export const FINANCE_CONTACTS_LIMIT = 10;

/** Marks a company form that edits the finance contacts (the team's form; the client's own uses Notificações). */
export const FINANCE_CONTACTS_FIELD = "financeContacts";

export type FinanceContacts = { emails: string[]; phones: string[] };

/**
 * The finance contacts of a company form: the main e-mail and phone first, then
 * the extra ones ("financeEmails", "financePhones"), each checked, without
 * repeats. `null` when the form does not edit them.
 */
export function readFinanceContacts(form: FormData, main: { billingEmail: string; phone: string }): FinanceContacts | null {
  if (!form.has(FINANCE_CONTACTS_FIELD)) return null;
  const read = (values: FormDataEntryValue[], schema: typeof companyEmail | typeof companyPhone, first: string) => [
    ...new Set(
      [first, ...values.map(String)]
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => schema.parse(value)),
    ),
  ];
  const limit = z
    .array(z.string())
    .max(FINANCE_CONTACTS_LIMIT, `Cadastre até ${FINANCE_CONTACTS_LIMIT} e-mails e ${FINANCE_CONTACTS_LIMIT} telefones do financeiro.`);
  return {
    emails: limit.parse(read(form.getAll("financeEmails"), companyEmail, main.billingEmail)),
    phones: limit.parse(read(form.getAll("financePhones"), companyPhone, main.phone)),
  };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Saves who receives the company's billing notices: the same list the client
 * edits in Notificações. Keeps the channels the client chose (e-mail,
 * WhatsApp); a company without a saved choice gets both, as before.
 */
export async function saveFinanceContacts(
  tx: Transaction,
  { actorId, companyId, contacts }: { actorId: string; companyId: string; contacts: FinanceContacts },
) {
  await lockCompanyNotifications(tx, companyId, true);
  const key = preferenceKey(companyId, "billing");
  const [saved] = await tx.select().from(notificationPreferences).where(eq(notificationPreferences.key, key));
  const same =
    saved &&
    JSON.stringify(saved.emails ?? [saved.email].filter(Boolean)) === JSON.stringify(contacts.emails) &&
    JSON.stringify(saved.phones ?? [saved.phone].filter(Boolean)) === JSON.stringify(contacts.phones);
  // One e-mail and one phone, never customised: the company's own fields already say it.
  if (same || (!saved && contacts.emails.length <= 1 && contacts.phones.length <= 1)) return;
  const values = {
    key,
    companyId,
    topic: "billing" as const,
    email: contacts.emails[0] || "",
    phone: contacts.phones[0] || "",
    emails: contacts.emails,
    phones: contacts.phones,
    emailEnabled: saved?.emailEnabled ?? true,
    whatsappEnabled: saved?.whatsappEnabled ?? true,
    updatedAt: new Date(),
  };
  await tx
    .insert(notificationPreferences)
    .values(values)
    .onConflictDoUpdate({ target: notificationPreferences.key, set: values });
  await tx.insert(auditEvents).values({
    actorId,
    companyId,
    entityId: key,
    action: "notifications.preferences_updated",
    details: { topic: "billing", emails: contacts.emails.length, phones: contacts.phones.length, from: "company" },
  });
}
