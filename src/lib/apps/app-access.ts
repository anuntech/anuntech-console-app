import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { companies, engagements } from "@/db/schema";
import { db } from "../db";
import { allowedIds, canSeeEngagement, engagementWhere, type Actor } from "../access/access";
import {
  chooseAppProduct,
  companyRole,
  decideAppOpening,
  type AppBlock,
  type AppProductChoice,
  type PassRole,
  type ProtectedApp,
} from "./registry";

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
      company: { id: string; name: string; document: string };
    }
  | { ok: false; reason: "not_found" }
  | {
      ok: false;
      reason: AppBlock;
      app: ProtectedApp | null;
      engagement: { id: string; name: string; kind: string; status: string; url: string | null };
      company: { id: string; name: string; document: string };
    };

/**
 * Everything that decides whether `actor` opens product `id` as an app,
 * checked on the server: the company and, for a Membro with a selection, the
 * product itself (outside them the product does not exist),
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
      companyDocument: companies.document,
    })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .where(eq(engagements.id, id));
  if (!row || !canSeeEngagement(actor, { id: row.id, companyId: row.companyId })) return { ok: false, reason: "not_found" };
  const role = passRole(actor, row.companyId);
  if (!role) return { ok: false, reason: "not_found" };
  const company = { id: row.companyId, name: row.company, document: row.companyDocument };
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

/**
 * Where /abrir/<app> sends `actor`: among the active products they see (every
 * company for the team; a Membro with a selection, only the chosen ones), the ones whose URL is
 * this app. The role is not checked here; /apps/<id> checks it again and
 * says why when it refuses.
 */
export async function resolveAppLink(actor: Actor, app: ProtectedApp): Promise<AppProductChoice> {
  const companyIds = allowedIds(actor, "overview");
  if (!actor.admin && !companyIds.length) return { kind: "none" };
  const products = await db
    .select({ id: engagements.id, kind: engagements.kind, status: engagements.status, url: engagements.url })
    .from(engagements)
    .where(
      and(
        eq(engagements.kind, "product"),
        eq(engagements.status, "active"),
        isNotNull(engagements.url),
        engagementWhere(actor, engagements.id, engagements.companyId),
      ),
    );
  return chooseAppProduct(app, products);
}
