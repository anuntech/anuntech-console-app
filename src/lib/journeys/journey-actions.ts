"use server";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, companies, consoleStaffMembers, engagements, journeySteps, journeys, quotes, tickets, user } from "@/db/schema";
import { db } from "../db";
import { getActor } from "../access/access";
import { normalizeEmail } from "../access/permissions";
import type { ActionState } from "../action-state";
import { createQuote } from "../quotes/quote-actions";
import { emptyQuoteContent } from "../quotes/quote-model";
import {
  briefingSummary,
  isExtraKey,
  journeyBriefingSchema,
  journeyStageKeys,
  looksSecret,
  safeUrl,
  templateStep,
  type JourneyStatus,
} from "./journey-model";
import { readBriefing } from "./journey-facts";

/*
 * The journey's own changes, staff only. Nothing here creates, sends or
 * charges anything outside the journey: the steps link to the Console's own
 * forms, and the one shortcut (a proposal drafted from the briefing) only
 * makes a draft.
 */

const blocked = { error: "Você não tem permissão para fazer isso." };
const SECRET_REFUSAL = "Isto parece uma senha, uma chave ou um endereço com senha. Guarde em um cofre ou na Vercel; aqui, só o nome.";
const id = z.string().uuid();
const optionalId = z.union([id, z.literal("")]).default("");
const failure = (e: unknown): ActionState => ({
  error: e instanceof z.ZodError ? e.issues[0].message : e instanceof Error && e.message ? e.message : "Não foi possível salvar a jornada.",
});
const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

function refresh(journeyId?: string) {
  revalidatePath("/jornadas");
  if (journeyId) revalidatePath(`/jornadas/${journeyId}`);
}

/** Staff accounts (and the owner) are the only possible owners and assignees. */
async function staffUser(userId: string) {
  const [row] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, userId));
  if (!row) return null;
  const owner = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  if (owner && normalizeEmail(owner) === normalizeEmail(row.email)) return row;
  const [staff] = await db
    .select({ id: consoleStaffMembers.id })
    .from(consoleStaffMembers)
    .where(and(eq(consoleStaffMembers.email, normalizeEmail(row.email)), eq(consoleStaffMembers.active, true)));
  return staff ? row : null;
}

const leadSchema = z.object({
  leadName: z.string().trim().max(120, "Use até 120 caracteres no nome.").default(""),
  leadContact: z.string().trim().max(120).default(""),
  leadEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("Confira o e-mail do contato.")]).default(""),
  leadPhone: z.string().trim().max(40).default(""),
});
const leadOf = (input: z.infer<typeof leadSchema>) =>
  input.leadName
    ? {
        name: input.leadName,
        ...(input.leadContact ? { contact: input.leadContact } : {}),
        ...(input.leadEmail ? { email: input.leadEmail } : {}),
        ...(input.leadPhone ? { phone: input.leadPhone } : {}),
      }
    : null;

