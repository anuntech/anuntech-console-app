"use server";
import { and, eq, isNotNull, max, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { getActor } from "../access/access";
import { requestEvidence, type DecisionEvidence } from "../access/client-decision";
import { accountEmails, auditEvents, companies, engagements, memberships, quoteVersions, quotes, tasks, tickets, user } from "@/db/schema";
import type { ActionState } from "../action-state";
import { consoleUrl, quoteFailure as failure, refreshQuotes as refresh } from "./quote-common";
import { answerQuoteAs, quoteNoteField, type QuoteAnswer } from "./quote-answer";
import { documentHash as hashOf } from "../document-hash";
import { saoPauloDate } from "../dates";
import { deliverQuoteNotice } from "./quote-mail";
import { enqueuePush, schedulePushNotices } from "../notifications/push-queue";
import { quoteBoardTasks } from "./quote-handoff";
import { inviteManagerOnSend } from "../access/invite-manager";
import {
  quoteContentSchema,
  quoteNumberLabel,
  quoteTotals,
  type QuoteContent,
  type QuotePublication,
} from "./quote-model";

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para fazer isso." };
const titleField = z.string().trim().min(1, "Dê um título ao orçamento.").max(160, "O título pode ter até 160 caracteres.");
const civilDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")]).default("");
/** The editor posts its state as one JSON field. */
const contentField = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "O conteúdo do orçamento chegou corrompido. Recarregue a página." });
      return z.NEVER;
    }
  })
  .pipe(quoteContentSchema);

function quoteFields(form: FormData) {
  return {
    title: titleField.parse(form.get("title")),
    validUntil: civilDate.parse(form.get("validUntil") ?? "") || null,
    content: contentField.parse(form.get("content") ?? "") as QuoteContent,
  };
}

/** Active managers of the company: the people who can answer a proposal. */
async function companyManagers(companyId: string) {
  return db
    .select({ email: memberships.email, name: user.name })
    .from(memberships)
    .leftJoin(accountEmails, and(eq(accountEmails.email, memberships.email), isNotNull(accountEmails.verifiedAt)))
    .leftJoin(user, or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)))
    .where(and(eq(memberships.companyId, companyId), eq(memberships.active, true), eq(memberships.role, "manager")));
}

/* ---------- drafting (staff) ---------- */

/** A new proposal, numbered in order within the year, saved as a draft. */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The highest quote number used this year, counting deleted quotes too (their
 * number lives on in the audit log), so a number is never handed out twice.
 */
async function lastQuoteSeq(tx: Tx, year: number) {
  const [{ last }] = await tx.select({ last: max(quotes.seq) }).from(quotes).where(eq(quotes.year, year));
  const [{ gone }] = await tx
    .select({ gone: sql<number | null>`max((${auditEvents.details}->>'seq')::int)` })
    .from(auditEvents)
    .where(and(eq(auditEvents.action, "quote.deleted"), sql`${auditEvents.details}->>'year' = ${String(year)}`));
  return Math.max(Number(last ?? 0), Number(gone ?? 0));
}

export async function createQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const companyId = id.parse(form.get("companyId"));
    const fields = quoteFields(form);
    const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId));
    if (!company) return { error: "Escolha a empresa." };
    // The client's request it answers, of the same company.
    const ticketId = z.union([id, z.literal("")]).default("").parse(form.get("ticketId") ?? "");
    const [ticket] = ticketId
      ? await db.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.id, ticketId), eq(tickets.companyId, companyId)))
      : [];
    if (ticketId && !ticket) return { error: "O chamado de origem não é desta empresa." };
    const created = await db.transaction(async (tx) => {
      const year = Number(saoPauloDate().slice(0, 4));
      const last = await lastQuoteSeq(tx, year);
      const [row] = await tx
        .insert(quotes)
        .values({ ...fields, companyId, year, seq: last + 1, authorId: actor.user.id, ticketId: ticket?.id ?? null })
        .returning({ id: quotes.id, year: quotes.year, seq: quotes.seq });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId,
        entityId: row.id,
        action: "quote.created",
        details: { number: quoteNumberLabel(row.year, row.seq), ticketId: ticket?.id ?? null },
      });
      return row;
    });
    refresh(created.id);
    return { href: `/orcamentos/${created.id}`, success: `Orçamento ${quoteNumberLabel(created.year, created.seq)} criado como rascunho.` };
  } catch (e) {
    return failure(e);
  }
}

