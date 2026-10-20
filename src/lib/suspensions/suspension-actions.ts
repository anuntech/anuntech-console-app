"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, catalogItems, engagementSuspensions, engagements } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { dateLabel } from "../format";
import { companyDebt, sendSuspensionMail, suspensionPolicy } from "./suspensions";
import { SUSPENSION_REASONS, liftSteps, suspendSteps, suspensionKindOf, suspensionRefusal } from "./suspension-rules";

/*
 * Suspending a product or service, for the team only. It is scheduled with a
 * notice when the conditions ask for one, confirmed by a person on the day
 * (never on its own), and lifted by a person. The client keeps the Console to
 * pay and open tickets; the product is blocked at the product, step by step.
 */

const blocked = { error: "Você não tem permissão para fazer isso." };
const uuid = z.string().uuid();

function refresh() {
  revalidatePath("/produtos");
  revalidatePath("/painel", "layout");
  revalidatePath("/financeiro/atrasos");
  revalidatePath("/empresas");
}

function failure(scope: string, error: unknown): ActionState {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  // Two tabs, or a double click, on the same product.
  if (typeof cause === "object" && cause !== null && "constraint" in cause && cause.constraint === "console_engagement_suspension_open_unique")
    return { error: "Este produto já tem uma suspensão em aberto." };
  if (logDatabaseFault(scope, error)) return { error: DATABASE_FAILURE };
  return { error: error instanceof Error && error.message ? error.message : "Não foi possível concluir agora." };
}

/** An open suspension and its product, or null. */
async function openSuspension(id: string) {
  const [row] = await db
    .select({ s: engagementSuspensions, status: engagements.status, kind: catalogItems.suspensionKind })
    .from(engagementSuspensions)
    .innerJoin(engagements, eq(engagements.id, engagementSuspensions.engagementId))
    .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
    .where(and(eq(engagementSuspensions.id, id), isNull(engagementSuspensions.liftedAt)));
  return row ?? null;
}

const notified = (sent: number, what: string) =>
  sent ? ` ${what} foi por e-mail para ${sent === 1 ? "1 contato" : `${sent} contatos`}.` : ` ${what} não saiu: nenhum contato com e-mail recebeu. Envie por outro canal.`;

/** "Suspender…": schedules it (and sends the notice) or, dated today, suspends now. */
export async function prepareSuspension(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const parsed = z
    .object({
      engagementId: uuid,
      reason: z.enum(SUSPENSION_REASONS),
      date: z.iso.date("Escolha a data da suspensão."),
      note: z.string().trim().max(1000).default(""),
      notify: z.literal("yes").optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const today = saoPauloDate();
  try {
    const [engagement] = await db.select().from(engagements).where(eq(engagements.id, input.engagementId));
    if (!engagement || engagement.kind === "project") return { error: "Produto não encontrado." };
    if (engagement.status !== "active") return { error: "Só um produto ativo pode ser suspenso." };
    const [debt, policy] = await Promise.all([companyDebt(engagement.companyId, today), suspensionPolicy(engagement.companyId, engagement.id)]);
    const now = input.date === today;
    // A future date leaves time for the notice; it is checked again when the team confirms.
    const refusal = suspensionRefusal({
      reason: input.reason,
      date: input.date,
      today,
      policy: now ? policy : policy && { ...policy, notice: false },
      oldestDueDate: debt.oldestDueDate,
      note: input.note,
      noticedOn: null,
    });
    if (refusal) return { error: refusal };
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(engagementSuspensions)
        .values({
          engagementId: engagement.id,
          companyId: engagement.companyId,
          reason: input.reason,
          note: input.note || null,
          scheduledFor: input.date,
          suspendedAt: now ? new Date() : null,
          actorId: actor.user.id,
        })
        .returning();
      if (now) {
        const [moved] = await tx
          .update(engagements)
          .set({ status: "suspended" })
          .where(and(eq(engagements.id, engagement.id), eq(engagements.status, "active")))
          .returning({ id: engagements.id });
        if (!moved) throw Error("O produto mudou de situação. Atualize a página.");
      }
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: engagement.companyId,
        entityId: engagement.id,
        action: now ? "suspension.suspended" : "suspension.scheduled",
        details: { suspensionId: row.id, reason: input.reason, date: input.date, clause: policy?.clause ?? null },
      });
      return row;
    });
    let message = now ? "Produto suspenso. Siga os passos de bloqueio na suspensão." : `Suspensão agendada para ${dateLabel(input.date)}.`;
    if (input.notify) {
      const sent = await sendSuspensionMail(now ? "suspended" : "notice", created.id);
      if (sent && !now) await db.update(engagementSuspensions).set({ noticeSentAt: new Date() }).where(eq(engagementSuspensions.id, created.id));
      message += notified(sent, now ? "O aviso de suspensão" : "O aviso");
    }
    refresh();
    return { success: message };
  } catch (e) {
    return failure("prepareSuspension", e);
  }
}

