"use server";
import { createHash } from "node:crypto";
import { and, eq, isNotNull, max, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { getActor, canAccess, answersForClient, ASSISTED_DECISION, type Actor } from "../access/access";
import { auth } from "../auth/auth";
import { accountEmails, auditEvents, companies, engagements, memberships, quoteVersions, quotes, tasks, tickets, user } from "@/db/schema";
import type { ActionState } from "../action-state";
import { saoPauloDate } from "../dates";
import { currency, longDateLabel } from "../format";
import { sendOpsMail } from "../notifications/ops-alerts";
import { billingProblemsLabel, billingReadiness } from "../billing/billing-readiness";
import { deliverQuoteNotice } from "./quote-mail";
import { quoteBoardTasks } from "./quote-handoff";
import { inviteManagerOnSend } from "../access/invite-manager";
import {
  quoteContentSchema,
  quoteExpired,
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
const noteField = z.string().trim().max(1000, "A observação pode ter até mil caracteres.").default("");

const failure = (e: unknown): ActionState => ({
  error:
    e instanceof z.ZodError
      ? e.issues[0].message
      : e instanceof Error && e.message === "stale"
        ? "O orçamento mudou em outra aba. Atualize a página antes de continuar."
        : e instanceof Error && e.message
          ? e.message
          : "Não foi possível salvar o orçamento. Confira os dados e tente novamente.",
});
function refresh(quoteId?: string) {
  revalidatePath("/orcamentos");
  if (quoteId) revalidatePath(`/orcamentos/${quoteId}`);
}
/** SHA-256 of the frozen proposal; keys sorted so JSONB's own order never matters. */
const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
        )
      : value;
const hashOf = (publication: QuotePublication) => sha256(canonical(publication));

function quoteFields(form: FormData) {
  return {
    title: titleField.parse(form.get("title")),
    validUntil: civilDate.parse(form.get("validUntil") ?? "") || null,
    content: contentField.parse(form.get("content") ?? "") as QuoteContent,
  };
}

const consoleUrl = () => process.env.BETTER_AUTH_URL || "http://localhost:3100";

/** Active managers of the company: the people who can answer a proposal. */
async function companyManagers(companyId: string) {
  return db
    .select({ email: memberships.email, name: user.name })
    .from(memberships)
    .leftJoin(accountEmails, and(eq(accountEmails.email, memberships.email), isNotNull(accountEmails.verifiedAt)))
    .leftJoin(user, or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)))
    .where(and(eq(memberships.companyId, companyId), eq(memberships.active, true), eq(memberships.role, "manager")));
}

function partyFor(actor: Actor, companyId: string): "anuntech" | "client" | null {
  if (actor.admin) return "anuntech";
  return answersForClient(actor, companyId) ? "client" : null;
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
 * Records the client's answer with the evidence behind it. A manager of the
 * company answers for the client; Anuntech can record an answer received
 * outside the Console, and the record says so. Nothing else happens here:
 * contract, products and billing are created by hand from the accepted
 * proposal.
 */
export async function answerQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const quoteId = id.parse(form.get("id"));
    const decision = z.enum(["accept", "decline"]).parse(form.get("decision"));
    const note = noteField.parse(form.get("note") ?? "");
    const [q] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!q || !canAccess(actor, q.companyId, "finance")) return blocked;
    if (actor.assisting) return { error: ASSISTED_DECISION };
    const party = partyFor(actor, q.companyId);
    if (!party) return { error: "Só um Administrador da empresa pode responder ao orçamento." };
    if (q.status !== "sent" || !q.publication || !q.documentHash) return { error: "Este orçamento não está aguardando resposta." };
    if (quoteExpired(q.status, q.validUntil, saoPauloDate()))
      return {
        error:
          party === "client"
            ? "Este orçamento expirou. Peça à Anuntech uma nova versão com validade atualizada."
            : "O orçamento expirou. Volte para rascunho, ajuste a validade e envie de novo.",
      };
    if (hashOf(q.publication) !== q.documentHash) return { error: "O conteúdo não confere com o registro. Peça um novo envio." };
    if (decision === "accept" && party === "client" && form.get("consent") !== "on" && form.get("consent") !== "yes")
      return { error: "Marque que leu e concorda com a proposta para aceitar." };
    const requestHeaders = await headers();
    const session = party === "client" ? await auth.api.getSession({ headers: requestHeaders }) : null;
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;
    const status = decision === "accept" ? "accepted" : "declined";
    await db.transaction(async (tx) => {
      const [current] = await tx.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, q.id)).for("update");
      if (current?.status !== "sent") throw Error("Este orçamento já foi respondido.");
      await tx
        .update(quotes)
        .set({
          status,
          decidedAt: new Date(),
          decidedBy: actor.user.id,
          decidedParty: party,
          decidedName: actor.user.name || actor.user.email,
          decidedEmail: actor.user.email,
          decidedIp: party === "client" ? ip : null,
          decisionNote: note || null,
          revision: q.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, q.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: q.companyId,
        entityId: q.id,
        action: `quote.${status}`,
        details: { party, ip, version: q.publishedVersion, sessionStartedAt: session ? new Date(session.session.createdAt) : null },
      });
    });
    const totals = quoteTotals(q.publication);
    // The down payment cannot go out without a full billing address: the team hears it now, not on the day.
    const [payer] = status === "accepted" ? await db.select().from(companies).where(eq(companies.id, q.companyId)) : [];
    const problems = payer ? billingReadiness(payer) : [];
    const billingNote = problems.length
      ? `\n\nAtenção: ${billingProblemsLabel(problems)} no cadastro. Sem isso, a entrada e as cobranças deste cliente não saem no Inter. Corrija em ${consoleUrl()}/empresas/${q.companyId}?editar=1`
      : "";
    const who = party === "client" ? `${actor.user.name || actor.user.email} (${q.publication.companyName})` : `${actor.user.name || actor.user.email}, pela Anuntech, a pedido do cliente`;
    await sendOpsMail(
      `Orçamento ${q.publication.number} ${status === "accepted" ? "aceito" : "recusado"}: ${q.title}`,
      `${status === "accepted" ? "Aceito" : "Recusado"} por ${who} em ${longDateLabel(new Date())}.\n\nCliente: ${q.publication.companyName}\nValor: ${currency(totals.totalCents)}${note ? `\nObservação: ${note}` : ""}\n\n${status === "accepted" ? "Os próximos passos estão no orçamento, já preenchidos: contrato, projeto com o quadro das fases e as cobranças de entrada e saldo. Cada um nasce como rascunho para você conferir." : ""}${billingNote}\n\nAbrir no Console: ${consoleUrl()}/orcamentos/${q.id}`,
    );
    refresh(q.id);
    return {
      success:
        status === "accepted"
          ? party === "client"
            ? "Orçamento aceito. A Anuntech já foi avisada e entra em contato para os próximos passos."
            : "Aceite registrado."
          : party === "client"
            ? "Resposta registrada. Obrigado por avisar."
            : "Recusa registrada.",
    };
  } catch (e) {
    return failure(e);
  }
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
