"use server";
import { z } from "zod";
import { and, eq, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getActor, canAccess } from "./access";
import {
  companies,
  memberships,
  engagements,
  tickets,
  messages,
  invoices,
  auditEvents,
  attachments,
} from "@/db/schema";
import { normalizeEmail, moneyToCents } from "./permissions";
import type { ActionState } from "./action-state";
const id = z.string().uuid();
const str = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Preencha os campos obrigatórios.")
    .max(max, "O texto excede o tamanho permitido.");
const mail = z.email("Informe um e-mail válido.").transform(normalizeEmail);
const failure = (error: unknown): ActionState => ({
  error:
    error instanceof z.ZodError
      ? error.issues[0].message
      : "Não foi possível salvar. Confira os dados e tente novamente.",
});
const blocked = { error: "Você não tem permissão para realizar esta ação." };
function refresh() {
  revalidatePath("/painel", "layout");
  revalidatePath("/empresas");
  revalidatePath("/produtos");
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
    const input = z
      .object({
        name: str(160),
        document: z
          .string()
          .transform((v) => v.replace(/\D/g, ""))
          .pipe(
            z
              .string()
              .regex(
                /^(\d{11}|\d{14})$/,
                "Informe CPF ou CNPJ com 11 ou 14 dígitos.",
              ),
          ),
        billingEmail: mail,
        phone: z.string().trim().max(30),
      })
      .parse(Object.fromEntries(form));
    const company = await db.transaction(async (tx) => {
      const [row] = await tx.insert(companies).values(input).returning();
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
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        companyId: id,
        email: mail,
        role: z.enum(["manager", "support", "finance"]),
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(memberships)
        .values(input)
        .onConflictDoUpdate({
          target: [memberships.companyId, memberships.email],
          set: { role: input.role, active: true },
        })
        .returning();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: input.companyId,
        action: "membership.granted",
        entityId: row.id,
        details: { email: input.email, role: input.role },
      });
    });
    revalidatePath(`/empresas/${input.companyId}`);
    return {
      success:
        "Acesso liberado. A pessoa já pode entrar com esse e-mail pelo Google. Nenhuma mensagem foi enviada.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function revokeMembership(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const membershipId = id.parse(form.get("id"));
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(memberships)
        .set({ active: false })
        .where(eq(memberships.id, membershipId))
        .returning();
      if (!row) throw Error();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "membership.revoked",
        entityId: row.id,
      });
    });
    revalidatePath("/empresas", "layout");
    return { success: "Acesso revogado." };
  } catch (e) {
    return failure(e);
  }
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
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(engagements).values(input).returning();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "engagement.created",
        entityId: row.id,
      });
    });
    refresh();
    return { success: "Cadastro salvo.", href: "/produtos" };
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
        engagementId: z.union([id, z.literal("")]),
        subject: str(160),
        body: str(10000),
        priority: z.enum(["normal", "high"]),
      })
      .parse(Object.fromEntries(form));
    if (!canAccess(actor, input.companyId, "support")) return blocked;
    const ticket = await db.transaction(async (tx) => {
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
          priority: input.priority,
          authorId: actor.user.id,
        })
        .returning();
      await tx.insert(messages).values({
        ticketId: row.id,
        authorId: actor.user.id,
        body: input.body,
      });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "ticket.created",
        entityId: row.id,
      });
      return row;
    });
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
      .object({ ticketId: id, body: str(10000) })
      .parse(Object.fromEntries(form));
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
      await tx.insert(messages).values({
        ticketId: ticket.id,
        body: input.body,
        authorId: actor.user.id,
      });
      await tx
        .update(tickets)
        .set({
          updatedAt: new Date(),
          ...(!actor.admin && ticket.status === "waiting_customer"
            ? { status: "open" as const }
            : {}),
        })
        .where(eq(tickets.id, ticket.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: ticket.companyId,
        action: "ticket.replied",
        entityId: ticket.id,
      });
      return { success: "Resposta enviada." };
    });
    revalidatePath(`/chamados/${input.ticketId}`);
    refresh();
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
    const input = z
      .object({
        ticketId: id,
        status: z.enum([
          "open",
          "in_progress",
          "waiting_customer",
          "resolved",
          "closed",
        ]),
        assignedTo: z.union([mail, z.literal("")]),
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(tickets)
        .set({
          status: input.status,
          assignedTo: input.assignedTo || null,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, input.ticketId))
        .returning();
      if (!row) throw Error();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "ticket.updated",
        entityId: row.id,
        details: { status: row.status, assignedTo: row.assignedTo },
      });
    });
    revalidatePath(`/chamados/${input.ticketId}`);
    refresh();
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
      })
      .parse(Object.fromEntries(form));
    const amountCents = moneyToCents(input.amount);
    if (amountCents === null)
      return {
        error:
          "Informe um valor positivo, como 1500,00, sem separador de milhar.",
      };
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
      const [row] = await tx
        .insert(invoices)
        .values({
          companyId: input.companyId,
          engagementId: input.engagementId || null,
          description: input.description,
          amountCents,
          dueDate: input.dueDate,
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
export async function uploadAttachment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  try {
    const ticketId = id.parse(form.get("ticketId"));
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 1024 * 1024)
      return { error: "Escolha um arquivo de até 1 MB." };
    const content = Buffer.from(await file.arrayBuffer());
    const mime =
      content.subarray(0, 5).toString() === "%PDF-"
        ? "application/pdf"
        : content
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : content[0] === 255 && content[1] === 216 && content[2] === 255
            ? "image/jpeg"
            : null;
    if (!mime) return { error: "Envie um PDF, PNG ou JPEG válido." };
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .for("update");
      if (!ticket || !canAccess(actor, ticket.companyId, "support"))
        return blocked;
      if (ticket.status === "closed")
        return { error: "Chamado encerrado não recebe novos anexos." };
      const [total] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(attachments)
        .where(eq(attachments.ticketId, ticketId));
      if (total.n >= 20)
        return { error: "Limite de 20 anexos por chamado atingido." };
      const [row] = await tx
        .insert(attachments)
        .values({
          ticketId,
          authorId: actor.user.id,
          name:
            file.name.replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 150) ||
            "anexo",
          mime,
          size: file.size,
          content,
        })
        .returning({ id: attachments.id });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: ticket.companyId,
        action: "ticket.attachment_added",
        entityId: row.id,
      });
      return { success: "Anexo salvo." };
    });
    revalidatePath(`/chamados/${ticketId}`);
    return result;
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
      })
      .parse(Object.fromEntries(form));
    const amountCents = moneyToCents(input.amount);
    if (amountCents === null)
      return { error: "Informe um valor positivo sem separador de milhar." };
    const changed = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({
          description: input.description,
          amountCents,
          dueDate: input.dueDate,
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
    revalidatePath(`/financeiro/${input.id}`);
    refresh();
    return { success: "Rascunho atualizado." };
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
    const input = z
      .object({
        id,
        name: str(160),
        billingEmail: mail,
        phone: z.string().trim().max(30),
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(companies)
        .set({
          name: input.name,
          billingEmail: input.billingEmail,
          phone: input.phone,
        })
        .where(eq(companies.id, input.id))
        .returning();
      if (!row) throw Error();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.id,
        action: "company.updated",
        entityId: row.id,
      });
    });
    revalidatePath(`/empresas/${input.id}`);
    refresh();
    return { success: "Cadastro atualizado." };
  } catch (e) {
    return failure(e);
  }
}
