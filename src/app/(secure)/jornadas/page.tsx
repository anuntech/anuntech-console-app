import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, journeys, user } from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import { listLayoutFor } from "@/lib/list-layout-server";
import { journeyFacts, journeysRows, readBriefing } from "@/lib/journeys/journey-facts";
import { journeyMovedAt } from "@/lib/journeys/journey-queries";
import { JOURNEY_STALLED_DAYS, currentStage, journeyFilters, resolveJourney, stageTitle, type JourneyFilter } from "@/lib/journeys/journey-model";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { JourneysList } from "@/components/jornadas/journeys-list";
import type { JourneyListRow } from "@/components/jornadas/journey-types";
import { companyDisplayName } from "@/lib/companies/display-name";
import { mapLimit } from "@/lib/concurrency";

export const metadata: Metadata = {
  title: "Jornadas",
  description: "Cada projeto de cliente, do primeiro contato à hospedagem, com o próximo passo à vista.",
};

/** A page shows this many; the oldest finished ones are the first to go. */
const LIMIT = 120;

export default async function Journeys({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const view = await listLayoutFor("journeys");
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const status: JourneyFilter = journeyFilters.includes(params.situacao as JourneyFilter) ? (params.situacao as JourneyFilter) : "active";
  const term = search.replace(/[\\%_]/g, "\\$&");
  const where: SQL | undefined = and(
    status === "all" ? undefined : eq(journeys.status, status),
    term
      ? or(ilike(journeys.title, `%${term}%`), ilike(companies.name, `%${term}%`), sql`${journeys.lead}->>'name' ilike ${`%${term}%`}`)
      : undefined,
  );
  const rows = await db
    .select({ journey: journeys, company: companies.name, companyDocument: companies.document, movedAt: journeyMovedAt })
    .from(journeys)
    .leftJoin(companies, eq(companies.id, journeys.companyId))
    .where(where)
    .orderBy(desc(journeyMovedAt))
    .limit(LIMIT);
  const ownerIds = [...new Set(rows.map((r) => r.journey.ownerId).filter((id): id is string => !!id))];
  const [owners, stored, facts] = await Promise.all([
    ownerIds.length ? db.select({ id: user.id, name: user.name, email: user.email, image: user.image }).from(user).where(inArray(user.id, ownerIds)) : [],
    journeysRows(rows.map((r) => r.journey.id)),
    // Each journey's facts are several reads of their own: two journeys at a time keeps the pool free for everyone else.
    mapLimit(rows, 2, (r) => journeyFacts(r.journey)),
  ]);
  const now = new Date();
  const list: JourneyListRow[] = rows.map(({ journey, company, companyDocument, movedAt }, index) => {
    const resolved = resolveJourney(facts[index], stored.get(journey.id) ?? [], readBriefing(journey.briefing), journey);
    const stage = currentStage(resolved);
    return {
      id: journey.id,
      title: journey.title,
      status: journey.status,
      who: company ? companyDisplayName(company, companyDocument) : journey.lead ? `Contato: ${journey.lead.name}` : "Sem cadastro",
      // The tile keeps the razão social, so its pixels match the company's own page.
      tile: company ?? null,
      lead: !company,
      stage: stageTitle(stage),
      done: resolved.done,
      total: resolved.total,
      next: resolved.next?.def.title ?? null,
      owner: owners.find((o) => o.id === journey.ownerId) ?? null,
      updatedAt: new Date(movedAt).toISOString(),
      stalled: journey.status === "active" && now.getTime() - new Date(movedAt).getTime() > JOURNEY_STALLED_DAYS * 86_400_000,
    };
  });
  return (
    <>
      <PageHeader title="Jornadas" count={list.length} className="mb-4" />
      <JourneysList
        rows={list}
        search={search}
        status={status}
        now={now.toISOString()}
        view={view}
        actions={
          <Button asChild>
            <Link href="/jornadas/nova" data-assistant-action="">
              <PlusIcon />
              Nova jornada
            </Link>
          </Button>
        }
      />
    </>
  );
}
