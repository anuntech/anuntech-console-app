import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { engagements } from "@/db/schema";
import { db } from "@/lib/db";
import { getActor } from "@/lib/access/access";
import { companyTerms, snapshotOf } from "@/lib/service-terms/terms";
import { visibleToClient } from "@/lib/service-terms/ticket-clock";
import { termsSummary } from "@/lib/service-terms/terms-text";
import { guideSections } from "@/lib/guide/guide-content";
import { GuideView, type CompanyTermsView } from "@/components/guide/guide-view";

export const metadata: Metadata = {
  title: "Como trabalhamos",
  description: "Como a Anuntech atende: chamados, prazos, projetos e contratação.",
};

export default async function HowWeWork() {
  const actor = await getActor();
  const now = new Date();
  // Each of the client's companies with the conditions it has published; the team reads the page as clients do.
  const companies = actor.admin ? [] : actor.grants.map((g) => g.company);
  const rows = (await Promise.all(companies.map((c) => companyTerms(c.id)))).flat();
  const engagementIds = rows.map((r) => r.engagementId).filter((id): id is string => !!id);
  const names = new Map(
    engagementIds.length
      ? (await db.select({ id: engagements.id, name: engagements.name }).from(engagements).where(inArray(engagements.id, engagementIds))).map((e) => [e.id, e.name])
      : [],
  );
  const terms: CompanyTermsView[] = companies
    .map((company) => ({
      company: company.name,
      items: rows
        .filter((r) => r.companyId === company.id)
        .map((r) => ({ row: r, snapshot: snapshotOf(r) }))
        .filter(({ snapshot }) => snapshot && visibleToClient(snapshot, now))
        .map(({ row, snapshot }) => ({
          title: row.engagementId ? names.get(row.engagementId) ?? row.label : row.label,
          ...termsSummary(snapshot!),
        })),
    }))
    .filter((c) => c.items.length);
  return <GuideView sections={guideSections} terms={terms} staff={actor.admin} />;
}
