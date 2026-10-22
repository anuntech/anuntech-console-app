import "server-only";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, hoursMonths } from "@/db/schema";
import { answersForClient, ASSISTED_DECISION, type Actor } from "../access/access";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { dateLabel } from "../format";
import { sendOpsMail } from "../notifications/ops-alerts";
import { bankMonth, bankTerms, hoursLabel, monthOf } from "./hours-bank";

/*
 * The client's two decisions on the hours bank (SUP 4.3 and 4.7): approve
 * hours beyond this month's bank and contest a month's report. The web's
 * approveOverage and contestHoursReport (hours-actions.ts) and the app's
 * hours.approveOverage and hours.contestReport call these, with the fields
 * as the forms send them.
 */

const id = z.string().uuid();
/** Hours as people type them ("2" or "1,5"), in minutes; the same reading as the team's forms. */
const hoursInput = z
  .string()
  .transform((v, ctx) => {
    const value = Number(v.trim().replace(",", "."));
    if (!Number.isFinite(value) || value <= 0 || value > 200) {
      ctx.addIssue({ code: "custom", message: "Informe as horas como 2 ou 1,5." });
      return z.NEVER;
    }
    return Math.round(value * 60);
  });
const failure = (e: unknown): ActionState => ({
  error: logDatabaseFault("hours", e)
    ? DATABASE_FAILURE
    : e instanceof z.ZodError
      ? e.issues[0].message
      : e instanceof Error && e.message
        ? e.message
        : "Não foi possível salvar.",
});
const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}`);
  revalidatePath("/painel");
}

/** The client's Administrador approves hours beyond this month's bank (SUP 4.3). */
export async function approveOverageAs(actor: Actor, fields: { companyId?: unknown; hours?: unknown }): Promise<ActionState> {
  try {
    const input = z.object({ companyId: id, hours: hoursInput }).parse(fields);
    if (actor.assisting) return { error: ASSISTED_DECISION };
    if (!answersForClient(actor, input.companyId)) return { error: "Só um Administrador da empresa aprova horas além do banco." };
    if (!(await bankTerms(input.companyId, { client: true })))
      return { error: "As condições com banco de horas desta empresa ainda não estão publicadas." };
    const month = monthOf();
    const now = new Date();
    await db
      .insert(hoursMonths)
      .values({ companyId: input.companyId, month, overageApprovedMinutes: input.hours, overageApprovedBy: actor.user.id, overageApprovedAt: now })
      .onConflictDoUpdate({
        target: [hoursMonths.companyId, hoursMonths.month],
        set: { overageApprovedMinutes: input.hours, overageApprovedBy: actor.user.id, overageApprovedAt: now, updatedAt: now },
      });
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: input.companyId, entityId: input.companyId, action: "hours.overage_approved", details: { month, minutes: input.hours } });
    await sendOpsMail(
      "Horas além do banco aprovadas",
      `${actor.user.name || actor.user.email} aprovou até ${hoursLabel(input.hours)} além do banco de ${month}.\n\n${consoleUrl()}/empresas/${input.companyId}\n\nConsole da Anuntech`,
    ).catch(() => undefined);
    refresh(input.companyId);
    return { success: `Aprovado: até ${hoursLabel(input.hours)} além do banco neste mês. O excedente é cobrado pelo valor do contrato.` };
  } catch (e) {
    return failure(e);
  }
}

/** The client's Administrador contests the month's report within the contract's window (SUP 4.7). */
export async function contestHoursReportAs(actor: Actor, fields: { companyId?: unknown; month?: unknown; note?: unknown }): Promise<ActionState> {
  try {
    const input = z
      .object({ companyId: id, month: z.string().regex(/^\d{4}-\d{2}$/), note: z.string().trim().min(5, "Conte o que não confere.").max(2000) })
      .parse(fields);
    if (actor.assisting) return { error: ASSISTED_DECISION };
    if (!answersForClient(actor, input.companyId)) return { error: "Só um Administrador da empresa contesta o relatório." };
    const [record] = await db.select().from(hoursMonths).where(and(eq(hoursMonths.companyId, input.companyId), eq(hoursMonths.month, input.month)));
    if (!record?.reportSentAt) return { error: "O relatório deste mês ainda não foi enviado." };
    if (record.contestedAt) return { error: "Este relatório já foi contestado." };
    // Past the contract's window the report counts as approved (SUP 4.7).
    const bank = await bankMonth(input.companyId, input.month, { client: true });
    if (!bank) return { error: "As condições com banco de horas desta empresa ainda não estão publicadas." };
    if (bank.contestUntil && new Date() > new Date(bank.contestUntil))
      return { error: `O prazo para contestar este relatório terminou em ${dateLabel(new Date(bank.contestUntil))}. Fale com a equipe por chamado.` };
    const now = new Date();
    await db.update(hoursMonths).set({ contestedAt: now, contestedBy: actor.user.id, contestNote: input.note, updatedAt: now }).where(eq(hoursMonths.id, record.id));
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: input.companyId, entityId: input.companyId, action: "hours.report_contested", details: { month: input.month } });
    await sendOpsMail(
      `Relatório de horas contestado: ${input.month}`,
      `${actor.user.name || actor.user.email} contestou o relatório de ${input.month}:\n\n${input.note}\n\n${consoleUrl()}/empresas/${input.companyId}\n\nConsole da Anuntech`,
    ).catch(() => undefined);
    refresh(input.companyId);
    return { success: "Contestação enviada. A equipe responde por chamado." };
  } catch (e) {
    return failure(e);
  }
}
