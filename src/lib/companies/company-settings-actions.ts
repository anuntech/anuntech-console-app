"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { companyAddress } from "./company-billing";
import { updateCompanySettings, updateNoticePreferences } from "./company-settings";

// The rules live in company-settings.ts, shared with the app's API; these read the form.
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveCompanySettings(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  const result = await updateCompanySettings(actor, {
    id: text(form, "id"),
    name: text(form, "name"),
    document: text(form, "document"),
    billingEmail: text(form, "billingEmail"),
    phone: text(form, "phone"),
    address: Object.fromEntries(Object.keys(companyAddress.shape).map((key) => [key, text(form, key)])),
  });
  if (result.success) refresh();
  return result;
}

export async function saveNotificationPreferences(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  // Older forms posted a single "email"/"phone".
  const contacts = (name: string, legacy: string) =>
    (form.has(name) ? form.getAll(name) : form.getAll(legacy)).map(String);
  const result = await updateNoticePreferences(actor, {
    companyId: text(form, "companyId") || null,
    topic: text(form, "topic"),
    emails: contacts("emails", "email"),
    phones: contacts("phones", "phone"),
    emailEnabled: form.get("emailEnabled") === "yes",
    whatsappEnabled: form.get("whatsappEnabled") === "yes",
  });
  if (result.success) refresh();
  return result;
}