/** Edits a draft; `revision` guards against two tabs saving over each other. */
export async function saveQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const quoteId = id.parse(form.get("id"));
    const revision = z.coerce.number().int().parse(form.get("revision"));
    const fields = quoteFields(form);
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for("update");
      if (!q) throw Error("Orçamento não encontrado.");
      if (q.status !== "draft") throw Error("Só rascunhos podem ser editados. Volte o orçamento para rascunho primeiro.");
      if (q.revision !== revision) throw Error("stale");
      await tx
        .update(quotes)
        .set({ ...fields, revision: q.revision + 1, updatedAt: new Date() })
        .where(eq(quotes.id, q.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: q.companyId,
        entityId: q.id,
        action: "quote.draft_updated",
      });
    });
    refresh(quoteId);
    return { success: "Rascunho salvo." };
  } catch (e) {
    return failure(e);
  }
}

/** A new draft with the same content, for proposals that repeat a pattern. */
export async function duplicateQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const quoteId = id.parse(form.get("id"));
    const [q] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!q) return blocked;
    const source = q.status !== "draft" && q.publication ? q.publication : q.content;
    const content: QuoteContent = {
      summary: source.summary,
      stack: source.stack,
      phases: source.phases,
      hourlyRateCents: source.hourlyRateCents,
      discountCents: source.discountCents ?? 0,
      upfrontPercent: source.upfrontPercent,
      notes: source.notes,
    };
    const created = await db.transaction(async (tx) => {
      const year = Number(saoPauloDate().slice(0, 4));
      const last = await lastQuoteSeq(tx, year);
      const [row] = await tx
        .insert(quotes)
        .values({
          companyId: q.companyId,
          year,
          seq: last + 1,
          title: `${q.title} (cópia)`.slice(0, 160),
          content,
          validUntil: null,
          authorId: actor.user.id,
        })
        .returning({ id: quotes.id, year: quotes.year, seq: quotes.seq });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: q.companyId,
        entityId: row.id,
        action: "quote.created",
        details: { number: quoteNumberLabel(row.year, row.seq), from: q.id },
      });
      return row;
    });
    refresh(created.id);
    return { href: `/orcamentos/${created.id}`, success: `Orçamento ${quoteNumberLabel(created.year, created.seq)} criado a partir deste.` };
  } catch (e) {
    return failure(e);
  }
}

/* ---------- sending and withdrawing (staff) ---------- */

/** Freezes the proposal as a new version, hashes it and asks the client to answer. */
export async function sendQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const quoteId = id.parse(form.get("id"));
    const sent = await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for("update");
      if (!q) throw Error("Orçamento não encontrado.");
      if (q.status !== "draft") throw Error("Este orçamento já foi enviado.");
      if (!q.content.phases.length) throw Error("Adicione ao menos uma fase antes de enviar.");
      if (q.content.hourlyRateCents <= 0) throw Error("Informe a taxa por hora antes de enviar.");
      if ((q.content.discountCents ?? 0) > quoteTotals(q.content).subtotalCents)
        throw Error("O desconto passou do valor das horas. Ajuste antes de enviar.");
      if (q.validUntil && q.validUntil < saoPauloDate()) throw Error("A validade já passou. Ajuste a data antes de enviar.");
      const [company] = await tx.select().from(companies).where(eq(companies.id, q.companyId));
      const version = q.publishedVersion + 1;
      const publication: QuotePublication = {
        ...q.content,
        title: q.title,
        number: quoteNumberLabel(q.year, q.seq),
        companyName: company.name,
        companyDocument: company.document,
        validUntil: q.validUntil,
        version,
      };
      const documentHash = hashOf(publication);
      await tx
        .update(quotes)
        .set({
          status: "sent",
          publication,
          publishedAt: new Date(),
          publishedVersion: version,
          documentHash,
          decidedAt: null,
          decidedBy: null,
          decidedParty: null,
          decidedName: null,
          decidedEmail: null,
          decidedIp: null,
          decisionNote: null,
          revision: q.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, q.id));
      await tx.insert(quoteVersions).values({ quoteId: q.id, version, publication, documentHash, sentBy: actor.user.id });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: q.companyId,
        entityId: q.id,
        action: "quote.sent",
        details: { hash: documentHash, version },
      });
      // The Administradores' phones: they are the ones who answer a proposal.
      await enqueuePush(tx, {
        event: "quote.sent",
        eventKey: `quote.sent:${q.id}:${version}`,
        companyId: q.companyId,
        entityId: q.id,
        actorId: actor.user.id,
      });
      return { ...q, publication, version, companyName: company.name };
    });
    const url = `${consoleUrl()}/orcamentos/${sent.id}`;
    const totals = quoteTotals(sent.publication);
    // No Administrador yet: the person the team named gets access now that the proposal is out, so the notice reaches them.
    const invite = await inviteManagerOnSend(form, sent.companyId);
    let notified = 0;
    for (const manager of await companyManagers(sent.companyId)) {
      try {
        await deliverQuoteNotice(manager.email, {
          companyName: sent.companyName,
          title: sent.title,
          number: sent.publication.number,
          url,
          totalCents: totals.totalCents,
          validUntil: sent.validUntil,
          version: sent.version,
        });
        notified += 1;
      } catch {
        /* The proposal is out; the client can still open it in the Console. */
      }
    }
    refresh(sent.id);
    schedulePushNotices();
    return {
      success:
        (notified
          ? `Orçamento enviado. ${notified === 1 ? "1 pessoa avisada" : `${notified} pessoas avisadas`} por e-mail.`
          : "Orçamento enviado. Ninguém da empresa é Administrador para receber o aviso; libere o acesso em Empresas.") + (invite ? ` ${invite}` : ""),
    };
  } catch (e) {
    return failure(e);
  }
}

