"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, hoursMonths, tickets, timeEntries } from "@/db/schema";
import { answersForClient, ASSISTED_DECISION, getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { dateLabel } from "../format";
import { sendOpsMail } from "../notifications/ops-alerts";
import { enqueueTicketNotice, scheduleTicketNotices } from "../tickets/ticket-notifications";
import { bankMonth, bankTerms, hoursLabel, monthOf } from "./hours-bank";
import { deliverBankAlert, deliverHoursReport } from "./hours-delivery";
import { decideEstimateAs } from "./estimate-decision";

/*
 * The hours bank of a support contract (SUP 4.1 to 4.7, 5.1): the team logs
 * hours, the client's Administrador approves what goes beyond the bank and
 * the estimate of each improvement, and the month's report can be contested.
 * The report and the 80% notice go when the team clicks, or from the
 * routines when the automation is switched on (hours-delivery.ts).
 */

const blocked = { error: "Você não tem permissão para fazer isso." };
const id = z.string().uuid();
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

function refresh(companyId: string, ticketId?: string | null) {
  revalidatePath(`/empresas/${companyId}`);
  revalidatePath("/painel");
  if (ticketId) revalidatePath(`/chamados/${ticketId}`);
}

/** The team logs work. Bank hours never go past what the client has approved, except a critical fix (SUP 4.5). */
export async function logTime(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        companyId: id,
        ticketId: z.union([id, z.literal("")]).default(""),
        hours: hoursInput,
        note: z.string().trim().min(3, "Diga o que foi feito.").max(500),
        workedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(saoPauloDate()),
        kind: z.enum(["bank", "warranty", "critical"]).default("bank"),
      })
      .parse(Object.fromEntries(form));
    if (input.workedOn > saoPauloDate()) return { error: "As horas são do trabalho já feito; escolha hoje ou um dia anterior." };
    let ticketCompany: string | null = null;
    if (input.ticketId) {
      const [t] = await db.select({ companyId: tickets.companyId, estimateStatus: tickets.estimateStatus }).from(tickets).where(eq(tickets.id, input.ticketId));
      if (!t || t.companyId !== input.companyId) return blocked;
      // An improvement uses the bank only with its estimate approved (SUP 5.1).
      if (input.kind === "bank" && t.estimateStatus === "proposed")
        return { error: "A estimativa desta melhoria ainda espera a aprovação do cliente." };
      if (input.kind === "bank" && t.estimateStatus === "declined")
        return { error: "O cliente recusou a estimativa desta melhoria: as horas não saem do banco. Combine no chamado antes de seguir." };
      ticketCompany = t.companyId;
    }
    const month = await bankMonth(input.companyId, monthOf(input.workedOn));
    if (!month) return { error: "Esta empresa não tem banco de horas nas condições de atendimento." };
    if (input.kind === "bank" && month.usedMinutes + input.hours > month.includedMinutes + month.overageApprovedMinutes)
      return {
        error: `Passa do banco do mês (${hoursLabel(month.usedMinutes)} de ${hoursLabel(month.includedMinutes + month.overageApprovedMinutes)}). Peça ao cliente que aprove horas além do banco, ou registre como defeito crítico.`,
      };
    await db.insert(timeEntries).values({
      companyId: input.companyId,
      ticketId: input.ticketId || null,
      authorId: actor.user.id,
      minutes: input.hours,
      note: input.note,
      workedOn: input.workedOn,
      kind: input.kind,
    });
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: input.companyId,
      entityId: input.ticketId || input.companyId,
      action: "hours.logged",
      details: { minutes: input.hours, kind: input.kind, month: month.month },
    });
    refresh(input.companyId, ticketCompany ? input.ticketId : null);
    const after = month.usedMinutes + (input.kind === "warranty" ? 0 : input.hours);
    const crossed = after * 100 >= month.includedMinutes * month.alertPercent && month.usedMinutes * 100 < month.includedMinutes * month.alertPercent;
    return {
      success: crossed
        ? `Horas registradas. O banco do mês passou de ${month.alertPercent}%: o cliente vê o aviso no Console; avise por e-mail no card do banco, na página da empresa.`
        : "Horas registradas.",
    };
  } catch (e) {
    return failure(e);
  }
}

