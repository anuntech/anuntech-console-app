import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachments, tickets, memberships } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { hasPermission } from "@/lib/permissions";
import { getConsoleStaffAccess } from "@/lib/console-members";
import { getAccountEmails } from "@/lib/account-identity";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) return new Response(null, { status: 401 });
  const { id } = await params;
  const [meta] = await db
    .select({ companyId: tickets.companyId })
    .from(attachments)
    .innerJoin(tickets, eq(tickets.id, attachments.ticketId))
    .where(eq(attachments.id, id));
  if (!meta) return new Response(null, { status: 404 });
  if (!(await getConsoleStaffAccess(session.user.email)).admin) {
    const emails = await getAccountEmails(session.user.id, session.user.email);
    const grants = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.companyId, meta.companyId),
          inArray(memberships.email, emails),
          eq(memberships.active, true),
        ),
      );
    if (!grants.some((grant) => hasPermission(grant.role, "support")))
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
