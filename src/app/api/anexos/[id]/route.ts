import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { attachments, tasks, tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/access/permissions";
import { getConsoleStaffAccess } from "@/lib/access/console-members";
import { getAccountEmails } from "@/lib/account/account-identity";
import { loadGrants } from "@/lib/access/grants";
import { scopeIncludes } from "@/lib/access/engagement-scope";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) return new Response(null, { status: 401 });
  const { id } = await params;
  // A file belongs to a ticket (support access) or to a task (whoever sees its project),
  // with the same rules as the pages (lib/access): a Membro with a selection sees only
  // the boards chosen for them, and requests about other products only if they opened them.
  const [meta] = await db
    .select({
      ticketCompany: tickets.companyId,
      ticketEngagement: tickets.engagementId,
      ticketAuthor: tickets.authorId,
      taskCompany: tasks.companyId,
      taskEngagement: tasks.engagementId,
    })
    .from(attachments)
    .leftJoin(tickets, eq(tickets.id, attachments.ticketId))
    .leftJoin(tasks, eq(tasks.id, attachments.taskId))
    .where(eq(attachments.id, id));
  const companyId = meta?.ticketCompany ?? meta?.taskCompany;
  if (!meta || !companyId) return new Response(null, { status: 404 });
  if (!(await getConsoleStaffAccess(session.user.email)).admin) {
    const emails = await getAccountEmails(session.user.id, session.user.email);
    const grants = await loadGrants(emails, companyId);
    const scope = grants[0]?.engagements;
    const allowed = meta.ticketCompany
      ? grants.some((grant) => hasPermission(grant.role, "support")) &&
        (!meta.ticketEngagement || meta.ticketAuthor === session.user.id || scopeIncludes(scope, meta.ticketEngagement))
      : grants.length > 0 && !!meta.taskEngagement && scopeIncludes(scope, meta.taskEngagement);
    if (!allowed) return new Response(null, { status: 404 });
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