/** On the day: the team confirms and the product is suspended. */
export async function confirmSuspension(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const parsed = z.object({ id: uuid, notify: z.literal("yes").optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Suspensão não encontrada." };
  const today = saoPauloDate();
  try {
    const row = await openSuspension(parsed.data.id);
    if (!row || row.s.suspendedAt) return { error: "Esta suspensão já foi feita ou cancelada. Atualize a página." };
    const { s } = row;
    if (s.scheduledFor && s.scheduledFor > today) return { error: `Agendada para ${dateLabel(s.scheduledFor)}. Confirme nesse dia.` };
    const [debt, policy] = await Promise.all([companyDebt(s.companyId, today), suspensionPolicy(s.companyId, s.engagementId)]);
    const refusal = suspensionRefusal({
      reason: s.reason,
      date: today,
      today,
      policy,
      oldestDueDate: debt.oldestDueDate,
      // Written when it was scheduled; checked again in case the conditions changed.
      note: s.note ?? "",
      noticedOn: s.noticeSentAt ? saoPauloDate(s.noticeSentAt) : null,
    });
    if (refusal) return { error: refusal };
    await db.transaction(async (tx) => {
      const [moved] = await tx
        .update(engagements)
        .set({ status: "suspended" })
        .where(and(eq(engagements.id, s.engagementId), eq(engagements.status, "active")))
        .returning({ id: engagements.id });
      if (!moved) throw Error("O produto não está ativo. Cancele a suspensão ou reative o produto antes.");
      const [done] = await tx
        .update(engagementSuspensions)
        .set({ suspendedAt: new Date() })
        .where(and(eq(engagementSuspensions.id, s.id), isNull(engagementSuspensions.suspendedAt), isNull(engagementSuspensions.liftedAt)))
        .returning({ id: engagementSuspensions.id });
      if (!done) throw Error("Esta suspensão já foi feita ou cancelada. Atualize a página.");
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: s.companyId,
        entityId: s.engagementId,
        action: "suspension.suspended",
        details: { suspensionId: s.id, reason: s.reason },
      });
    });
    let message = "Produto suspenso. Siga os passos de bloqueio.";
    if (parsed.data.notify) message += notified(await sendSuspensionMail("suspended", s.id), "O aviso de suspensão");
    refresh();
    return { success: message };
  } catch (e) {
    return failure("confirmSuspension", e);
  }
}

/** Calls off a schedule before it happens. */
export async function cancelSuspension(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const parsed = z.object({ id: uuid, note: z.string().trim().max(1000).default("") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Suspensão não encontrada." };
  try {
    const row = await openSuspension(parsed.data.id);
    if (!row) return { error: "Esta suspensão já foi encerrada. Atualize a página." };
    if (row.s.suspendedAt) return { error: "O produto já está suspenso. Use Reativar." };
    await db.transaction(async (tx) => {
      const [done] = await tx
        .update(engagementSuspensions)
        .set({ liftedAt: new Date(), liftReason: "cancelled", liftNote: parsed.data.note || null })
        .where(and(eq(engagementSuspensions.id, row.s.id), isNull(engagementSuspensions.suspendedAt), isNull(engagementSuspensions.liftedAt)))
        .returning({ id: engagementSuspensions.id });
      if (!done) throw Error("Esta suspensão mudou. Atualize a página.");
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.s.companyId,
        entityId: row.s.engagementId,
        action: "suspension.cancelled",
        details: { suspensionId: row.s.id, note: parsed.data.note || null },
      });
    });
    refresh();
    return { success: "Suspensão cancelada." };
  } catch (e) {
    return failure("cancelSuspension", e);
  }
}

