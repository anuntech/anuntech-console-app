import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { attachments, tasks, tickets, memberships } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { hasPermission, type Area } from "@/lib/access/permissions";
import { getConsoleStaffAccess } from "@/lib/access/console-members";
import { getAccountEmails } from "@/lib/account/account-identity";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) return new Response(null, { status: 401 });
  const { id } = await params;
  // A file belongs to a ticket (support access) or to a task (any company access).
  const [meta] = await db
    .select({
      ticketCompany: tickets.companyId,
      taskCompany: tasks.companyId,
    })
    .from(attachments)
    .leftJoin(tickets, eq(tickets.id, attachments.ticketId))
    .leftJoin(tasks, eq(tasks.id, attachments.taskId))
    .where(eq(attachments.id, id));
  const companyId = meta?.ticketCompany ?? meta?.taskCompany;
  if (!meta || !companyId) return new Response(null, { status: 404 });
  const area: Area = meta.ticketCompany ? "support" : "overview";
  if (!(await getConsoleStaffAccess(session.user.email)).admin) {
    const emails = await getAccountEmails(session.user.id, session.user.email);
    const grants = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.companyId, companyId),
          inArray(memberships.email, emails),
          eq(memberships.active, true),
        ),
      );
    if (!grants.some((grant) => hasPermission(grant.role, area)))
      return new Response(null, { status: 404 });
  }
  const [file] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, id));
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= file.content.length) { controller.close(); return; }
      const end = Math.min(offset + 64 * 1024, file.content.length);
      controller.enqueue(new Uint8Array(file.content.subarray(offset, end)));
      offset = end;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
