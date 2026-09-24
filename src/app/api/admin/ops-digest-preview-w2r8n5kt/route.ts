import "server-only";
import { desc, eq, ilike } from "drizzle-orm";
import { auditEvents, invoices } from "@/db/schema";
import { db } from "@/lib/db";
import { collectOpsDigest } from "@/lib/ops-alerts";
import { opsDigestText } from "@/lib/ops-digest-text";

/** Read-only: the text the morning digest would send right now, plus one invoice's stored dates. Remove after use. */
export async function GET() {
  const data = await collectOpsDigest();
  const { subject, text } = opsDigestText(data);
  const rows = await db
    .select({ id: invoices.id, status: invoices.status, dueDate: invoices.dueDate, bankDueDate: invoices.bankDueDate, bankStatus: invoices.bankStatus })
    .from(invoices)
    .where(ilike(invoices.description, "%atrasada de agosto%"));
  const events = rows.length
    ? await db
        .select({ action: auditEvents.action, createdAt: auditEvents.createdAt, details: auditEvents.details })
        .from(auditEvents)
        .where(eq(auditEvents.entityId, rows[0].id))
        .orderBy(desc(auditEvents.createdAt))
        .limit(6)
    : [];
  return new Response(`${subject}\n\n${text}\n\n--- debug ---\n${JSON.stringify({ rows, events }, null, 1)}`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
