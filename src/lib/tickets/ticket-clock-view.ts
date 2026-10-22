import "server-only";
import type { tickets } from "@/db/schema";
import type { Actor } from "../access/access";
import { businessMinutesBetween } from "../service-terms/business-calendar";
import { loadCalendar } from "../service-terms/terms";
import { businessSpanLabel, visibleToClient } from "../service-terms/ticket-clock";

/** A ticket's deadlines as /chamados/[id] shows them under "Prazos". */
export type TicketClockView = {
  label: string;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  respondedIn: string | null;
  /** While the clock stands still waiting for the client. */
  pausedSince: string | null;
  /** Team only: the client sees these dates from this instant. */
  clientFrom: string | null;
};

/**
 * The deadlines a viewer may see: the team always, the client once the
 * conditions are published. The web page and the app's tickets.get.
 */
export async function ticketClockView(actor: Actor, t: typeof tickets.$inferSelect, now: Date): Promise<TicketClockView | null> {
  if (!t.terms || !(t.responseDueAt || t.resolutionDueAt) || !(actor.admin || visibleToClient(t.terms, now))) return null;
  const cal = await loadCalendar();
  return {
    label: t.terms.label,
    responseDueAt: t.responseDueAt?.toISOString() ?? null,
    resolutionDueAt: t.resolutionDueAt?.toISOString() ?? null,
    firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
    respondedIn: t.firstResponseAt
      ? businessSpanLabel(Math.max(1, businessMinutesBetween(t.createdAt, t.firstResponseAt, cal)))
      : null,
    pausedSince: t.status === "waiting_customer" && t.terms.policy.pausesWhileWaiting ? t.waitingSince?.toISOString() ?? null : null,
    clientFrom: actor.admin && !visibleToClient(t.terms, now) ? t.terms.publishAt : null,
  };
}