/** Starts a journey for a company (or a lead that is not a client yet), optionally from a request or a proposal. */
export async function startJourney(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        title: z.string().trim().min(1, "Dê um nome ao projeto.").max(160, "Use até 160 caracteres no nome."),
        companyId: optionalId,
        ownerId: z.string().trim().max(64).default(""),
        quoteId: optionalId,
        ticketId: optionalId,
      })
      .and(leadSchema)
      .parse(Object.fromEntries(form));
    // A proposal brings its company along.
    const [quote] = input.quoteId ? await db.select({ id: quotes.id, companyId: quotes.companyId, ticketId: quotes.ticketId }).from(quotes).where(eq(quotes.id, input.quoteId)) : [];
    if (input.quoteId && !quote) return { error: "Orçamento não encontrado." };
    // A request, like a proposal, brings its company along.
    const [fromTicket] = !input.companyId && !quote && input.ticketId ? await db.select({ companyId: tickets.companyId }).from(tickets).where(eq(tickets.id, input.ticketId)) : [];
    const companyId = input.companyId || quote?.companyId || fromTicket?.companyId || "";
    if (quote && quote.companyId !== companyId) return { error: "O orçamento é de outra empresa." };
    const [company] = companyId ? await db.select({ id: companies.id, archived: companies.archived }).from(companies).where(eq(companies.id, companyId)) : [];
    if (companyId && !company) return { error: "Empresa não encontrada." };
    if (company?.archived) return { error: "Esta empresa está arquivada. Restaure o cadastro antes de começar uma jornada." };
    const lead = leadOf(input);
    if (!company && !lead) return { error: "Escolha a empresa ou informe o nome do contato." };
    const ticketId = input.ticketId || quote?.ticketId || "";
    const [ticket] = ticketId && companyId ? await db.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.id, ticketId), eq(tickets.companyId, companyId))) : [];
    if (input.ticketId && !ticket) return { error: "O pedido de origem não é desta empresa." };
    // "Sem responsável" chosen in the form means none; a form without the field gives it to whoever opened it.
    const owner = input.ownerId ? await staffUser(input.ownerId) : form.has("ownerId") ? null : { id: actor.user.id };
    if (input.ownerId && !owner) return { error: "O responsável precisa ser da equipe da Anuntech." };
    if (quote) {
      const [taken] = await db.select({ id: journeys.id }).from(journeys).where(eq(journeys.quoteId, quote.id));
      if (taken) return { error: "Este orçamento já tem uma jornada.", href: `/jornadas/${taken.id}` };
    }
    if (ticket) {
      const [taken] = await db.select({ id: journeys.id }).from(journeys).where(eq(journeys.ticketId, ticket.id));
      if (taken) return { error: "Este pedido já tem uma jornada.", href: `/jornadas/${taken.id}` };
    }
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(journeys)
        .values({ title: input.title, companyId: company?.id ?? null, lead, ticketId: ticket?.id ?? null, quoteId: quote?.id ?? null, ownerId: owner?.id ?? null })
        .returning({ id: journeys.id });
      await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: company?.id ?? null, entityId: row.id, action: "journey.created", details: { journey: input.title } });
      return row;
    });
    refresh();
    return { success: "Jornada criada.", href: `/jornadas/${created.id}` };
  } catch (e) {
    return failure(e);
  }
}

/** Name, owner and the lead's contact. */
export async function updateJourney(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        id,
        title: z.string().trim().min(1, "Dê um nome ao projeto.").max(160, "Use até 160 caracteres no nome."),
        ownerId: z.string().trim().max(64).default(""),
      })
      .and(leadSchema)
      .parse(Object.fromEntries(form));
    const owner = input.ownerId ? await staffUser(input.ownerId) : null;
    if (input.ownerId && !owner) return { error: "O responsável precisa ser da equipe da Anuntech." };
    const [row] = await db
      .update(journeys)
      .set({ title: input.title, ownerId: owner?.id ?? null, lead: leadOf(input), updatedAt: new Date() })
      .where(eq(journeys.id, input.id))
      .returning({ id: journeys.id, companyId: journeys.companyId });
    if (!row) return { error: "Jornada não encontrada." };
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: row.companyId, entityId: row.id, action: "journey.updated", details: { journey: input.title } });
    refresh(row.id);
    return { success: "Jornada atualizada." };
  } catch (e) {
    return failure(e);
  }
}

const statusAudit: Record<JourneyStatus, string> = {
  active: "journey.resumed",
  paused: "journey.paused",
  done: "journey.finished",
  lost: "journey.lost",
};

/** Pause, resume, finish or mark as lost (with the reason). */
export async function setJourneyStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        id,
        status: z.enum(["active", "paused", "done", "lost"]),
        reason: z.string().trim().max(1000).default(""),
      })
      .parse(Object.fromEntries(form));
    if (input.status === "lost" && input.reason.length < 3) return { error: "Diga por que a jornada foi perdida." };
    if (looksSecret(input.reason)) return { error: SECRET_REFUSAL };
    const [row] = await db
      .update(journeys)
      .set({ status: input.status, finishedAt: input.status === "done" || input.status === "lost" ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(journeys.id, input.id), ne(journeys.status, input.status)))
      .returning({ id: journeys.id, companyId: journeys.companyId, title: journeys.title });
    if (!row) return { error: "A jornada já está assim." };
    await db.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: row.companyId,
      entityId: row.id,
      action: statusAudit[input.status],
      details: { journey: row.title, ...(input.reason ? { reason: input.reason } : {}) },
    });
    refresh(row.id);
    return {
      success: { active: "Jornada retomada.", paused: "Jornada pausada.", done: "Jornada concluída.", lost: "Jornada marcada como perdida." }[input.status],
    };
  } catch (e) {
    return failure(e);
  }
}

