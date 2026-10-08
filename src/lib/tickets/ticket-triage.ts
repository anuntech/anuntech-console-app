import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { automationEvents, messages, tickets } from "@/db/schema";
import { db } from "../db";
import { priorityLabels } from "../format";
import { classifyTicket } from "../assistant/jev";
import { sendOpsMail } from "../notifications/ops-alerts";
import { suggestPriority, ticketImpactLabels, ticketImpacts, ticketKindHints, ticketKindLabels, ticketKinds, type TicketImpact, type TicketKind } from "./ticket-intake";

/*
 * After a ticket opens, Jev reads its text. When the text sounds worse than
 * what was ticked (a "Dúvida" that says the system stopped), the team sees a
 * suggested priority on the ticket and, for "Parou tudo", an e-mail now. The
 * priority is Anuntech's call (SUP 5.1): nothing changes on its own, and the
 * client never sees the suggestion.
 */

const CONFIDENCE = 0.75;
const rank = { normal: 0, high: 1, critical: 2 } as const;

export type TicketTriage = { kind: TicketKind; impact: TicketImpact; priority: "critical" | "high" | "normal"; confidence: number };

export async function triageTicket(ticketId: string) {
  try {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
    if (!ticket || ticket.priority === "critical" || ticket.kind === "new_project") return null;
    const [first] = await db.select({ body: messages.body }).from(messages).where(eq(messages.ticketId, ticketId)).orderBy(asc(messages.createdAt)).limit(1);
    const read = await classifyTicket({
      subject: ticket.subject,
      body: first?.body ?? "",
      kinds: Object.fromEntries(ticketKinds.map((k) => [k, `${ticketKindLabels[k]}: ${ticketKindHints[k]}`])),
      impacts: Object.fromEntries(ticketImpacts.map((i) => [i, ticketImpactLabels[i]])),
    });
    if (!read || !(ticketKinds as readonly string[]).includes(read.kind) || !(ticketImpacts as readonly string[]).includes(read.impact)) return null;
    const kind = read.kind as TicketKind;
    const impact = read.impact as TicketImpact;
    const confidence = Math.min(read.kindConfidence, kind === "problem" ? read.impactConfidence : 1);
    const priority = suggestPriority(kind, impact, ticket.terms?.policy.levels);
    if (confidence < CONFIDENCE || rank[priority] <= rank[ticket.priority]) return null;
    const triage: TicketTriage = { kind, impact, priority, confidence };
    const [stored] = await db
      .insert(automationEvents)
      .values({ kind: "ticket.triage", entityId: ticketId, companyId: ticket.companyId, details: triage })
      .onConflictDoNothing()
      .returning({ id: automationEvents.id });
    if (stored && kind === "problem" && impact === "down" && ticket.impact !== "down")
      await sendOpsMail(
        `Pode ser "Parou tudo": ${ticket.subject}`,
        `O texto de um chamado novo parece mais grave do que o que foi marcado ao abrir.\n\nChamado: ${ticket.subject}\nSugestão: ${ticketImpactLabels[impact]}, prioridade ${priorityLabels[priority]}\n\nA prioridade não muda sozinha. Confira e aplique no chamado: ${process.env.BETTER_AUTH_URL || "https://console.anuntech.com"}/chamados/${ticketId}\n\nConsole da Anuntech`,
      );
    return triage;
  } catch (error) {
    console.warn("[ticket-triage] skipped", error instanceof Error ? error.message : error);
    return null;
  }
}

/** The team's view of the suggestion, while the ticket's priority is still below it. */
export async function ticketTriage(ticketId: string, priority: "critical" | "high" | "normal"): Promise<TicketTriage | null> {
  const [row] = await db
    .select({ details: automationEvents.details })
    .from(automationEvents)
    .where(and(eq(automationEvents.kind, "ticket.triage"), eq(automationEvents.entityId, ticketId)));
  const triage = row?.details as TicketTriage | undefined;
  return triage && rank[triage.priority] > rank[priority] ? triage : null;
}
