"use server";
import { prepareTicketFiles } from "./tickets/ticket-files";
import { replyToTicket } from "./tickets/ticket-reply";
import { openTicket, ticketInput } from "./tickets/ticket-create";
import { z } from "zod";
import { and, eq, inArray, ne, or, sql, isNull } from "drizzle-orm";
import { chargeSourceEvent, chargeSourceKinds, preparedChargeEvents } from "./billing/charge-sources";
import { releasePreparedCharges } from "./billing/prepared-release";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { resolveBankDueDate } from "./billing/billing-notice-rules";
import { saoPauloDate } from "./dates";
import { getActor, canAccess } from "./access/access";
import {
  companies,
  engagements,
  engagementSuspensions,
  tickets,
  invoices,
  subscriptions,
  auditEvents,
  automationEvents,
  quotes,
  contracts,
  memberships,
  journeys,
} from "@/db/schema";
import { expiredDebtCondition } from "./billing/billing-watch";
import { lockEnvironmentAssignments } from "./access/environment-access";
import { overageCharge } from "./service-terms/hours-delivery";
import { normalizeEmail, moneyToCents } from "./access/permissions";
import { parseChargeTerms, parseTermsScope } from "./billing/billing-terms";
import type { ActionState } from "./action-state";
import { saveCompanyMember, revokeCompanyMember } from "./access/members-actions";
import {
  enqueueTicketNotice,
  ticketOpener,
  scheduleTicketNotices,
} from "./tickets/ticket-notifications";
import { dueLabel, priorityLabels, ticketLabels } from "./format";
import { enqueuePush, schedulePushNotices } from "./notifications/push-queue";
import { loadCalendar } from "./service-terms/terms";
import { pauseToAdd, ticketDues, visibleToClient } from "./service-terms/ticket-clock";
import { addBusinessMinutes } from "./service-terms/business-calendar";
import { BUSINESS_DAY_MINUTES } from "./service-terms/terms-model";
import { teamMemberName } from "./account/account-identity";
import { companyIdentity } from "./companies/company-input";
import { companyBillingInput } from "./companies/company-billing";
const id = z.string().uuid();
function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
const str = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Preencha os campos obrigatórios.")
    .max(max, "O texto excede o tamanho permitido.");
