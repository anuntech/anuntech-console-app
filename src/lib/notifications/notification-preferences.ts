import "server-only";
import { eq, sql } from "drizzle-orm";
import { companies, notificationPreferences, user } from "@/db/schema";
import { db } from "../db";
import { resolveAccountIdentity } from "../account/account-identity";

type Executor = Pick<typeof db, "select">;
export type NotificationTopic = "billing" | "tickets";
export type NoticePreferences = {
  emails?: string[] | null;
  phones?: string[] | null;
  email: string;
  phone: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
};
export const preferenceKey = (
  companyId: string | null,
  topic: NotificationTopic,
) => `${companyId || "console"}:${topic}`;
export function whatsappDestination(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits && digits.length <= 11 ? `55${digits}` : digits;
}
export function defaultCompanyPreferences(
  company: { billingEmail: string; phone: string | null } | undefined,
  topic: NotificationTopic,
): NoticePreferences {
  return {
    email: company?.billingEmail || "",
    phone: company?.phone || "",
    emailEnabled: topic === "billing",
    whatsappEnabled: topic === "billing",
  };
}
export async function getNoticePreferences(
  companyId: string | null,
  topic: NotificationTopic,
  executor: Executor = db,
): Promise<NoticePreferences> {
  const [saved] = await executor
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.key, preferenceKey(companyId, topic)));
  if (saved) return saved;
  if (companyId) {
    const [company] = await executor
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));
    return defaultCompanyPreferences(company, topic);
  }
  const email = process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase() || "";
  const identity = await resolveAccountIdentity(email, executor);
  const [owner] = identity.userId
    ? await executor.select().from(user).where(eq(user.id, identity.userId))
    : [];
  return {
    email,
    phone: owner?.phoneNumberVerified ? owner.phoneNumber || "" : "",
    emailEnabled: true,
    whatsappEnabled: true,
  };
}

/** A completed preference change waits for a previously started delivery. */
export async function lockCompanyNotifications(
  connection: Pick<typeof db, "execute">,
  companyId: string,
  exclusive = false,
) {
  const key = `company-notifications:${companyId}`;
  await connection.execute(
    exclusive
      ? sql`select pg_advisory_xact_lock(hashtext(${key}))`
      : sql`select pg_advisory_xact_lock_shared(hashtext(${key}))`,
  );
}

export function noticeEmails(preferences: NoticePreferences) {
  return [
    ...new Set(
      (preferences.emails ?? [preferences.email])
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
export function noticePhones(preferences: NoticePreferences) {
  return [
    ...new Set(
      (preferences.phones ?? [preferences.phone])
        .map(whatsappDestination)
        .filter(Boolean),
    ),
  ];
}
