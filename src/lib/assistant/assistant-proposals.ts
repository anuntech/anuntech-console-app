import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db";
import { canAccess, canSeeEngagement, canSeeTicket, type Actor } from "../access/access";
import { assistantConversations, assistantMessages, assistantProposals, auditEvents, companies, contracts, engagements, invoices, quotes, tasks, tickets } from "@/db/schema";
import { saoPauloDate } from "../dates";
import { runTool, ToolError, type ClientAction } from "./assistant-tools";
import { callHash, PROPOSAL_TTL_MS, proposalDetails, proposalLabel } from "./proposal-rules";

/*
 * Every change the assistant wants to make waits here as a proposal: one tool
 * call, its arguments and their hash, owned by the person, with a nonce only
 * their panel received. The model never sees the id or the nonce; the call
 * runs once, from the person's click, with their own access checked again.
 */

export type ProposalCard = {
  id: string;
  nonce: string;
  title: string;
  details: { label: string; value: string }[];
  /** Prepared after the turn read text written by someone else: the card says so. */
  tainted: boolean;
  /** Screen actions apply only on this page. */
  path: string | null;
  expiresAt: string;
};

const hashNonce = (nonce: string) => createHash("sha256").update(nonce).digest("hex");
const strings = (value: unknown) => (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === "string");

/**
 * Names for the ids a call carries, read with the person's own access, so the
 * card says "Chamado: Login fora do ar · Empresa B" instead of a uuid. An id
 * they cannot see refuses the card, like the tool itself would.
 */
async function referenceNames(actor: Actor, args: Record<string, unknown>) {
  const names: Record<string, string> = {};
  const missing = (what: string) => new ToolError(`${what} não encontrado. Use um id devolvido por uma ferramenta de leitura.`);
  const companyIds = strings(args.companyId);
  if (companyIds.length) {
    const rows = await db.select({ id: companies.id, name: companies.name }).from(companies).where(inArray(companies.id, companyIds));
    for (const id of companyIds) {
      const row = rows.find((r) => r.id === id);
      if (!row || !canAccess(actor, id, "overview")) throw missing("Empresa");
      names[id] = row.name;
    }
  }
  for (const id of strings(args.chamadoId)) {
    const [row] = await db
      .select({ subject: tickets.subject, companyId: tickets.companyId, engagementId: tickets.engagementId, authorId: tickets.authorId, company: companies.name })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .where(eq(tickets.id, id));
    if (!row || !canSeeTicket(actor, row)) throw missing("Chamado");
    names[id] = `${row.subject} · ${row.company}`;
  }
  for (const id of strings(args.engagementId)) {
    const [row] = await db
      .select({ id: engagements.id, name: engagements.name, companyId: engagements.companyId, company: companies.name })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(eq(engagements.id, id));
    if (!row || !canSeeEngagement(actor, row)) throw missing("Projeto");
    names[id] = `${row.name} · ${row.company}`;
  }
  const taskIds = [...strings(args.tarefaId), ...strings(args.tarefaIds)];
  if (taskIds.length) {
    const rows = await db
      .select({ id: tasks.id, title: tasks.title, engagementId: tasks.engagementId, companyId: tasks.companyId, company: companies.name })
      .from(tasks)
      .innerJoin(companies, eq(companies.id, tasks.companyId))
      .where(inArray(tasks.id, taskIds));
    for (const id of taskIds) {
      const row = rows.find((r) => r.id === id);
      if (!row || !canSeeEngagement(actor, { id: row.engagementId, companyId: row.companyId })) throw missing("Tarefa");
      names[id] = `${row.title} · ${row.company}`;
    }
  }
  const money = [
    { ids: strings(args.faturaId), table: invoices, label: invoices.description, what: "Fatura" },
    { ids: [...strings(args.orcamentoId), ...strings(args.copiarDeOrcamentoId)], table: quotes, label: quotes.title, what: "Orçamento" },
    { ids: strings(args.contratoId), table: contracts, label: contracts.title, what: "Contrato" },
  ] as const;
  for (const { ids, table, label, what } of money)
    for (const id of ids) {
      const [row] = await db
        .select({ label, companyId: table.companyId, company: companies.name })
        .from(table)
        .innerJoin(companies, eq(companies.id, table.companyId))
        .where(eq(table.id, id));
      if (!row || !canAccess(actor, row.companyId, "finance")) throw missing(what);
      names[id] = `${row.label} · ${row.company}`;
    }
  return names;
}

/** Stores the call and returns the card for the panel; throws a ToolError the model can relay. */
export async function createProposal(input: { actor: Actor; tool: string; args: Record<string, unknown>; tainted: boolean; path: string | null }): Promise<ProposalCard> {
  const names = await referenceNames(input.actor, input.args);
  const nonce = randomBytes(32).toString("base64url");
  const title = proposalLabel(input.tool, input.args);
  const details = proposalDetails(input.args, names, input.tool);
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS);
  const [row] = await db
    .insert(assistantProposals)
    .values({
      userId: input.actor.user.id,
      tool: input.tool,
      args: input.args,
      argsHash: callHash(input.tool, input.args),
      title,
      details,
      nonceHash: hashNonce(nonce),
      tainted: input.tainted,
      path: input.path,
      expiresAt,
    })
    .returning({ id: assistantProposals.id });
  return { id: row.id, nonce, title, details, tainted: input.tainted, path: input.path, expiresAt: expiresAt.toISOString() };
}

