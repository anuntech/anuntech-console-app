"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, companies, hoursMonths, tickets, timeEntries } from "@/db/schema";
import { canAccess, getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { dateLabel } from "../format";
import { companyAdministrators, sendClientMail } from "../notifications/client-mail";
import { sendOpsMail } from "../notifications/ops-alerts";
import { enqueueTicketNotice, scheduleTicketNotices } from "../tickets/ticket-notifications";
import { bankMonth, bankTerms, hoursLabel, monthOf } from "./hours-bank";

/*
 * The hours bank of a support contract (SUP 3.1 to 3.4, 4.1): the team logs
 * hours, the client's Administrador approves what goes beyond the bank and
 * the estimate of each improvement, and the month's report can be contested.
 * Nothing here e-mails on its own; the report and the 80% notice go when the
 * team clicks.
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
  error: e instanceof z.ZodError ? e.issues[0].message : e instanceof Error && e.message ? e.message : "Não foi possível salvar.",
});
const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";
/** The company's Administrador (or the team) answers for it. */
const answersFor = (actor: Awaited<ReturnType<typeof getActor>>, companyId: string) => !actor.admin && canAccess(actor, companyId, "finance");

function refresh(companyId: string, ticketId?: string | null) {
  revalidatePath(`/empresas/${companyId}`);
  revalidatePath("/painel");
  if (ticketId) revalidatePath(`/chamados/${ticketId}`);
}

/** The team logs work. Bank hours never go past what the client has approved, except a critical fix (SUP 3.3). */
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
      // An improvement uses the bank only with its estimate approved (SUP 4.1).
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

/** The team proposes how many bank hours an improvement takes (SUP 4.1); the client approves before work starts. */
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
        throw Error(`Acima de ${hoursLabel(limit)} a melhoria vai por orçamento (SUP 4.2). Crie um orçamento para este pedido.`);
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

/** The client's Administrador approves or declines an improvement's estimate. */
export async function decideEstimate(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z
      .object({ ticketId: id, decision: z.enum(["approve", "decline"]), minutes: z.coerce.number().int().min(1) })
      .parse(Object.fromEntries(form));
    const [t] = await db.select().from(tickets).where(eq(tickets.id, input.ticketId));
    if (!t || !answersFor(actor, t.companyId)) return { error: "Só um Administrador da empresa aprova estimativas." };
    const approved = input.decision === "approve";
    // The answer is to the estimate the person saw: a newer one in between is not approved by accident.
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
  } catch (e) {
    return failure(e);
  }
}

/** The client's Administrador approves hours beyond this month's bank (SUP 3.3). */
export async function approveOverage(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z.object({ companyId: id, hours: hoursInput }).parse(Object.fromEntries(form));
    if (!answersFor(actor, input.companyId)) return { error: "Só um Administrador da empresa aprova horas além do banco." };
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

/** The team sends the month's report to the company's Administradores, by click (SUP 3.4). */
export async function sendHoursReport(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ companyId: id, month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(Object.fromEntries(form));
    const data = await bankMonth(input.companyId, input.month);
    if (!data) return { error: "Esta empresa não tem banco de horas." };
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, input.companyId));
    const lines = data.entries
      .map((e) => `- ${dateLabel(e.workedOn)} · ${hoursLabel(e.minutes)}${e.kind === "warranty" ? " (garantia, fora do banco)" : e.kind === "critical" ? " (defeito crítico)" : ""} · ${e.note}${e.ticket ? ` · ${e.ticket}` : ""}`)
      .join("\n");
    const contest = data.reportContestDays
      ? `\n\nVocê pode contestar este relatório no Console em até ${data.reportContestDays} dias úteis. Sem contestação, ele conta como aprovado.`
      : "";
    let sent = 0;
    for (const person of await companyAdministrators(input.companyId)) {
      try {
        await sendClientMail({
          to: person.email,
          tag: "hours-report",
          subject: `Banco de horas de ${input.month}: ${company?.name ?? ""}`,
          text: `Relatório do banco de horas de ${input.month}.\n\nUsado: ${hoursLabel(data.usedMinutes)} de ${hoursLabel(data.includedMinutes)} incluídas${data.overageApprovedMinutes ? `, com até ${hoursLabel(data.overageApprovedMinutes)} além do banco aprovadas` : ""}.\n\n${lines || "Nenhum registro no mês."}${contest}\n\nVeja no Console: ${consoleUrl()}/painel\n\nAnuntech`,
        });
        sent += 1;
      } catch {
        /* The report stays in the Console. */
      }
    }
    const now = new Date();
    await db
      .insert(hoursMonths)
      .values({ companyId: input.companyId, month: input.month, reportSentAt: now, reportSentBy: actor.user.id })
      .onConflictDoUpdate({ target: [hoursMonths.companyId, hoursMonths.month], set: { reportSentAt: now, reportSentBy: actor.user.id, updatedAt: now } });
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: input.companyId, entityId: input.companyId, action: "hours.report_sent", details: { month: input.month, sent } });
    refresh(input.companyId);
    return { success: sent ? `Relatório enviado a ${sent === 1 ? "1 Administrador" : `${sent} Administradores`}.` : "Relatório registrado, mas a empresa não tem Administrador para receber o e-mail." };
  } catch (e) {
    return failure(e);
  }
}

/** The team tells the company's Administradores that this month's bank reached the alert line (SUP 3.3), by click. */
export async function sendBankAlert(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const companyId = id.parse(form.get("companyId"));
    const data = await bankMonth(companyId);
    if (!data) return { error: "Esta empresa não tem banco de horas." };
    let sent = 0;
    for (const person of await companyAdministrators(companyId)) {
      try {
        await sendClientMail({
          to: person.email,
          tag: "hours-alert",
          subject: `Banco de horas em ${Math.round((data.usedMinutes / data.includedMinutes) * 100)}%`,
          text: `O banco de horas deste mês está em ${hoursLabel(data.usedMinutes)} de ${hoursLabel(data.includedMinutes)}.\n\nFora a correção de um defeito crítico, nada passa do banco sem a aprovação de um Administrador da empresa. Se quiser que a equipe continue além dele, aprove as horas extras no Console: ${consoleUrl()}/painel\n\nAnuntech`,
        });
        sent += 1;
      } catch {
        /* The notice stays in the Console. */
      }
    }
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId, entityId: companyId, action: "hours.alert_sent", details: { month: data.month, sent } });
    return { success: sent ? "Aviso enviado." : "A empresa não tem Administrador para receber o aviso." };
  } catch (e) {
    return failure(e);
  }
}

/** The client's Administrador contests the month's report within the contract's window (SUP 3.4). */
export async function contestHoursReport(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z
      .object({ companyId: id, month: z.string().regex(/^\d{4}-\d{2}$/), note: z.string().trim().min(5, "Conte o que não confere.").max(2000) })
      .parse(Object.fromEntries(form));
    if (!answersFor(actor, input.companyId)) return { error: "Só um Administrador da empresa contesta o relatório." };
    const [record] = await db.select().from(hoursMonths).where(and(eq(hoursMonths.companyId, input.companyId), eq(hoursMonths.month, input.month)));
    if (!record?.reportSentAt) return { error: "O relatório deste mês ainda não foi enviado." };
    if (record.contestedAt) return { error: "Este relatório já foi contestado." };
    // Past the contract's window the report counts as approved (SUP 3.4).
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