/** The team proposes how many bank hours an improvement takes (SUP 5.1); the client approves before work starts. */
export async function proposeEstimate(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ ticketId: id, hours: hoursInput }).parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [t] = await tx.select().from(tickets).where(eq(tickets.id, input.ticketId)).for("update");
      if (!t) throw Error("Chamado não encontrado.");
      // Tickets opened before the conditions existed take the limit from the conditions in force, as the page does.
      const limit = t.terms?.policy.improvementBankLimitMinutes ?? (await bankTerms(t.companyId, {}, tx))?.policy.improvementBankLimitMinutes;
      if (limit && input.hours > limit)
        throw Error(`Acima de ${hoursLabel(limit)} a melhoria vai por orçamento (SUP 5.2). Crie um orçamento para este pedido.`);
      const [row] = await tx
        .update(tickets)
        .set({ estimateMinutes: input.hours, estimateStatus: "proposed", estimateDecidedBy: null, estimateDecidedAt: null, updatedAt: new Date() })
        .where(eq(tickets.id, t.id))
        .returning();
      const [event] = await tx
        .insert(auditEvents)
        .values({ actorId: actor.user.id, companyId: t.companyId, entityId: t.id, action: "ticket.estimate_proposed", details: { minutes: input.hours } })
        .returning({ id: auditEvents.id });
      await enqueueTicketNotice(tx, event.id, row, actor.user.name, "Estimativa para aprovar", null, `A equipe estimou esta melhoria em ${hoursLabel(input.hours)} do seu banco. Um Administrador da empresa aprova ou recusa no Console antes de o trabalho começar.`);
    });
    scheduleTicketNotices();
    revalidatePath(`/chamados/${input.ticketId}`);
    return { success: "Estimativa enviada ao cliente." };
  } catch (e) {
    return failure(e);
  }
}

/** The client's Administrador approves or declines an improvement's estimate (decideEstimateAs). */
export async function decideEstimate(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z
      .object({ ticketId: id, decision: z.enum(["approve", "decline"]), minutes: z.coerce.number().int().min(1) })
      .parse(Object.fromEntries(form));
    return await decideEstimateAs(actor, input);
  } catch (e) {
    return failure(e);
  }
}

/** The client's Administrador approves hours beyond this month's bank (SUP 4.3). */
export async function approveOverage(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z.object({ companyId: id, hours: hoursInput }).parse(Object.fromEntries(form));
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

/** The team sends the month's report to the company's Administradores, by click (SUP 4.7). */
export async function sendHoursReport(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ companyId: id, month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(Object.fromEntries(form));
    const result = await deliverHoursReport(input.companyId, input.month, { actorId: actor.user.id });
    if (!result) return { error: "Esta empresa não tem banco de horas." };
    if (result.failed) return { error: "O e-mail do relatório não saiu para nenhum Administrador. Nada foi registrado; tente de novo." };
    refresh(input.companyId);
    return {
      success: result.sent
        ? `Relatório enviado a ${result.sent === 1 ? "1 Administrador" : `${result.sent} Administradores`}.`
        : "Relatório registrado, mas a empresa não tem Administrador para receber o e-mail.",
    };
  } catch (e) {
    return failure(e);
  }
}

/** The team tells the company's Administradores that this month's bank reached the alert line (SUP 4.4), once a month. */
export async function sendBankAlert(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const companyId = id.parse(form.get("companyId"));
    const result = await deliverBankAlert(companyId, { actorId: actor.user.id });
    if (!result) return { error: "Esta empresa não tem banco de horas." };
    refresh(companyId);
    if (result.already) return { error: `O aviso deste mês já foi enviado em ${dateLabel(result.already)}.` };
    return { success: result.sent ? "Aviso enviado." : "A empresa não tem Administrador para receber o aviso." };
  } catch (e) {
    return failure(e);
  }
}

/** The client's Administrador contests the month's report within the contract's window (SUP 4.7). */
export async function contestHoursReport(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z
      .object({ companyId: id, month: z.string().regex(/^\d{4}-\d{2}$/), note: z.string().trim().min(5, "Conte o que não confere.").max(2000) })
      .parse(Object.fromEntries(form));
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