/** "Reativar": the product comes back. While the client still owes, the team writes why. */
export async function liftSuspension(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const parsed = z
    .object({ id: uuid, note: z.string().trim().max(1000).default(""), notify: z.literal("yes").optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Suspensão não encontrada." };
  const input = parsed.data;
  try {
    const row = await openSuspension(input.id);
    if (!row) return { error: "Esta suspensão já foi encerrada. Atualize a página." };
    const { s } = row;
    if (!s.suspendedAt) return { error: "O produto ainda não foi suspenso. Use Cancelar suspensão." };
    const owing = s.reason === "overdue" && (await companyDebt(s.companyId)).invoices.length > 0;
    // The unblocking steps the person ticked in the dialog, recorded with the reactivation.
    const by = { at: new Date().toISOString(), by: actor.user.name || actor.user.email };
    const kind = suspensionKindOf(row.kind);
    const ticked = form.getAll("liftStep").filter((key) => liftSteps[kind].some((step) => step.key === key));
    const steps = { ...s.steps, ...Object.fromEntries(ticked.map((key) => [key as string, by])) };
    if ((owing || s.reason !== "overdue") && input.note.length < 10)
      return { error: owing ? "O cliente ainda tem fatura vencida. Explique por que reativar." : "Conte o que foi resolvido para reativar." };
    await db.transaction(async (tx) => {
      const [done] = await tx
        .update(engagementSuspensions)
        .set({ liftedAt: new Date(), liftReason: s.reason === "overdue" && !owing ? "paid" : "manual", liftNote: input.note || null, steps })
        .where(and(eq(engagementSuspensions.id, s.id), isNull(engagementSuspensions.liftedAt)))
        .returning({ id: engagementSuspensions.id });
      if (!done) throw Error("Esta suspensão já foi encerrada. Atualize a página.");
      await tx.update(engagements).set({ status: "active" }).where(and(eq(engagements.id, s.engagementId), eq(engagements.status, "suspended")));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: s.companyId,
        entityId: s.engagementId,
        action: "suspension.lifted",
        details: { suspensionId: s.id, owing, note: input.note || null },
      });
    });
    let message = "Produto reativado. Siga os passos para liberar o acesso.";
    if (input.notify) message += notified(await sendSuspensionMail("lifted", s.id), "O aviso de reativação");
    refresh();
    return { success: message };
  } catch (e) {
    return failure("liftSuspension", e);
  }
}

/** The notice went out by another channel (WhatsApp, a call): recorded so the suspension can be confirmed. */
export async function recordSuspensionNotice(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const parsed = z.object({ id: uuid, note: z.string().trim().min(3, "Conte por onde o aviso foi.").max(500) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const row = await openSuspension(parsed.data.id);
    if (!row || row.s.suspendedAt) return { error: "Esta suspensão já foi feita ou encerrada. Atualize a página." };
    await db.transaction(async (tx) => {
      await tx.update(engagementSuspensions).set({ noticeSentAt: new Date() }).where(eq(engagementSuspensions.id, row.s.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.s.companyId,
        entityId: row.s.engagementId,
        action: "suspension.notice_recorded",
        details: { suspensionId: row.s.id, note: parsed.data.note },
      });
    });
    refresh();
    return { success: "Aviso registrado." };
  } catch (e) {
    return failure("recordSuspensionNotice", e);
  }
}

/** One step of the blocking (or unblocking) checklist, done or undone. */
export async function setSuspensionStep(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const parsed = z.object({ id: uuid, step: z.string().min(1).max(40), done: z.enum(["yes", "no"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Passo não encontrado." };
  const { id, step, done } = parsed.data;
  try {
    // A lifted suspension keeps its unblocking steps open until the team ticks them.
    const [row] = await db
      .select({ s: engagementSuspensions, kind: catalogItems.suspensionKind })
      .from(engagementSuspensions)
      .innerJoin(engagements, eq(engagements.id, engagementSuspensions.engagementId))
      .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
      .where(eq(engagementSuspensions.id, id));
    if (!row) return { error: "Suspensão não encontrada." };
    const kind = suspensionKindOf(row.kind);
    if (![...suspendSteps[kind], ...liftSteps[kind]].some((s) => s.key === step)) return { error: "Passo não encontrado." };
    const value = { at: new Date().toISOString(), by: actor.user.name || actor.user.email };
    await db.transaction(async (tx) => {
      await tx
        .update(engagementSuspensions)
        .set({ steps: done === "yes" ? sql`${engagementSuspensions.steps} || ${JSON.stringify({ [step]: value })}::jsonb` : sql`${engagementSuspensions.steps} - ${step}` })
        .where(eq(engagementSuspensions.id, id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.s.companyId,
        entityId: row.s.engagementId,
        action: "suspension.step",
        details: { suspensionId: id, step, done: done === "yes" },
      });
    });
    refresh();
    return { success: done === "yes" ? "Passo marcado." : "Passo desmarcado." };
  } catch (e) {
    return failure("setSuspensionStep", e);
  }
}