const mail = z.email("Informe um e-mail válido.").transform(normalizeEmail);
const failure = (error: unknown): ActionState => {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === "console_companies_document_unique"
  )
    return { error: "Este CPF/CNPJ já está cadastrado em outra empresa." };
  return {
    error:
      error instanceof z.ZodError
        ? error.issues[0].message
        : "Não foi possível salvar. Confira os dados e tente novamente.",
  };
};
const blocked = { error: "Você não tem permissão para fazer isso." };
function refresh() {
  revalidatePath("/painel", "layout");
  revalidatePath("/empresas");
  revalidatePath("/produtos");
  revalidatePath("/projetos");
  revalidatePath("/chamados");
  revalidatePath("/financeiro");
}
export async function createCompany(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = companyIdentity.parse(Object.fromEntries(form));
    // Started from a project journey ("Cadastrar empresa"): the new company is linked to it, and the team goes back there.
    const journeyId = z.union([z.string().uuid(), z.literal("")]).catch("").parse(form.get("journeyId") ?? "");
    const { company, journey } = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(companies)
        .values({ ...input, ...companyBillingInput(form) })
        .returning();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.id,
        action: "company.created",
        entityId: row.id,
      });
      const [linked] = journeyId
        ? await tx
            .update(journeys)
            .set({ companyId: row.id, updatedAt: new Date() })
            .where(and(eq(journeys.id, journeyId), isNull(journeys.companyId)))
            .returning({ id: journeys.id, title: journeys.title })
        : [];
      if (linked)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: row.id,
          entityId: linked.id,
          action: "journey.linked",
          details: { journey: linked.title, kind: "company", recordId: row.id, label: row.name },
        });
      return { company: row, journey: linked ?? null };
    });
    refresh();
    if (journey) revalidatePath(`/jornadas/${journey.id}`);
    return { success: "Empresa cadastrada.", href: journey ? `/jornadas/${journey.id}` : `/empresas/${company.id}` };
  } catch (e) {
    return failure(e);
  }
}
export async function saveMembership(
  previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return saveCompanyMember(previous, form);
}
export async function revokeMembership(
  previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return revokeCompanyMember(previous, form);
}
export async function createEngagement(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        companyId: id,
        name: str(160),
        kind: z.enum(["product", "project"]),
        description: z.string().trim().max(3000),
        url: z.string().trim().max(2048).default(""),
      })
      .parse(Object.fromEntries(form));
    if (input.url && !isWebUrl(input.url))
      return { error: "Informe um link HTTP ou HTTPS válido." };
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(engagements)
        .values({
          ...input,
          description: input.description || null,
          url: input.kind === "product" && input.url ? input.url : null,
        })
        .returning();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "engagement.created",
        entityId: row.id,
      });
      return row;
    });
    refresh();
    return {
      success: input.kind === "project" ? "Projeto criado." : "Produto cadastrado.",
      href: input.kind === "project" ? `/projetos/${created.id}` : "/produtos",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function updateEngagement(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({ id, status: z.enum(["active", "paused", "completed"]), pauseBilling: z.literal("yes").optional() })
      .parse(Object.fromEntries(form));
    const [current] = await db.select({ status: engagements.status }).from(engagements).where(eq(engagements.id, input.id));
    if (current?.status === "suspended") return { error: "Produto suspenso: reative pela suspensão, no menu do produto." };
    const pausedBilling = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(engagements)
        .set({ status: input.status })
        // A suspended product comes back only through its suspension (lib/suspensions).
        .where(and(eq(engagements.id, input.id), ne(engagements.status, "suspended")))
        .returning();
      if (!row) throw Error();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "engagement.status_changed",
        entityId: row.id,
        details: { status: row.status },
      });
      // A service that stopped should not keep billing: the person chose to pause its recurrence too.
      // Linked either way: the catalog writes engagements.subscription_id, Nova cobrança only subscriptions.engagement_id.
      if (input.status === "active" || !input.pauseBilling) return false;
      const paused = await tx
        .update(subscriptions)
        .set({ status: "paused", lastError: input.status === "completed" ? "Pausada ao concluir o serviço." : "Pausada junto com o serviço." })
        .where(
          and(
            eq(subscriptions.status, "active"),
            eq(subscriptions.companyId, row.companyId),
            or(eq(subscriptions.engagementId, row.id), row.subscriptionId ? eq(subscriptions.id, row.subscriptionId) : undefined),
          ),
        )
        .returning({ id: subscriptions.id });
      for (const sub of paused)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: row.companyId,
          action: "subscription.status_changed",
          entityId: sub.id,
          details: { status: "paused", reason: "engagement" },
        });
      return paused.length;
    });
    refresh();
    return {
      success: !pausedBilling
        ? "Situação atualizada."
        : pausedBilling === 1
          ? "Situação atualizada. A cobrança recorrente ficou pausada."
          : `Situação atualizada. ${pausedBilling} cobranças recorrentes ficaram pausadas.`,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function createTicket(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = ticketInput.parse(Object.fromEntries(form));
    if (!canAccess(actor, input.companyId, "support")) return blocked;
    let files: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try { files = await prepareTicketFiles(form.getAll("files")); }
    catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível ler os anexos. Selecione os arquivos de novo." }; }
    const ticket = await openTicket(actor, input, { files, uploadIds: form.getAll("uploadId").map(String) });
    refresh();
    return { success: "Chamado aberto.", href: `/chamados/${ticket.id}` };
  } catch (e) {
    return failure(e);
  }
}
export async function replyTicket(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z
      .object({
        ticketId: id,
        body: z
          .string()
          .trim()
          .max(10000, "O texto excede o tamanho permitido.")
          .default(""),
      })
      .parse(Object.fromEntries(form));
    let direct: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try {
      direct = await prepareTicketFiles([
        ...form.getAll("files"),
        ...form.getAll("file"),
      ]);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Não foi possível ler os anexos. Selecione os arquivos de novo.",
      };
    }
    const result = await replyToTicket(actor, {
      ...input,
      files: direct,
      uploadIds: form.getAll("uploadId").map(String),
    });
    if ("success" in result) refresh();
    return result;
  } catch (e) {
    return failure(e);
  }
}
export async function updateTicket(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    // Each field is optional so menus can move one thing at a time.
    const input = z
      .object({
        ticketId: id,
        status: z
          .enum(["open", "in_progress", "waiting_customer", "resolved", "closed"])
          .optional(),
        priority: z.enum(["critical", "high", "normal"]).optional(),
        assignedTo: z.union([mail, z.literal("")]).optional(),
        /** What the team needs from the client; required to wait for them. */
        waitingFor: z.string().trim().max(500, "Use até 500 caracteres para o que falta.").optional(),
        /** A line for the client's notice of this move (resolved for no reply). */
        notice: z.string().trim().max(300).optional(),
      })
      .parse(Object.fromEntries(form));
    const now = new Date();
    const failed = await db.transaction(async (tx) => {
      const [previous] = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.id, input.ticketId))
        .for("update");
      if (!previous) throw Error();
      const next = {
        status: input.status ?? previous.status,
        priority: input.priority ?? previous.priority,
        assignedTo:
          input.assignedTo === undefined
            ? previous.assignedTo
            : input.assignedTo || null,
      };
      const waiting = next.status === "waiting_customer";
      const waitingFor = waiting ? (input.waitingFor ?? previous.waitingFor ?? "").trim() || null : null;
      // Asked when the wait starts; a ticket already waiting keeps moving from the menus.
      if (waiting && !waitingFor && previous.status !== "waiting_customer")
        return "Diga ao cliente o que falta para a equipe continuar.";
      if (
        previous.status === next.status &&
        previous.priority === next.priority &&
        previous.assignedTo === next.assignedTo &&
        (!waiting || waitingFor === previous.waitingFor)
      )
        return;
      const cal = previous.terms ? await loadCalendar(tx) : null;
      // Leaving the wait adds it to the pause; a new priority moves the deadlines; entering it starts the wait.
      const leaving = previous.status === "waiting_customer" && !waiting;
      const pausedMinutes =
        leaving && cal ? previous.pausedMinutes + pauseToAdd(previous.terms, previous.waitingSince, now, cal) : previous.pausedMinutes;
      const dues =
        cal && (leaving || previous.priority !== next.priority)
          ? ticketDues({ ...previous, priority: next.priority, pausedMinutes }, cal)
          : {};
      const [row] = await tx
        .update(tickets)
        .set({
          ...next,
          waitingFor,
          waitingSince: waiting ? (previous.status === "waiting_customer" ? previous.waitingSince : now) : null,
          pausedMinutes,
          ...dues,
          // Asking the client, resolving or closing answers the ticket too.
          firstResponseAt:
            previous.firstResponseAt ?? (["waiting_customer", "resolved", "closed"].includes(next.status) && next.status !== previous.status ? now : null),
          updatedAt: now,
        })
        .where(eq(tickets.id, input.ticketId))
        .returning();
      if (!row) throw Error();
      const [event] = await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: row.companyId,
          action: "ticket.updated",
          entityId: row.id,
          details: {
            status: row.status,
            priority: row.priority,
            assignedTo: row.assignedTo,
          },
        })
        .returning({ id: auditEvents.id });
      const asking = row.status === "waiting_customer" && (previous.status !== row.status || row.waitingFor !== previous.waitingFor);
      const changes = [
        ...(asking ? ["A equipe precisa de você"] : []),
        ...(previous.status !== row.status && !asking
          ? [
              row.status === "closed"
                ? "Chamado encerrado"
                : row.status === "resolved"
                  ? "Chamado resolvido"
                  : previous.status === "closed"
                    ? `Chamado reaberto: ${ticketLabels[row.status]}`
                    : `Situação alterada: ${ticketLabels[row.status]}`,
            ]
          : []),
        ...(previous.priority !== row.priority
          ? [`Prioridade: ${priorityLabels[row.priority]}`]
          : []),
        ...(previous.assignedTo !== row.assignedTo
          ? [`Responsável: ${(await teamMemberName(row.assignedTo, tx)) ?? "não atribuído"}`]
          : []),
      ];
      const terms = row.terms && visibleToClient(row.terms, now) ? row.terms : null;
      await enqueueTicketNotice(
        tx,
        event.id,
        row,
        actor.user.name,
        changes.join(" · "),
        await ticketOpener(tx, row, actor.user.email),
        asking
          ? [
              `O que falta: ${row.waitingFor}`,
              terms?.policy.pausesWhileWaiting ? "O prazo da Anuntech fica pausado até você responder." : null,
              terms?.policy.clientResponseDays && !terms.personClient && cal
                ? `Responda até ${dueLabel(addBusinessMinutes(now, terms.policy.clientResponseDays * BUSINESS_DAY_MINUTES, cal), now)}.`
                : null,
            ]
              .filter(Boolean)
              .join("\n")
          : input.notice || null,
      );
      // The client's phones hear when the team needs them and when the ticket is resolved.
      const resolved = row.status === "resolved" && previous.status !== row.status;
      if (asking || resolved)
        await enqueuePush(tx, {
          event: asking ? "ticket.waiting" : "ticket.resolved",
          eventKey: event.id,
          companyId: row.companyId,
          entityId: row.id,
          engagementId: row.engagementId,
          authorId: row.authorId,
          actorId: actor.user.id,
        });
    });
    if (failed) return { error: failed };
    revalidatePath(`/chamados/${input.ticketId}`);
    refresh();
    scheduleTicketNotices();
    schedulePushNotices();
    return { success: "Chamado atualizado." };
  } catch (e) {
    return failure(e);
  }
}
export async function createInvoice(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        companyId: id,
        engagementId: z.union([id, z.literal("")]),
        description: str(1000),
        amount: str(20),
        dueDate: z.iso.date(),
        bankDueDate: z.union([z.iso.date(), z.literal("")]).default(""),
        billingType: z.enum(["one_time", "recurring"]).default("one_time"),
        interval: z.enum(["monthly", "yearly"]).default("monthly"),
        // What the Console prepared this charge from (new-invoice-context.ts).
        sourceKind: z.enum(chargeSourceKinds).optional(),
        // A record's id, or "<companyId>:<YYYY-MM>" for a month's hours beyond the bank.
        sourceId: z.union([id, z.string().regex(/^[0-9a-f-]{36}:\d{4}-\d{2}$/), z.literal("")]).default(""),
      })
      .parse(Object.fromEntries(form));
    const amountCents = moneyToCents(input.amount);
    if (amountCents === null)
      return {
        error: "Informe um valor entre R$ 0,01 e R$ 9.999.999,99.",
      };
    let terms;
    try {
      terms = parseChargeTerms(form, amountCents);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Confira o desconto, a multa e os juros." };
    }
    const bank = resolveBankDueDate(
      { dueDate: input.dueDate, bankDueDate: input.bankDueDate, recurring: input.billingType === "recurring" },
      saoPauloDate(),
    );
    if ("error" in bank) return { error: bank.error };
    const source = input.sourceKind && input.sourceId ? { kind: input.sourceKind, id: input.sourceId } : null;
    const invoice = await db.transaction(async (tx) => {
      let quoteId: string | null = null;
      if (source?.kind === "rebill") {
        // A debt is billed again once; the old charge stays as the record of what expired.
        const [debt] = await tx
          .select({ id: invoices.id, companyId: invoices.companyId, quoteId: invoices.quoteId })
          .from(invoices)
          .where(and(eq(invoices.id, source.id), sql`${expiredDebtCondition}`))
          .for("update");
        if (!debt || debt.companyId !== input.companyId)
          throw new Error("Esta dívida já foi cobrada de novo ou encerrada.");
        // An entrada or saldo billed again stays the proposal's.
        quoteId = debt.quoteId;
      } else if (source?.kind === "quote_upfront" || source?.kind === "quote_balance") {
        // The entrada and the saldo of an accepted proposal, each prepared once.
        const [quote] = await tx
          .select({ companyId: quotes.companyId, status: quotes.status })
          .from(quotes)
          .where(eq(quotes.id, source.id))
          .for("update");
        if (!quote || quote.companyId !== input.companyId || quote.status !== "accepted")
          throw new Error("A cobrança precisa partir de um orçamento aceito desta empresa.");
        quoteId = source.id;
      } else if (source?.kind === "overage") {
        const [companyId, month] = source.id.split(":");
        if (companyId !== input.companyId || !(await overageCharge(companyId, month)))
          throw new Error("Não há horas além do banco prontas para cobrar neste mês.");
      } else if (source?.kind === "contract") {
        const [contract] = await tx
          .select({ companyId: contracts.companyId, status: contracts.status, kind: contracts.kind })
          .from(contracts)
          .where(eq(contracts.id, source.id))
          .for("update");
        if (!contract || contract.companyId !== input.companyId || contract.status !== "signed" || contract.kind !== "contract")
          throw new Error("A cobrança precisa partir de um contrato assinado desta empresa.");
      }
      if (source && source.kind !== "rebill") {
        const [prepared] = await tx
          .select({ id: automationEvents.id })
          .from(automationEvents)
          .where(and(eq(automationEvents.kind, chargeSourceEvent[source.kind]), eq(automationEvents.entityId, source.id)));
        if (prepared) throw new Error("Esta cobrança já foi preparada. Abra a que existe pelo orçamento ou pelo contrato.");
      }
      if (input.engagementId) {
        const [eng] = await tx
          .select()
          .from(engagements)
          .where(
            and(
              eq(engagements.id, input.engagementId),
              eq(engagements.companyId, input.companyId),
            ),
          );
        if (!eng) throw Error();
      }
      let subscriptionId: string | null = null;
      if (input.billingType === "recurring") {
        const [sub] = await tx
          .insert(subscriptions)
          .values({
            companyId: input.companyId,
            engagementId: input.engagementId || null,
            description: input.description,
            amountCents,
            interval: input.interval,
            anchorDay: Number(input.dueDate.slice(8)),
            anchorMonth: Number(input.dueDate.slice(5, 7)),
            nextDueDate: input.dueDate,
            actorId: actor.user.id,
            ...terms,
          })
          .returning();
        subscriptionId = sub.id;
      }
      const [row] = await tx
        .insert(invoices)
        .values({
          companyId: input.companyId,
          subscriptionId,
          engagementId: input.engagementId || null,
          description: input.description,
          amountCents,
          dueDate: input.dueDate,
          bankDueDate: bank.bankDueDate,
          quoteId,
          ...terms,
        })
        .returning();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "invoice.drafted",
        entityId: row.id,
        details: source ? { source: source.kind, sourceId: source.id } : undefined,
      });
      // Whatever the debt was prepared from (an entrada, a contract's recurrence) now points at the charge that collects it.
      if (source?.kind === "rebill")
        await tx
          .update(automationEvents)
          .set({ details: sql`jsonb_set(${automationEvents.details}, '{invoiceId}', to_jsonb(${row.id}::text))` })
          .where(
            and(
              inArray(automationEvents.kind, preparedChargeEvents.filter((kind) => kind !== chargeSourceEvent.rebill)),
              sql`${automationEvents.details}->>'invoiceId' = ${source.id}`,
            ),
          );
      if (source)
        await tx.insert(automationEvents).values({
          kind: chargeSourceEvent[source.kind],
          entityId: source.id,
          companyId: row.companyId,
          actorId: actor.user.id,
          details: { invoiceId: row.id, subscriptionId },
        });
      return row;
    });
    refresh();
    return {
      success: "Rascunho criado. Nenhuma cobrança foi emitida.",
      href: `/financeiro/${invoice.id}`,
    };
  } catch (e) {
    return failure(e);
  }
}
export async function cancelDraft(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const invoiceId = id.parse(form.get("id"));
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(invoices.id, invoiceId),
            eq(invoices.status, "draft"),
            isNull(invoices.bankRequest),
          ),
        )
        .returning();
      if (!row) throw Error();
      if (row.subscriptionId)
        await tx
          .update(subscriptions)
          .set({
            status: "paused",
            lastError:
              "Fatura do período cancelada. Revise o próximo vencimento.",
          })
          .where(eq(subscriptions.id, row.subscriptionId));
      // A draft prepared from a debt, a proposal or a contract gives that source back, to be prepared again.
      await releasePreparedCharges(tx, row.id);
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "invoice.draft_cancelled",
        entityId: row.id,
      });
    });
    revalidatePath(`/financeiro/${invoiceId}`);
    refresh();
    return { success: "Rascunho cancelado." };
  } catch (e) {
    return failure(e);
  }
}
export async function updateDraft(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        id,
        description: str(1000),
        amount: str(20),
        dueDate: z.iso.date(),
        bankDueDate: z.union([z.iso.date(), z.literal("")]).default(""),
      })
      .parse(Object.fromEntries(form));
    const amountCents = moneyToCents(input.amount);
    if (amountCents === null)
      return { error: "Informe um valor entre R$ 0,01 e R$ 9.999.999,99." };
    let terms;
    try {
      terms = parseChargeTerms(form, amountCents);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Confira o desconto, a multa e os juros." };
    }
    const scope = parseTermsScope(form);
    const bank = resolveBankDueDate(
      { dueDate: input.dueDate, bankDueDate: input.bankDueDate, recurring: false },
      saoPauloDate(),
    );
    if ("error" in bank) return { error: bank.error };
    const changed = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({
          description: input.description,
          amountCents,
          dueDate: input.dueDate,
          bankDueDate: bank.bankDueDate,
          ...terms,
        })
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.status, "draft"),
            isNull(invoices.bankRequest),
          ),
        )
        .returning();
      if (!row) return false;
      if (row.subscriptionId) {
        if (bank.bankDueDate)
          throw new Error("Para uma recorrência, escolha um vencimento a partir de amanhã.");
        const [sub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, row.subscriptionId))
          .for("update");
        if (!sub || sub.status !== "draft")
          throw new Error(
            "A recorrência já foi ativada. Use Editar próximas cobranças para mudar os próximos períodos.",
          );
        await tx
          .update(subscriptions)
          .set({
            description: input.description,
            amountCents,
            nextDueDate: input.dueDate,
            anchorDay: Number(input.dueDate.slice(8)),
            anchorMonth: Number(input.dueDate.slice(5, 7)),
            ...(scope === "all" ? terms : {}),
          })
          .where(eq(subscriptions.id, sub.id));
        await tx
          .update(engagements)
          .set({ amountCents })
          .where(eq(engagements.subscriptionId, sub.id));
      }
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "invoice.draft_updated",
        entityId: row.id,
      });
      return true;
    });
    if (!changed)
      return { error: "Somente faturas em rascunho podem ser editadas." };
    revalidatePath("/produtos");
    revalidatePath(`/financeiro/${input.id}`);
    refresh();
    return { success: "Rascunho atualizado." };
  } catch (e) {
    return failure(e);
  }
}
/** Only the description: amount, due date and payer are already at the Inter. */
export async function updateIssuedDescription(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({ id, description: str(1000) })
      .parse(Object.fromEntries(form));
    const [row] = await db
      .update(invoices)
      .set({ description: input.description })
      .where(and(eq(invoices.id, input.id), eq(invoices.status, "issued")))
      .returning({ id: invoices.id, companyId: invoices.companyId });
    if (!row)
      return {
        error: "Somente faturas emitidas e em aberto podem ser editadas.",
      };
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: row.companyId,
      action: "invoice.description_updated",
      entityId: row.id,
    });
    revalidatePath(`/financeiro/${input.id}`);
    refresh();
    return {
      success:
        "Descrição atualizada. O boleto e o Pix já emitidos continuam válidos.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function updateCompany(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = companyIdentity
      .extend({ id })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ document: companies.document })
        .from(companies)
        .where(eq(companies.id, input.id))
        .for("update");
      if (!previous) throw Error();
      const [row] = await tx
        .update(companies)
        .set({
          name: input.name,
          document: input.document,
          billingEmail: input.billingEmail,
          phone: input.phone,
          ...companyBillingInput(form),
        })
        .where(eq(companies.id, input.id))
        .returning();
      if (!row) throw Error();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.id,
        action: "company.updated",
        entityId: row.id,
        details:
          previous.document !== row.document
            ? { document: { before: previous.document, after: row.document } }
            : null,
      });
    });
    revalidatePath(`/empresas/${input.id}`);
    refresh();
    return { success: "Cadastro atualizado." };
  } catch (e) {
    return failure(e);
  }
}

