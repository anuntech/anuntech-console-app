import "server-only";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { engagements } from "@/db/schema";
import { auth } from "../auth/auth";
import { db } from "../db";
import { getAccountEmails } from "../account/account-identity";
import { engagementWhere, getActor, type Actor } from "../access/access";
import { getConsoleStaffAccess } from "../access/console-members";
import { loadGrants } from "../access/grants";

/*
 * Who reaches a catalog icon through /api/catalogo/<id>/icone. The routes
 * answer fetches and <img> loads, so a visitor without a session gets a status
 * code here, never getActor's redirect to the sign-in page.
 */

async function verifiedUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.emailVerified ? session.user : null;
}

/** The team, by the same rule as saveCatalogItem (getActor().admin); null for anyone else. */
export async function catalogIconEditor(): Promise<Actor | null> {
  if (!(await verifiedUser())) return null;
  const actor = await getActor();
  return actor.admin ? actor : null;
}

/**
 * Whether this request may load the icon of a catalog item: the team always;
 * anyone else when they see at least one product or service made from it,
 * with the rule of /produtos (engagementWhere).
 */
export async function catalogIconAccess(itemId: string): Promise<"signed-out" | "allowed" | "denied"> {
  const user = await verifiedUser();
  if (!user) return "signed-out";
  const { owner, admin } = await getConsoleStaffAccess(user.email);
  if (admin) return "allowed";
  const grants = await loadGrants(await getAccountEmails(user.id, user.email));
  if (!grants.length) return "denied";
  const actor: Actor = { user, owner, admin, grants, assisting: null, realAdmin: admin };
  const [row] = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(and(eq(engagements.catalogItemId, itemId), engagementWhere(actor, engagements.id, engagements.companyId)))
    .limit(1);
  return row ? "allowed" : "denied";
}