/** The briefing, as the team reviewed it (the AI only fills the form). */
export async function saveJourneyBriefing(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const journeyId = id.parse(field(form, "id"));
    let raw: unknown;
    try {
      raw = JSON.parse(field(form, "briefing") || "{}");
    } catch {
      return { error: "O briefing veio em um formato inválido. Recarregue a página." };
    }
    const briefing = journeyBriefingSchema.parse(raw);
    if (looksSecret(JSON.stringify(briefing))) return { error: SECRET_REFUSAL };
    const [row] = await db
      .update(journeys)
      .set({ briefing, updatedAt: new Date() })
      .where(eq(journeys.id, journeyId))
      .returning({ id: journeys.id, companyId: journeys.companyId, title: journeys.title });
    if (!row) return { error: "Jornada não encontrada." };
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: row.companyId, entityId: row.id, action: "journey.briefing_saved", details: { journey: row.title } });
    refresh(row.id);
    return { success: "Briefing salvo." };
  } catch (e) {
    return failure(e);
  }
}

const stepInput = z.object({
  journeyId: id,
  key: z.string().trim().min(1).max(80),
  status: z.enum(["todo", "doing", "done", "skipped"]),
  note: z.string().trim().max(4000, "Use até 4 mil caracteres na anotação.").default(""),
  url: z.string().trim().max(500).default(""),
  value: z.string().trim().max(200, "Use até 200 caracteres.").default(""),
  scheduledAt: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Confira a data.")]).default(""),
  assigneeId: z.string().trim().max(64).default(""),
});

/** A step's state, link, value, date and note. The data's own steps only take "Não se aplica". */
export async function saveJourneyStep(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = stepInput.parse(Object.fromEntries(form));
    const def = templateStep(input.key);
    const [journey] = await db.select({ id: journeys.id, companyId: journeys.companyId, title: journeys.title }).from(journeys).where(eq(journeys.id, input.journeyId));
    if (!journey) return { error: "Jornada não encontrada." };
    const [existing] = await db
      .select()
      .from(journeySteps)
      .where(and(eq(journeySteps.journeyId, journey.id), eq(journeySteps.key, input.key)));
    if (!def && !(isExtraKey(input.key) && existing)) return { error: "Passo não encontrado." };
    if (def?.source === "auto" && (input.status === "done" || input.status === "doing"))
      return { error: "Este passo conta sozinho a partir do Console. Aqui, só dá para marcar que não se aplica." };
    if (input.status === "skipped" && input.note.length < 3) return { error: "Diga por que este passo não se aplica." };
    const url = input.url ? safeUrl(input.url) : null;
    if (input.url && !url) return { error: "Use um link https, sem usuário nem senha." };
    // Links and notes are for the team; passwords and connection strings belong in the project's secrets, never here.
    if (looksSecret(`${input.note}\n${input.value}`)) return { error: SECRET_REFUSAL };
    const assignee = input.assigneeId ? await staffUser(input.assigneeId) : null;
    if (input.assigneeId && !assignee) return { error: "O responsável precisa ser da equipe da Anuntech." };
    const now = new Date();
    const becameDone = input.status === "done" && existing?.status !== "done";
    const values = {
      status: input.status,
      note: input.note || null,
      url,
      value: input.value || null,
      // Noon in São Paulo: the day stays the same in any time zone the page is read in.
      scheduledAt: input.scheduledAt ? new Date(`${input.scheduledAt}T12:00:00-03:00`) : null,
      assigneeId: assignee?.id ?? null,
      doneBy: input.status === "done" ? (becameDone ? actor.user.id : (existing?.doneBy ?? actor.user.id)) : null,
      doneAt: input.status === "done" ? (becameDone ? now : (existing?.doneAt ?? now)) : null,
      updatedAt: now,
    };
    await db.transaction(async (tx) => {
      await tx
        .insert(journeySteps)
        .values({ journeyId: journey.id, key: input.key, ...values })
        .onConflictDoUpdate({ target: [journeySteps.journeyId, journeySteps.key], set: values });
      await tx.update(journeys).set({ updatedAt: now }).where(eq(journeys.id, journey.id));
      const action =
        input.status === existing?.status || (!existing && input.status === "todo")
          ? null
          : input.status === "done"
            ? "journey.step_done"
            : input.status === "skipped"
              ? "journey.step_skipped"
              : existing && (existing.status === "done" || existing.status === "skipped")
                ? "journey.step_reopened"
                : null;
      if (action)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: journey.companyId,
          entityId: journey.id,
          action,
          details: { journey: journey.title, step: def?.title ?? existing?.title ?? input.key },
        });
    });
    refresh(journey.id);
    return {
      success:
        input.status === "done"
          ? "Passo concluído."
          : input.status === "skipped"
            ? "Marcado como não se aplica."
            : "Passo salvo.",
    };
  } catch (e) {
    return failure(e);
  }
}

