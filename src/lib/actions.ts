"use server";
import { prepareTicketFiles, takeTicketUploads } from "./tickets/ticket-files";
import { DOCUMENT_ATTACHMENTS } from "./tickets/attachment-rules";
import { z } from "zod";
import { and, eq, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { resolveBankDueDate } from "./billing/billing-notice-rules";
import { saoPauloDate } from "./dates";
import { getActor, canAccess } from "./access/access";
import {
  companies,
  engagements,
  tickets,
  messages,
  invoices,
  subscriptions,
  auditEvents,
  attachments,
  user,
} from "@/db/schema";
import { normalizeEmail, moneyToCents } from "./access/permissions";
import { parseChargeTerms, parseTermsScope } from "./billing/billing-terms";
import type { ActionState } from "./action-state";
import { saveCompanyMember, revokeCompanyMember } from "./access/members-actions";
import {
  enqueueTicketNotice,
  scheduleTicketNotices,
} from "./tickets/ticket-notifications";
import { priorityLabels, ticketLabels } from "./format";
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
    const company = await db.transaction(async (tx) => {
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
      return row;
    });
    refresh();
    return { success: "Empresa cadastrada.", href: `/empresas/${company.id}` };
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
      .object({ id, status: z.enum(["active", "paused", "completed"]) })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(engagements)
        .set({ status: input.status })
        .where(eq(engagements.id, input.id))
        .returning();
      if (!row) throw Error();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "engagement.status_changed",
        entityId: row.id,
        details: { status: row.status },
      });
    });
    refresh();
    return { success: "Situação atualizada." };
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
    const input = z
      .object({
        companyId: id,
        engagementId: z.union([id, z.literal("")]).default(""),
        subject: str(160),
        body: str(10000),
        priority: z.enum(["normal", "high"]).default("normal"),
      })
      .parse(Object.fromEntries(form));
    if (!canAccess(actor, input.companyId, "support")) return blocked;
    let files: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try { files = await prepareTicketFiles(form.getAll("files")); }
    catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível ler os anexos. Selecione os arquivos de novo." }; }
    const ticket = await db.transaction(async (tx) => {
      const uploaded = await takeTicketUploads(tx, actor.user.id, form);
      if (files.length + uploaded.length > DOCUMENT_ATTACHMENTS.max || files.reduce((n, f) => n + f.size, 0) + uploaded.reduce((n, f) => n + f.size, 0) > DOCUMENT_ATTACHMENTS.maxBytes) throw new Error("Limite de anexos excedido.");
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
      const [row] = await tx
        .insert(tickets)
        .values({
          companyId: input.companyId,
          engagementId: input.engagementId || null,
          subject: input.subject,
          // The priority is Anuntech's call (support contract 5.1): only the team sets it.
          priority: actor.admin ? input.priority : "normal",
          authorId: actor.user.id,
        })
        .returning();
      await tx.insert(messages).values({
        ticketId: row.id,
        authorId: actor.user.id,
        body: input.body,
      });
      if (files.length || uploaded.length) await tx.insert(attachments).values([...files, ...uploaded].map(file => ({ ...file, ticketId: row.id, authorId: actor.user.id })));
      const [event] = await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: row.companyId,
          action: "ticket.created",
          entityId: row.id,
        })
        .returning({ id: auditEvents.id });
      await enqueueTicketNotice(
        tx,
        event.id,
        row,
        actor.user.name,
        "Chamado aberto",
        { email: actor.user.email },
      );
      return row;
    });
    refresh();
    scheduleTicketNotices();
    return { success: "Chamado aberto.", href: `/chamados/${ticket.id}` };
  } catch (e) {
    return failure(e);
  }
}
/** The person who opened a ticket, so Anuntech's movements reach them directly; never the actor. */
async function ticketOpener(
  tx: Pick<typeof db, "select">,
  ticket: { authorId: string },
  actorEmail: string,
): Promise<{ email: string; kind: "movement" } | null> {
  const [opener] = await tx.select({ email: user.email }).from(user).where(eq(user.id, ticket.authorId));
  if (!opener?.email || opener.email.toLowerCase() === actorEmail.toLowerCase()) return null;
  return { email: opener.email, kind: "movement" };
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
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.id, input.ticketId))
        .for("update");
      if (!ticket || !canAccess(actor, ticket.companyId, "support"))
        return blocked;
      if (ticket.status === "closed")
        return {
          error:
            "O chamado está encerrado. Abra um novo chamado para continuar o atendimento.",
        };
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, form);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Não foi possível ler os anexos. Selecione os arquivos de novo.",
        };
      }
      const files = [...direct, ...uploaded];
      if (!input.body && !files.length)
        return { error: "Escreva uma resposta ou anexe um arquivo." };
      if (
        files.length > DOCUMENT_ATTACHMENTS.max ||
        files.reduce((n, f) => n + f.size, 0) > DOCUMENT_ATTACHMENTS.maxBytes
      )
        return { error: "Selecione até 5 anexos, com no máximo 20 MB no total." };
      if (files.length) {
        const [total] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(attachments)
          .where(eq(attachments.ticketId, ticket.id));
        if (total.n + files.length > 20)
          return { error: "Limite de 20 anexos por chamado atingido." };
      }
      if (input.body)
        await tx.insert(messages).values({
          ticketId: ticket.id,
          body: input.body,
          authorId: actor.user.id,
        });
      if (files.length)
        await tx.insert(attachments).values(
          files.map((file) => ({
            ...file,
            ticketId: ticket.id,
            authorId: actor.user.id,
          })),
        );
      await tx
        .update(tickets)
        .set({
          updatedAt: new Date(),
          ...(!actor.admin && ticket.status === "waiting_customer"
            ? { status: "open" as const }
            : {}),
        })
        .where(eq(tickets.id, ticket.id));
      const [event] = await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: ticket.companyId,
          action: input.body ? "ticket.replied" : "ticket.attachment_added",
          entityId: ticket.id,
        })
        .returning({ id: auditEvents.id });
      await enqueueTicketNotice(
        tx,
        event.id,
        ticket,
        actor.user.name,
        input.body ? "Nova resposta no chamado" : "Novo anexo no chamado",
        actor.admin ? await ticketOpener(tx, ticket, actor.user.email) : null,
      );
      return { success: input.body ? "Resposta enviada." : "Anexo enviado." };
    });
    revalidatePath(`/chamados/${input.ticketId}`);
    refresh();
    if ("success" in result) scheduleTicketNotices();
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
        priority: z.enum(["normal", "high"]).optional(),
        assignedTo: z.union([mail, z.literal("")]).optional(),
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
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
      if (
        previous.status === next.status &&
        previous.priority === next.priority &&
        previous.assignedTo === next.assignedTo
      )
        return;
      const [row] = await tx
        .update(tickets)
        .set({ ...next, updatedAt: new Date() })
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
      const changes = [
        ...(previous.status !== row.status
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
      await enqueueTicketNotice(
        tx,
        event.id,
        row,
        actor.user.name,
        changes.join(" · "),
        await ticketOpener(tx, row, actor.user.email),
      );
    });
    revalidatePath(`/chamados/${input.ticketId}`);
    refresh();
    scheduleTicketNotices();
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
    const invoice = await db.transaction(async (tx) => {
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
          ...terms,
        })
        .returning();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "invoice.drafted",
        entityId: row.id,
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
      .object({ id, archived: z.enum(["yes", "no"]) })
      .parse(Object.fromEntries(form));
    const archived = input.archived === "yes";
    await db.transaction(async (tx) => {
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
      });
    });
    revalidatePath(`/empresas/${input.id}`);
    refresh();
    return {
      success: archived ? "Cliente arquivado." : "Cliente restaurado.",
      href: archived ? "/empresas" : `/empresas/${input.id}`,
    };
  } catch (e) {
    return failure(e);
  }
}
