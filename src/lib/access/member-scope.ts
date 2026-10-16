import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { catalogItems, engagements, membershipEngagements } from "@/db/schema";
import { db } from "../db";
import { catalogIconSrc } from "../catalog/catalog-icons";
import type { MemberScope, ScopeEngagement } from "@/components/settings/member-access-fields";

/** The company's products, services and projects, for "O que esta pessoa vê". */
export async function scopeChoices(companyId: string): Promise<ScopeEngagement[]> {
  const rows = await db
    .select({
      id: engagements.id,
      name: engagements.name,
      kind: engagements.kind,
      status: engagements.status,
      catalogItemId: engagements.catalogItemId,
      icon: catalogItems.icon,
    })
    .from(engagements)
    .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
    .where(eq(engagements.companyId, companyId))
    .orderBy(asc(engagements.name));
  return rows.map(({ catalogItemId, icon, ...row }) => ({ ...row, icon: catalogIconSrc(catalogItemId, icon) }));
}

/**
 * What each membership sees, keyed by membership id. Aliases of one person are
 * merged by the caller with mergeMemberScopes, the same way access merges them.
 */
export async function membershipScopes(rows: { id: string; role: string; engagementAccess: "all" | "selected" }[]) {
  const restricted = rows.filter((r) => r.role === "member" && r.engagementAccess === "selected").map((r) => r.id);
  const selected = restricted.length
    ? await db
        .select({ membershipId: membershipEngagements.membershipId, engagementId: membershipEngagements.engagementId })
        .from(membershipEngagements)
        .where(inArray(membershipEngagements.membershipId, restricted))
    : [];
  return new Map<string, MemberScope>(
    rows.map((r) => [
      r.id,
      restricted.includes(r.id)
        ? { access: "selected", ids: selected.filter((s) => s.membershipId === r.id).map((s) => s.engagementId) }
        : { access: "all", ids: [] },
    ]),
  );
}

/** Two memberships of one person: the widest wins, as in lib/access/engagement-scope. */
export function mergeMemberScopes(a: MemberScope | undefined, b: MemberScope): MemberScope {
  if (!a) return b;
  if (a.access === "all" || b.access === "all") return { access: "all", ids: [] };
  return { access: "selected", ids: [...new Set([...a.ids, ...b.ids])] };
}