/** A step this journey needs and the template does not have. */
export async function addJourneyStep(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        journeyId: id,
        title: z.string().trim().min(2, "Dê um nome ao passo.").max(120, "Use até 120 caracteres."),
        stage: z.enum(journeyStageKeys),
        note: z.string().trim().max(4000).default(""),
      })
      .parse(Object.fromEntries(form));
    if (looksSecret(input.note)) return { error: SECRET_REFUSAL };
    const [journey] = await db.select({ id: journeys.id, companyId: journeys.companyId, title: journeys.title }).from(journeys).where(eq(journeys.id, input.journeyId));
    if (!journey) return { error: "Jornada não encontrada." };
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(journeySteps)
      .where(and(eq(journeySteps.journeyId, journey.id), sql`${journeySteps.key} like 'extra:%'`));
    if (n >= 40) return { error: "Esta jornada já tem 40 passos acrescentados." };
    await db.transaction(async (tx) => {
      await tx.insert(journeySteps).values({ journeyId: journey.id, key: `extra:${crypto.randomUUID()}`, title: input.title, stage: input.stage, note: input.note || null });
      await tx.update(journeys).set({ updatedAt: new Date() }).where(eq(journeys.id, journey.id));
      await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: journey.companyId, entityId: journey.id, action: "journey.step_added", details: { journey: journey.title, step: input.title } });
    });
    refresh(journey.id);
    return { success: "Passo acrescentado." };
  } catch (e) {
    return failure(e);
  }
}

/** Takes out a step the team added; the template's steps only take "Não se aplica". */
export async function removeJourneyStep(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ journeyId: id, key: z.string().trim().max(80) }).parse(Object.fromEntries(form));
    if (!isExtraKey(input.key)) return { error: "Só os passos acrescentados podem ser tirados." };
    const gone = await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(journeySteps)
        .where(and(eq(journeySteps.journeyId, input.journeyId), eq(journeySteps.key, input.key)))
        .returning({ title: journeySteps.title });
      if (!row) return null;
      const [journey] = await tx
        .update(journeys)
        .set({ updatedAt: new Date() })
        .where(eq(journeys.id, input.journeyId))
        .returning({ companyId: journeys.companyId, title: journeys.title });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: journey?.companyId ?? null,
        entityId: input.journeyId,
        action: "journey.step_removed",
        details: { journey: journey?.title ?? null, step: row.title },
      });
      return row;
    });
    if (!gone) return { error: "Passo não encontrado." };
    refresh(input.journeyId);
    return { success: "Passo tirado da jornada." };
  } catch (e) {
    return failure(e);
  }
}

