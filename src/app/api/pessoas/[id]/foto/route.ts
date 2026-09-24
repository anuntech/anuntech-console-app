import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, user } from "@/db/schema";
import { getAccountEmails } from "@/lib/account-identity";
import { getConsoleStaffAccess, hasConsoleStaffAccess } from "@/lib/console-members";
import { isOwnedProfileAvatar, readProfileAvatar } from "@/lib/profile-avatar";

const notFound = () => new Response(null, { status: 404 });

/**
 * Another person's uploaded photo, for faces on tasks and tickets. Visible
 * to Console staff, and to people who share a company with them.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) return new Response(null, { status: 401 });
  const { id } = await params;
  const [target] = await db
    .select({ id: user.id, email: user.email, image: user.image })
    .from(user)
    .where(eq(user.id, id));
  if (!target || !isOwnedProfileAvatar(target.image, target.id)) return notFound();
  const viewerIsTarget = target.id === session.user.id;
  if (!viewerIsTarget && !(await getConsoleStaffAccess(session.user.email)).admin) {
    if (!(await hasConsoleStaffAccess(target.email))) {
      const [viewerEmails, targetEmails] = await Promise.all([
        getAccountEmails(session.user.id, session.user.email),
        getAccountEmails(target.id, target.email),
      ]);
      const viewerCompanies = await db
        .select({ companyId: memberships.companyId })
        .from(memberships)
        .where(and(inArray(memberships.email, viewerEmails), eq(memberships.active, true)));
      const ids = viewerCompanies.map((row) => row.companyId);
      const shared = ids.length
        ? await db
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                inArray(memberships.companyId, ids),
                inArray(memberships.email, targetEmails),
                eq(memberships.active, true),
              ),
            )
            .limit(1)
        : [];
      if (!shared.length) return notFound();
    }
  }
  try {
    const bytes = await readProfileAvatar(target.image, target.id);
    if (!bytes) return notFound();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
