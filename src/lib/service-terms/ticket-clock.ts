/*
 * A ticket's clock under its company's conditions: when the first response
 * is due (a commitment), when the solution is aimed for (a goal), and how
 * waiting for the client stops it (SUP 6.4). Pure; the caller brings the
 * calendar and the snapshot taken when the ticket was opened.
 */
import { addBusinessMinutes, businessMinutesBetween, type Calendar } from "./business-calendar";
import type { ResponseRule, ServicePolicy, TermsSnapshot } from "./terms-model";
import { outsideSupportClock, type TicketImpact, type TicketKind } from "../tickets/ticket-intake";

export type ClockTicket = {
  createdAt: Date;
  priority: "critical" | "high" | "normal";
  kind?: TicketKind | null;
  impact?: TicketImpact | null;
  pausedMinutes?: number;
  terms?: TermsSnapshot | null;
};

/** The rule that applies to a ticket, or null when its conditions set no deadline for it. */
export function responseRule(policy: ServicePolicy, priority: ClockTicket["priority"], impact?: TicketImpact | null): ResponseRule | null {
  const base = policy.levels ? (policy.response[priority] ?? policy.response.normal) : policy.response.normal;
  if (!base) return null;
  // A whole service down gets the faster lane where the contract has one (Infra, E-mail).
  if (!policy.levels && impact === "down" && policy.outageFirstResponseMinutes)
    return { firstResponseMinutes: Math.min(base.firstResponseMinutes, policy.outageFirstResponseMinutes), goalMinutes: base.goalMinutes ?? null };
  return base;
}

/** Due instants; nulls when there are no conditions, or for a request outside the support clock. */
export function ticketDues(ticket: ClockTicket, cal: Calendar) {
  const policy = ticket.terms?.policy;
  if (!policy || outsideSupportClock(ticket.kind)) return { responseDueAt: null, resolutionDueAt: null };
  const rule = responseRule(policy, ticket.priority, ticket.impact);
  if (!rule) return { responseDueAt: null, resolutionDueAt: null };
  const paused = policy.pausesWhileWaiting ? Math.max(0, ticket.pausedMinutes ?? 0) : 0;
  return {
    responseDueAt: addBusinessMinutes(ticket.createdAt, rule.firstResponseMinutes + paused, cal),
    // A request for something new is evaluated first: no goal runs on it.
    resolutionDueAt: rule.goalMinutes && ticket.kind !== "change" ? addBusinessMinutes(ticket.createdAt, rule.goalMinutes + paused, cal) : null,
  };
}

/** Business minutes a wait added to the pause, when the conditions pause the clock. */
export function pauseToAdd(terms: TermsSnapshot | null | undefined, waitingSince: Date | null | undefined, now: Date, cal: Calendar) {
  if (!terms?.policy.pausesWhileWaiting || !waitingSince) return 0;
  return businessMinutesBetween(waitingSince, now, cal);
}

/** Whether a client may see the dates of these terms yet (the team sees them a week earlier). */
export function visibleToClient(terms: TermsSnapshot | null | undefined, now: Date) {
  return !!terms && (!terms.publishAt || new Date(terms.publishAt) <= now);
}

/** "4 horas úteis", "1 dia útil", "10 dias úteis": a rule's size in the contracts' words. */
export function businessSpanLabel(minutes: number) {
  if (minutes < 60) return "menos de 1 hora útil";
  if (minutes % 540 === 0) {
    const days = minutes / 540;
    return days === 1 ? "1 dia útil" : `${days} dias úteis`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  return hours === 1 ? "1 hora útil" : `${String(hours).replace(".", ",")} horas úteis`;
}
