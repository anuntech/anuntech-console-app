import type { Role } from "./permissions";

/*
 * Which products, services and projects a person sees in a company. Pure, so the
 * rules are tested without a database (tests/engagement-scope.test.ts).
 *
 * An Administrador sees every engagement of the company. A Membro sees every one
 * ("all", the default) or only the ones an Administrador or the team selected
 * ("selected", stored in console_membership_engagements). A selection with nothing
 * in it shows nothing: removing the last product never widens what someone sees.
 */

export type EngagementScope = "all" | ReadonlySet<string>;

export type ScopedMembership = {
  companyId: string;
  role: Role;
  engagementAccess: "all" | "selected";
  engagementIds: readonly string[];
};

/** One identity can hold several memberships in a company (one per e-mail alias): the widest wins. */
export function mergeScopes(memberships: readonly ScopedMembership[]): Map<string, EngagementScope> {
  const scopes = new Map<string, EngagementScope>();
  for (const m of memberships) {
    const current = scopes.get(m.companyId);
    if (current === "all") continue;
    if (m.role === "manager" || m.engagementAccess === "all") {
      scopes.set(m.companyId, "all");
      continue;
    }
    scopes.set(m.companyId, new Set([...(current ?? []), ...m.engagementIds]));
  }
  return scopes;
}

export function scopeIncludes(scope: EngagementScope | undefined, engagementId: string): boolean {
  if (!scope) return false;
  return scope === "all" || scope.has(engagementId);
}

/** The scope of a company for these grants, or undefined when none of them is for it. */
export function scopeOfCompany(
  grants: readonly { company: { id: string }; engagements: EngagementScope }[],
  companyId: string,
): EngagementScope | undefined {
  return grants.find((g) => g.company.id === companyId)?.engagements;
}