/** Keeps what the AI wrote for a step (after the team read it). */
export async function saveJourneyAiDraft(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        journeyId: id,
        key: z.string().trim().min(1).max(80),
        kind: z.string().trim().min(1).max(20),
        text: z.string().trim().min(1, "Nada para guardar.").max(20000, "O texto passou de 20 mil caracteres."),
      })
      .parse(Object.fromEntries(form));
    if (!templateStep(input.key) && !isExtraKey(input.key)) return { error: "Passo não encontrado." };
    const [journey] = await db.select({ id: journeys.id }).from(journeys).where(eq(journeys.id, input.journeyId));
    if (!journey) return { error: "Jornada não encontrada." };
    const aiDraft = { kind: input.kind, text: input.text, at: new Date().toISOString() };
    if (isExtraKey(input.key)) {
      const [row] = await db
        .update(journeySteps)
        .set({ aiDraft, updatedAt: new Date() })
        .where(and(eq(journeySteps.journeyId, journey.id), eq(journeySteps.key, input.key)))
        .returning({ id: journeySteps.id });
      if (!row) return { error: "Passo não encontrado." };
    } else
      await db
        .insert(journeySteps)
        .values({ journeyId: journey.id, key: input.key, aiDraft })
        .onConflictDoUpdate({ target: [journeySteps.journeyId, journeySteps.key], set: { aiDraft, updatedAt: new Date() } });
    refresh(journey.id);
    return { success: "Guardado na jornada." };
  } catch (e) {
    return failure(e);
  }
}

const linkKinds = ["company", "quote", "project", "hosting", "ticket"] as const;

/** Ties (or unties) a record to the journey: the company, the proposal, the project, the hosting or the request. */
export async function linkJourneyRecord(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ journeyId: id, kind: z.enum(linkKinds), recordId: optionalId }).parse(Object.fromEntries(form));
    const [journey] = await db.select().from(journeys).where(eq(journeys.id, input.journeyId));
    if (!journey) return { error: "Jornada não encontrada." };
    const record = input.recordId;
    const sameCompany = (companyId: string) => !journey.companyId || journey.companyId === companyId;
    const patch: Partial<typeof journeys.$inferInsert> = {};
    let label = "";
    if (input.kind === "company") {
      if (!record) {
        if (journey.quoteId || journey.engagementId || journey.hostingEngagementId || journey.ticketId)
          return { error: "Desvincule o orçamento, o projeto, a hospedagem e o pedido antes de trocar a empresa." };
        patch.companyId = null;
      } else {
        const [company] = await db.select({ id: companies.id, name: companies.name, archived: companies.archived }).from(companies).where(eq(companies.id, record));
        if (!company) return { error: "Empresa não encontrada." };
        if (company.archived) return { error: "Esta empresa está arquivada." };
        if (journey.companyId && journey.companyId !== company.id && (journey.quoteId || journey.engagementId || journey.hostingEngagementId || journey.ticketId))
          return { error: "Desvincule o orçamento, o projeto, a hospedagem e o pedido antes de trocar a empresa." };
        patch.companyId = company.id;
        label = company.name;
      }
    } else if (!journey.companyId && record) {
      return { error: "Vincule a empresa primeiro." };
    } else if (input.kind === "quote") {
      if (record) {
        const [quote] = await db.select({ id: quotes.id, companyId: quotes.companyId, title: quotes.title, status: quotes.status }).from(quotes).where(eq(quotes.id, record));
        if (!quote || !sameCompany(quote.companyId)) return { error: "O orçamento não é desta empresa." };
        if (quote.status === "cancelled") return { error: "Este orçamento foi cancelado." };
        const [taken] = await db.select({ id: journeys.id }).from(journeys).where(and(eq(journeys.quoteId, quote.id), ne(journeys.id, journey.id)));
        if (taken) return { error: "Este orçamento já está em outra jornada." };
        label = quote.title;
      }
      patch.quoteId = record || null;
    } else if (input.kind === "project" || input.kind === "hosting") {
      if (record) {
        const [item] = await db
          .select({ id: engagements.id, companyId: engagements.companyId, kind: engagements.kind, name: engagements.name })
          .from(engagements)
          .where(eq(engagements.id, record));
        if (!item || !sameCompany(item.companyId)) return { error: "O item não é desta empresa." };
        if (input.kind === "project" && item.kind !== "project") return { error: "Escolha um projeto." };
        if (input.kind === "hosting" && item.kind === "project") return { error: "Escolha um produto ou serviço." };
        label = item.name;
      }
      if (input.kind === "project") patch.engagementId = record || null;
      else patch.hostingEngagementId = record || null;
    } else {
      if (record) {
        const [ticket] = await db.select({ id: tickets.id, companyId: tickets.companyId, subject: tickets.subject }).from(tickets).where(eq(tickets.id, record));
        if (!ticket || !sameCompany(ticket.companyId)) return { error: "O pedido não é desta empresa." };
        label = ticket.subject;
      }
      patch.ticketId = record || null;
    }
    const unchanged = Object.entries(patch).every(([key, value]) => journey[key as keyof typeof journey] === value);
    if (unchanged) return { success: "Nada mudou." };
    await db.transaction(async (tx) => {
      await tx.update(journeys).set({ ...patch, updatedAt: new Date() }).where(eq(journeys.id, journey.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: patch.companyId ?? journey.companyId,
        entityId: journey.id,
        action: record ? "journey.linked" : "journey.unlinked",
        details: { journey: journey.title, kind: input.kind, recordId: record || null, label: label || null },
      });
    });
    refresh(journey.id);
    return { success: record ? "Vinculado à jornada." : "Desvinculado da jornada." };
  } catch (e) {
    return failure(e);
  }
}

