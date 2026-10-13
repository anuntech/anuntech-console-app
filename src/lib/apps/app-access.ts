import "server-only";
import { eq } from "drizzle-orm";
import { companies, engagements } from "@/db/schema";
import { db } from "../db";
import { canAccess, type Actor } from "../access/access";
import { companyRole, decideAppOpening, type AppBlock, type PassRole, type ProtectedApp } from "./registry";

/**
 * How the person shows up in the pass: the team as "staff" (assisted access
 * included, since the pass names the real person), clients by their role in
 * the product's company.
 */
export function passRole(actor: Actor, companyId: string): PassRole | null {
  if (actor.realAdmin) return "staff";
  return companyRole(actor.grants, companyId);
}

export type AppOpening =
  | {
      ok: true;
      app: ProtectedApp;
      tenant: string | undefined;
      role: PassRole;
      engagement: { id: string; name: string; url: string | null };
      company: { id: string; name: string };
    }
  | { ok: false; reason: "not_found" }
  | {
      ok: false;
      reason: AppBlock;
      app: ProtectedApp | null;
      engagement: { id: string; name: string; kind: string; status: string; url: string | null };
      company: { id: string; name: string };
    };

/**
 * Everything that decides whether `actor` opens product `id` as an app,
 * checked on the server: the company (outside it the product does not exist),
 * a product that is active, a URL in the registry, the app's minimum role and,
 * where the app needs one, the company's tenant. The page and the action that
 * signs the pass both call it, so neither trusts the other.
 */
export async function resolveAppOpening(actor: Actor, id: string): Promise<AppOpening> {
  if (!id || id.length > 100) return { ok: false, reason: "not_found" };
  const [row] = await db
    .select({
      id: engagements.id,
      name: engagements.name,
      kind: engagements.kind,
      status: engagements.status,
      url: engagements.url,
      companyId: engagements.companyId,
      company: companies.name,
    })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .where(eq(engagements.id, id));
  if (!row || !canAccess(actor, row.companyId, "overview")) return { ok: false, reason: "not_found" };
  const role = passRole(actor, row.companyId);
  if (!role) return { ok: false, reason: "not_found" };
  const company = { id: row.companyId, name: row.company };
  const decision = decideAppOpening(row, role);
  if ("blocked" in decision)
    return {
      ok: false,
      reason: decision.blocked,
      app: decision.app,
      engagement: { id: row.id, name: row.name, kind: row.kind, status: row.status, url: row.url },
      company,
    };
  return {
    ok: true,
    app: decision.app,
    tenant: decision.tenant,
    role,
    engagement: { id: row.id, name: row.name, url: row.url },
    company,
  };
}
