import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, companies, journeys, user } from "@/db/schema";
import { getActor, requireAdmin } from "@/lib/access/access";
import { auditLabels } from "@/lib/format";
import { voiceEnabled } from "@/lib/voice/voice-server";
import { journeyFacts, journeyRows, readBriefing } from "@/lib/journeys/journey-facts";
import { journeyCandidates, journeyStaff } from "@/lib/journeys/journey-queries";
import { resolveJourney } from "@/lib/journeys/journey-model";
import { JourneyDetail } from "@/components/jornadas/journey-detail";
import { companyDisplayName } from "@/lib/companies/display-name";

const uuid = /^[0-9a-f-]{36}$/;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  // The title is the team's: anyone else gets the generic one, before any query.
  if (!(await getActor()).admin) return { title: "Jornada" };
  const { id } = await params;
  const [row] = uuid.test(id) ? await db.select({ title: journeys.title }).from(journeys).where(eq(journeys.id, id)) : [];
  return { title: row ? row.title : "Jornada" };
}

export default async function Journey({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const [journey] = await db.select().from(journeys).where(eq(journeys.id, id));
  if (!journey) notFound();
  const briefing = readBriefing(journey.briefing);
  const [facts, rows, staff, list, candidates, activity] = await Promise.all([
    journeyFacts(journey),
    journeyRows(journey.id),
    journeyStaff(),
    db.select({ id: companies.id, name: companies.name, document: companies.document }).from(companies).where(eq(companies.archived, false)).orderBy(asc(companies.name)),
    journey.companyId ? journeyCandidates(journey.companyId) : null,
    db
      .select({ id: auditEvents.id, action: auditEvents.action, details: auditEvents.details, at: auditEvents.createdAt, name: user.name, email: user.email })
      .from(auditEvents)
      .innerJoin(user, eq(user.id, auditEvents.actorId))
      .where(eq(auditEvents.entityId, journey.id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(12),
  ]);
  const resolved = resolveJourney(facts, rows, briefing, journey);
  const owner = journey.ownerId
    ? (staff.find((person) => person.id === journey.ownerId) ??
      (await db.select({ id: user.id, name: user.name, email: user.email, image: user.image }).from(user).where(eq(user.id, journey.ownerId)))[0] ??
      null)
    : null;
  const company = facts.company ? { id: facts.company.id, name: facts.company.name } : null;
  // The header names the company the way people read it; the pickers keep the razão social.
  const shown = company && { id: company.id, name: companyDisplayName(company.name, list.find((c) => c.id === company.id)?.document) };
  return (
    <JourneyDetail
      data={{
        journey: {
          id: journey.id,
          title: journey.title,
          status: journey.status,
          company: shown,
          lead: journey.lead ?? null,
          owner,
          ticketId: journey.ticketId,
          quoteId: journey.quoteId,
          engagementId: journey.engagementId,
          hostingEngagementId: journey.hostingEngagementId,
          createdAt: journey.createdAt.toISOString(),
          updatedAt: journey.updatedAt.toISOString(),
        },
        briefing,
        resolved,
        facts,
        staff,
        // The company it already has stays listed even when archived since.
        companies: company && !list.some((c) => c.id === company.id) ? [{ ...company, document: null }, ...list] : list,
        candidates,
        activity: activity.map((event) => {
          const details = (event.details ?? {}) as { step?: unknown; label?: unknown };
          const step = typeof details.step === "string" ? `: ${details.step}` : typeof details.label === "string" ? `: ${details.label}` : "";
          return {
            id: event.id,
            label: `${auditLabels[event.action] ?? "Jornada atualizada"}${step}`,
            who: event.name || event.email,
            at: event.at.toISOString(),
          };
        }),
        voice: voiceEnabled(),
        now: new Date().toISOString(),
      }}
    />
  );
}
