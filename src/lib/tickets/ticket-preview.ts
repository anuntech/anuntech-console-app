import "server-only";
import { and, eq } from "drizzle-orm";
import { engagements } from "@/db/schema";
import { engagementWhere, type Actor } from "../access/access";
import { db } from "../db";
import { companyTerms, loadCalendar, snapshotOf } from "../service-terms/terms";
import { changeGuidance, expectation, outOfHoursLine } from "../service-terms/terms-text";
import { visibleToClient } from "../service-terms/ticket-clock";
import type { TicketImpact, TicketKind } from "./ticket-intake";

/**
 * What the new-ticket form tells before sending, as the web form computes it
 * in the browser (components/chamados/ticket-form.tsx with the conditions of
 * new-ticket-context.ts): "O que esperar", the line outside business hours
 * and, for "Ajuste ou algo novo", what happens to the request. The caller
 * checks the company's support area. Clients read conditions only once
 * published; the team a week earlier, as on the web.
 */
export async function ticketPreview(
  actor: Actor,
  input: { companyId: string; engagementId: string; kind: TicketKind; impact?: TicketImpact | null },
  now = new Date(),
) {
  const [running, rows, cal] = await Promise.all([
    db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        and(
          eq(engagements.companyId, input.companyId),
          eq(engagements.status, "active"),
          // A Membro with a selection picks only among the products chosen for them.
          engagementWhere(actor, engagements.id, engagements.companyId, "support"),
        ),
      ),
    companyTerms(input.companyId),
    loadCalendar(),
  ]);
  // The product picked, or the only one the form preselects; one out of reach counts as none.
  const product = running.some((e) => e.id === input.engagementId)
    ? input.engagementId
    : running.length === 1
      ? running[0].id
      : "";
  const companyWide = rows.find((r) => !r.engagementId) ?? null;
  // Mirrors governingTerms: a product's own record wins, else the company's.
  const snapshot = snapshotOf(product ? (rows.find((r) => r.engagementId === product) ?? companyWide) : companyWide);
  const governing = snapshot && (actor.admin || visibleToClient(snapshot, now)) ? snapshot : null;
  const expect = expectation(governing, input.kind, input.kind === "problem" ? (input.impact ?? "other") : null, now, cal);
  return {
    expect,
    outOfHours: input.kind === "new_project" ? null : outOfHoursLine(now, cal, expect.dated),
    changeGuidance: input.kind === "change" ? changeGuidance(governing) : null,
  };
}
