import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { contracts, engagements, environmentProfile, invoices, tickets } from "@/db/schema";
import { db } from "@/lib/db";
import { accessibleCompanies, getActor } from "@/lib/access/access";
import { companyTerms, snapshotOf } from "@/lib/service-terms/terms";
import { visibleToClient } from "@/lib/service-terms/ticket-clock";
import { ticketKindSlugs, type TicketKind } from "@/lib/tickets/ticket-intake";
import type { LocalHolidays } from "@/lib/service-terms/business-calendar";
import { voiceEnabled } from "@/lib/voice/voice-server";
import type { TermsSnapshot } from "@/lib/service-terms/terms-model";
import type { TicketCompanyOption } from "./ticket-form";

export type NewTicketSearchParams = Promise<{
  companyId?: string;
  from?: string;
  tipo?: string;
}>;

/** What the form needs beyond the companies: their products, their conditions, the calendar. */
export type TicketFormContext = {
  companies: TicketCompanyOption[];
  companyId?: string;
  kind?: TicketKind;
  engagements: { id: string; name: string; companyId: string }[];
  /**
   * The conditions a new ticket would follow, by company id (no product)
   * and by engagement id; null where none apply or the viewer may not see
   * them yet.
   */
  terms: Record<string, TermsSnapshot | null>;
  holidays: LocalHolidays;
  staff: boolean;
  /** Dictation by microphone in the description (lib/voice). */
  voice?: boolean;
};

/**
 * Which companies the viewer may open a ticket for, and which one is
 * preselected: `companyId`, else (staff only) the company behind the page
 * they came from, else the only company they have. A forged `companyId`
 * answers 404.
 */
export async function newTicketContext(
  searchParams: NewTicketSearchParams,
): Promise<TicketFormContext> {
  const actor = await getActor();
  const available = [
    ...new Map(
      (await accessibleCompanies(actor, "support")).map((c) => [c.id, c]),
    ).values(),
  ];
  const query = await searchParams;
  let companyId = query.companyId;
  const context = query.from?.match(
    /^\/(empresas|chamados|financeiro|contratos)\/([a-f0-9-]{36})(?:\/|$)/,
  );
  if (actor.admin && !companyId && context) {
    const [, area, id] = context;
    if (area === "empresas") companyId = id;
    else {
      const table =
        area === "chamados"
          ? tickets
          : area === "financeiro"
            ? invoices
            : contracts;
      const [row] = await db
        .select({ companyId: table.companyId })
        .from(table)
        .where(eq(table.id, id));
      companyId = row?.companyId;
    }
  }
  if (companyId && !available.some((c) => c.id === companyId)) notFound();
  if (!actor.admin && !available.length) notFound();
  // Archived clients stay out of the picker unless asked for by id.
  const companies = available
    .filter((c) => !c.archived || c.id === companyId)
    .map((c) => ({ id: c.id, name: c.name, document: c.document }));
  const ids = companies.map((c) => c.id);
  const now = new Date();
  const [running, termRows, [profile]] = await Promise.all([
    ids.length
      ? db
          .select({ id: engagements.id, name: engagements.name, companyId: engagements.companyId })
          .from(engagements)
          .where(and(inArray(engagements.companyId, ids), eq(engagements.status, "active")))
          .orderBy(asc(engagements.name))
      : [],
    Promise.all(ids.map((id) => companyTerms(id))).then((rows) => rows.flat()),
    db.select({ holidays: environmentProfile.holidays }).from(environmentProfile).limit(1),
  ]);
  // Mirrors governingTerms: a product's own record wins, else the company's.
  // Clients see conditions only once published; the team sees them a week earlier.
  const visible = (snapshot: TermsSnapshot | null) => (snapshot && (actor.admin || visibleToClient(snapshot, now)) ? snapshot : null);
  const terms: Record<string, TermsSnapshot | null> = {};
  for (const id of ids) {
    const rows = termRows.filter((r) => r.companyId === id);
    const companyWide = rows.find((r) => !r.engagementId) ?? null;
    terms[id] = visible(snapshotOf(companyWide));
    for (const e of running.filter((e) => e.companyId === id))
      terms[e.id] = visible(snapshotOf(rows.find((r) => r.engagementId === e.id) ?? companyWide));
  }
  return {
    companies,
    companyId:
      companyId ?? (companies.length === 1 ? companies[0].id : undefined),
    kind: query.tipo ? ticketKindSlugs[query.tipo] : undefined,
    engagements: running,
    terms,
    holidays: profile?.holidays ?? {},
    staff: actor.admin,
    voice: voiceEnabled(),
  };
}
