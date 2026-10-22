import "server-only";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditEvents, tickets } from "@/db/schema";
import { answersForClient, ASSISTED_DECISION, type Actor } from "../access/access";
import { db } from "../db";
import { sendOpsMail } from "../notifications/ops-alerts";
import { hoursLabel } from "./hours-bank";

export type EstimateDecision = { ticketId: string; decision: "approve" | "decline"; minutes: number };

const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";

/**
 * The client's Administrador approves or declines an improvement's estimate
 * (SUP 5.1): the web's decideEstimate and the app's tickets.decideEstimate.
 * `minutes` is the estimate the person saw, so a newer one in between is
 * never approved by accident. Database failures throw; the caller words them.
 */
export async function decideEstimateAs(actor: Actor, input: EstimateDecision): Promise<{ error: string } | { success: string }> {
  const [t] = await db.select().from(tickets).where(eq(tickets.id, input.ticketId));
  if (actor.assisting) return { error: ASSISTED_DECISION };
  if (!t || !answersForClient(actor, t.companyId)) return { error: "Só um Administrador da empresa aprova estimativas." };
  const approved = input.decision === "approve";
  const [decided] = await db
    .update(tickets)
    .set({ estimateStatus: approved ? "approved" : "declined", estimateDecidedBy: actor.user.id, estimateDecidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tickets.id, t.id), eq(tickets.estimateStatus, "proposed"), eq(tickets.estimateMinutes, input.minutes)))
    .returning({ id: tickets.id });
  if (!decided) return { error: "A estimativa mudou ou já foi respondida. Recarregue o chamado." };
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    companyId: t.companyId,
    entityId: t.id,
    action: approved ? "ticket.estimate_approved" : "ticket.estimate_declined",
    details: { minutes: t.estimateMinutes },
  });
  await sendOpsMail(
    `Estimativa ${approved ? "aprovada" : "recusada"}: ${t.subject}`,
    `${actor.user.name || actor.user.email} ${approved ? "aprovou" : "recusou"} a estimativa de ${hoursLabel(t.estimateMinutes ?? 0)} do chamado "${t.subject}".\n\n${consoleUrl()}/chamados/${t.id}\n\nConsole da Anuntech`,
  ).catch(() => undefined);
  revalidatePath(`/chamados/${t.id}`);
  return { success: approved ? "Estimativa aprovada. A equipe pode começar." : "Estimativa recusada. A equipe vai falar com você no chamado." };
}