/** The proposal's draft, from the briefing: same title, the briefing as the summary, the request it answers. Only a draft. */
export async function createJourneyQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const journeyId = id.parse(field(form, "journeyId"));
    const [journey] = await db.select().from(journeys).where(eq(journeys.id, journeyId));
    if (!journey) return { error: "Jornada não encontrada." };
    if (!journey.companyId) return { error: "Cadastre ou vincule a empresa antes do orçamento." };
    // A cancelled proposal can be replaced; any other one is the journey's.
    const [current] = journey.quoteId ? await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, journey.quoteId)) : [];
    if (journey.quoteId && current?.status !== "cancelled") return { error: "Esta jornada já tem um orçamento.", href: `/orcamentos/${journey.quoteId}` };
    const briefing = readBriefing(journey.briefing);
    const content = { ...emptyQuoteContent(), summary: briefing ? briefingSummary(briefing) : "" };
    const draft = new FormData();
    draft.set("companyId", journey.companyId);
    draft.set("title", journey.title.slice(0, 160));
    draft.set("validUntil", "");
    draft.set("content", JSON.stringify(content));
    draft.set("ticketId", journey.ticketId ?? "");
    const result = await createQuote({}, draft);
    const quoteId = result.href?.match(/^\/orcamentos\/([0-9a-f-]{36})$/)?.[1];
    if (!quoteId) return result;
    // Linked unless someone linked another one meanwhile; the draft stays either way.
    await db.transaction(async (tx) => {
      const [linked] = await tx
        .update(journeys)
        .set({ quoteId, updatedAt: new Date() })
        .where(and(eq(journeys.id, journey.id), journey.quoteId ? or(isNull(journeys.quoteId), eq(journeys.quoteId, journey.quoteId)) : isNull(journeys.quoteId)))
        .returning({ id: journeys.id });
      if (linked)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: journey.companyId,
          entityId: journey.id,
          action: "journey.linked",
          details: { journey: journey.title, kind: "quote", recordId: quoteId, label: journey.title },
        });
    });
    refresh(journey.id);
    return { success: `${result.success ?? "Orçamento criado."} Use "Sugerir fases" no editor.`, href: `/orcamentos/${quoteId}` };
  } catch (e) {
    return failure(e);
  }
}

/** Deletes the journey and what was marked on it; the company, proposal and project stay as they are. */
export async function deleteJourney(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const journeyId = id.parse(field(form, "id"));
    const done = await db.transaction(async (tx) => {
      const [journey] = await tx.select({ id: journeys.id, companyId: journeys.companyId, title: journeys.title }).from(journeys).where(eq(journeys.id, journeyId)).for("update");
      if (!journey) return false;
      await tx.delete(journeySteps).where(eq(journeySteps.journeyId, journey.id));
      await tx.delete(journeys).where(eq(journeys.id, journey.id));
      await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: journey.companyId, entityId: journey.id, action: "journey.deleted", details: { journey: journey.title } });
      return true;
    });
    if (!done) return { error: "Jornada não encontrada." };
    refresh();
    return { success: "Jornada excluída.", href: "/jornadas" };
  } catch (e) {
    return failure(e);
  }
}