/** Reopens a sent proposal for editing; the next send is a new version. */
export async function revertQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const quoteId = id.parse(form.get("id"));
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for("update");
      if (!q) throw Error("Orçamento não encontrado.");
      if (q.status !== "sent") throw Error("Só um orçamento aguardando resposta pode voltar para rascunho.");
      await tx.update(quotes).set({ status: "draft", revision: q.revision + 1, updatedAt: new Date() }).where(eq(quotes.id, q.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: q.companyId,
        entityId: q.id,
        action: "quote.reverted",
        details: { version: q.publishedVersion },
      });
    });
    refresh(quoteId);
    return { success: "De volta ao rascunho. O próximo envio vira uma nova versão." };
  } catch (e) {
    return failure(e);
  }
}

/** A draft or a waiting proposal can be withdrawn; answered ones stay as they are. */
export async function cancelQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const quoteId = id.parse(form.get("id"));
    const [q] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!q) return blocked;
    if (q.status === "accepted" || q.status === "declined") return { error: "Um orçamento respondido não pode ser cancelado." };
    if (q.status === "cancelled") return { error: "Este orçamento já está cancelado." };
    await db.update(quotes).set({ status: "cancelled", revision: q.revision + 1, updatedAt: new Date() }).where(eq(quotes.id, q.id));
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: q.companyId, entityId: q.id, action: "quote.cancelled" });
    refresh(q.id);
    return { success: "Orçamento cancelado." };
  } catch (e) {
    return failure(e);
  }
}

/* ---------- the answer ---------- */

/**
 * Records the client's answer (the rules, evidence and side effects are in
 * answerQuoteAs, shared with the app's quotes.answer). The evidence is this
 * request's IP and when its session was opened.
 */
export async function answerQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  let input: QuoteAnswer;
  let evidence: DecisionEvidence;
  try {
    input = {
      id: id.parse(form.get("id")),
      decision: z.enum(["accept", "decline"]).parse(form.get("decision")),
      note: quoteNoteField.parse(form.get("note") ?? ""),
      consent: form.get("consent") === "on" || form.get("consent") === "yes",
    };
    evidence = await requestEvidence();
  } catch (e) {
    return failure(e);
  }
  return answerQuoteAs(actor, input, evidence);
}

/**
 * The project an accepted proposal describes: one card per task in A fazer,
 * with its code and its phase as the label, after the two steps every
 * project starts with. Staff only, once per proposal; the client sees the
 * project as soon as it exists, so the team confirms a preview first.
 */
export async function createProjectFromQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const quoteId = id.parse(form.get("id"));
    const created = await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for("update");
      if (!q || q.status !== "accepted") throw new Error("Só um orçamento aceito vira projeto.");
      const [existing] = await tx.select({ id: engagements.id }).from(engagements).where(eq(engagements.quoteId, q.id));
      if (existing) throw new Error("Este orçamento já tem projeto. Abra o que existe pelo orçamento.");
      const accepted = q.publication ?? { ...q.content, title: q.title };
      const [project] = await tx
        .insert(engagements)
        .values({
          companyId: q.companyId,
          name: accepted.title.slice(0, 160),
          kind: "project",
          quoteId: q.id,
          description: accepted.summary.trim().slice(0, 3000) || null,
        })
        .returning({ id: engagements.id, companyId: engagements.companyId });
      const cards = quoteBoardTasks(accepted);
      if (cards.length)
        await tx.insert(tasks).values(
          cards.map((card, index) => ({
            engagementId: project.id,
            companyId: project.companyId,
            title: card.title,
            description: card.description || null,
            status: "todo" as const,
            labels: card.labels,
            position: (index + 1) * 1024,
            createdBy: actor.user.id,
          })),
        );
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: q.companyId,
        action: "engagement.created",
        entityId: project.id,
        details: { quoteId: q.id, tasks: cards.length },
      });
      return { id: project.id, cards: cards.length };
    });
    revalidatePath("/projetos");
    refresh(quoteId);
    return { success: `Projeto criado com ${created.cards} cartões em A fazer.`, href: `/projetos/${created.id}` };
  } catch (e) {
    return failure(e);
  }
}