/** The turn is saved after it ends; its cards then point at the conversation so the outcome joins it. */
export async function attachProposals(userId: string, ids: string[], conversationId: string) {
  if (!ids.length) return;
  await db
    .update(assistantProposals)
    .set({ conversationId })
    .where(and(eq(assistantProposals.userId, userId), inArray(assistantProposals.id, ids)));
}

export type ProposalOutcome =
  | { ok: true; summary: string; actions: ClientAction[] }
  | { ok: false; status: number; error: string };

/** Why a click found nothing to run, in the person's words. */
async function refusal(userId: string, id: string): Promise<ProposalOutcome> {
  const [row] = await db
    .select({ status: assistantProposals.status, expiresAt: assistantProposals.expiresAt })
    .from(assistantProposals)
    .where(and(eq(assistantProposals.id, id), eq(assistantProposals.userId, userId)));
  if (!row) return { ok: false, status: 404, error: "Esta confirmação não existe mais." };
  if (row.status === "done") return { ok: false, status: 409, error: "Esta ação já foi feita." };
  if (row.status === "dismissed") return { ok: false, status: 409, error: "Esta ação foi descartada." };
  if (row.status !== "pending") return { ok: false, status: 409, error: "Esta ação já foi tentada. Peça de novo ao assistente." };
  if (row.expiresAt <= new Date()) return { ok: false, status: 410, error: "A confirmação expirou. Peça de novo ao assistente." };
  return { ok: false, status: 403, error: "Confirmação inválida." };
}

/** Uuids the outcome carries (a new project's engagementId), so the next message can build on it. */
function idsOf(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return [];
  return Object.entries(result).filter(([key, value]) => key.endsWith("Id") && typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)).map(([key, value]) => `${key} ${value}`);
}

/**
 * The click: claims the pending proposal atomically (one execution, even with
 * two clicks), checks the stored call against its hash and runs it with the
 * clicking person's own access. The conversation gets a line saying what was
 * done, without the text of the records involved.
 */
export async function confirmProposal(actor: Actor, id: string, nonce: string): Promise<ProposalOutcome> {
  const [claimed] = await db
    .update(assistantProposals)
    .set({ status: "running", decidedAt: new Date() })
    .where(
      and(
        eq(assistantProposals.id, id),
        eq(assistantProposals.userId, actor.user.id),
        eq(assistantProposals.nonceHash, hashNonce(nonce)),
        eq(assistantProposals.status, "pending"),
        gt(assistantProposals.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!claimed) return refusal(actor.user.id, id);
  const intact = callHash(claimed.tool, claimed.args) === claimed.argsHash;
  const outcome = intact
    ? await runTool({ actor, today: saoPauloDate() }, claimed.tool, JSON.stringify(claimed.args))
    : { error: "Os dados desta ação mudaram depois de preparados. Peça de novo ao assistente." };
  const ok = !("error" in outcome);
  await db
    .update(assistantProposals)
    .set(ok ? { status: "done", result: { summary: outcome.summary } } : { status: "failed", result: { summary: "", error: outcome.error } })
    .where(eq(assistantProposals.id, id));
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    entityId: id,
    action: ok ? "assistant.proposal_done" : "assistant.proposal_failed",
    details: { tool: claimed.tool, argsHash: claimed.argsHash, tainted: claimed.tainted },
  });
  if (claimed.conversationId) {
    const link = ok && outcome.result && typeof outcome.result === "object" && "link" in outcome.result ? String((outcome.result as { link: unknown }).link ?? "") : "";
    const content = ok
      ? [`Feito pelo cartão de confirmação: ${claimed.title}.`, ...idsOf(outcome.result), link.startsWith("/") ? `[Abrir](${link})` : ""].filter(Boolean).join(" ")
      : `O cartão "${claimed.title}" foi confirmado, mas não deu certo: ${outcome.error}`;
    await db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: assistantConversations.id })
        .from(assistantConversations)
        .where(and(eq(assistantConversations.id, claimed.conversationId!), eq(assistantConversations.userId, actor.user.id)));
      if (!owned) return;
      await tx.insert(assistantMessages).values({ conversationId: owned.id, role: "assistant", content });
      await tx.update(assistantConversations).set({ updatedAt: new Date() }).where(eq(assistantConversations.id, owned.id));
    });
  }
  if (!ok) return { ok: false, status: 422, error: outcome.error };
  const actions = outcome.actions?.length ? outcome.actions : [{ type: "refresh" as const }];
  return { ok: true, summary: outcome.summary, actions };
}

export async function dismissProposal(actor: Actor, id: string, nonce: string) {
  const dismissed = await db
    .update(assistantProposals)
    .set({ status: "dismissed", decidedAt: new Date() })
    .where(
      and(
        eq(assistantProposals.id, id),
        eq(assistantProposals.userId, actor.user.id),
        eq(assistantProposals.nonceHash, hashNonce(nonce)),
        eq(assistantProposals.status, "pending"),
      ),
    )
    .returning({ id: assistantProposals.id });
  return dismissed.length > 0;
}