export async function setCompanyArchived(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        id,
        archived: z.enum(["yes", "no"]),
        // Winding down with the archive: only what the person ticked.
        pauseRecurrences: z.literal("yes").optional(),
        completeEngagements: z.literal("yes").optional(),
        revokeAccess: z.literal("yes").optional(),
      })
      .parse(Object.fromEntries(form));
    const archived = input.archived === "yes";
    const done: string[] = [];
    await db.transaction(async (tx) => {
      // Same lock as the members' own changes, taken first so the two never wait on each other.
      if (archived && input.revokeAccess) await lockEnvironmentAssignments(tx);
      const [row] = await tx
        .update(companies)
        .set({ archived })
        .where(
          and(eq(companies.id, input.id), eq(companies.archived, !archived)),
        )
        .returning();
      if (!row) return;
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.id,
        action: archived ? "company.archived" : "company.restored",
        entityId: row.id,
        details: archived ? { pauseRecurrences: !!input.pauseRecurrences, completeEngagements: !!input.completeEngagements, revokeAccess: !!input.revokeAccess } : undefined,
      });
      if (!archived) return;
      if (input.pauseRecurrences) {
        const paused = await tx
          .update(subscriptions)
          .set({ status: "paused", lastError: "Pausada ao arquivar o cliente." })
          .where(and(eq(subscriptions.companyId, row.id), eq(subscriptions.status, "active")))
          .returning({ id: subscriptions.id });
        for (const sub of paused)
          await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: row.id, action: "subscription.status_changed", entityId: sub.id, details: { status: "paused", reason: "company_archived" } });
        if (paused.length) done.push(paused.length === 1 ? "1 recorrência pausada" : `${paused.length} recorrências pausadas`);
      }
      if (input.completeEngagements) {
        const completed = await tx
          .update(engagements)
          .set({ status: "completed" })
          .where(and(eq(engagements.companyId, row.id), inArray(engagements.status, ["active", "paused", "suspended"])))
          .returning({ id: engagements.id });
        // A closed client has nothing left to suspend or bring back.
        await tx
          .update(engagementSuspensions)
          .set({ liftedAt: new Date(), liftReason: "archived" })
          .where(and(eq(engagementSuspensions.companyId, row.id), isNull(engagementSuspensions.liftedAt)));
        for (const item of completed)
          await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: row.id, action: "engagement.status_changed", entityId: item.id, details: { status: "completed", reason: "company_archived" } });
        if (completed.length) done.push(completed.length === 1 ? "1 vínculo concluído" : `${completed.length} vínculos concluídos`);
      }
      // Everyone leaves together, the last Administrador included: the "keep one manager" rule protects a company in use, not one being closed.
      if (input.revokeAccess) {
        const gone = await tx
          .update(memberships)
          .set({ active: false })
          .where(and(eq(memberships.companyId, row.id), eq(memberships.active, true)))
          .returning({ id: memberships.id, email: memberships.email });
        for (const member of gone)
          await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: row.id, action: "membership.revoked", entityId: member.id, details: { email: member.email, reason: "company_archived" } });
        if (gone.length) done.push(gone.length === 1 ? "1 acesso revogado" : `${gone.length} acessos revogados`);
      }
    });
    if (archived && input.revokeAccess) {
      revalidatePath("/configuracoes/membros");
      revalidatePath("/", "layout");
    }
    revalidatePath(`/empresas/${input.id}`);
    refresh();
    return {
      success: archived ? `Cliente arquivado.${done.length ? ` ${done.join(", ")}.` : ""}` : "Cliente restaurado.",
      href: archived ? "/empresas" : `/empresas/${input.id}`,
    };
  } catch (e) {
    return failure(e);
  }
}
