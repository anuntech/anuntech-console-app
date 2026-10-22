import "server-only";
import { inArray } from "drizzle-orm";
import { engagements } from "@/db/schema";
import { db } from "../db";
import { canSeeEngagement, type Actor } from "../access/access";
import { companyDisplayName } from "../companies/display-name";
import { companyTerms, snapshotOf } from "../service-terms/terms";
import { visibleToClient } from "../service-terms/ticket-clock";
import { termsSummary, type TermsFact } from "../service-terms/terms-text";
import { GUIDE_VERSION } from "./guide-content";
import { recordMilestone } from "./milestones";

export type CompanyTermsView = { company: string; items: { title: string; promises: TermsFact[]; asks: TermsFact[] }[] };

/**
 * "Seus prazos" and "O que o seu contrato pede" in Como trabalhamos: each of
 * the client's companies with the conditions it has published. A product's
 * own conditions only for those who see that product; the team reads the
 * page as clients do, without terms. The web page and the app's guide.get.
 */
export async function guideTermsFor(actor: Actor, now = new Date()): Promise<CompanyTermsView[]> {
  const companies = actor.admin ? [] : actor.grants.map((g) => g.company);
  const rows = (await Promise.all(companies.map((c) => companyTerms(c.id)))).flat();
  const engagementIds = rows.map((r) => r.engagementId).filter((id): id is string => !!id);
  const names = new Map(
    engagementIds.length
      ? (await db.select({ id: engagements.id, name: engagements.name }).from(engagements).where(inArray(engagements.id, engagementIds))).map((e) => [e.id, e.name])
      : [],
  );
  return companies
    .map((company) => ({
      // Shown only to someone with more than one company, by its screen name.
      company: companyDisplayName(company.name, company.document),
      items: rows
        .filter((r) => r.companyId === company.id)
        .filter((r) => !r.engagementId || canSeeEngagement(actor, { id: r.engagementId, companyId: company.id }))
        .map((r) => ({ row: r, snapshot: snapshotOf(r) }))
        .filter(({ snapshot }) => snapshot && visibleToClient(snapshot, now))
        .map(({ row, snapshot }) => ({
          title: row.engagementId ? names.get(row.engagementId) ?? row.label : row.label,
          ...termsSummary(snapshot!),
        })),
    }))
    .filter((c) => c.items.length);
}

/** Reading "Como trabalhamos" counts once per version; it never stands for accepting any term. */
export async function markGuideReadAs(actor: Actor) {
  await recordMilestone(actor.user.id, `guide_read_v${GUIDE_VERSION}`);
}
