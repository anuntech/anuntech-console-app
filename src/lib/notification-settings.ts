import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { notificationSettings } from "@/db/schema";

type Connection = Pick<typeof db, "select" | "execute">;
export const TICKET_NOTIFICATION_KEY = "ticket-notifications";
// Shared delivery locks let disabling wait for in-flight work before it completes.
export async function lockTicketNotifications(
  connection: Connection,
  exclusive = false,
) {
  await connection.execute(
    exclusive
      ? sql`select pg_advisory_xact_lock(hashtext(${TICKET_NOTIFICATION_KEY}))`
      : sql`select pg_advisory_xact_lock_shared(hashtext(${TICKET_NOTIFICATION_KEY}))`,
  );
}
export async function ticketNotificationsEnabled(connection: Connection = db) {
  const [settings] = await connection
    .select({ enabled: notificationSettings.enabled })
    .from(notificationSettings)
    .where(eq(notificationSettings.id, TICKET_NOTIFICATION_KEY));
  return settings?.enabled ?? true;
}
