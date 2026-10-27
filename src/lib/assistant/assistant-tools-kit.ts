import "server-only";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { allowedIds, canAccess, type Actor } from "../access/access";
import type { Area } from "../access/permissions";
import type { PageSnapshot } from "./page-snapshot";
import type { PageAction } from "./assistant-stream";

/* Shared plumbing for the assistant's tools: types, access scoping, form submission. */

/** What a tool asks of the page; the same shape the panel reads (assistant-stream.ts). */
export type ClientAction = PageAction;
export type ToolOutcome = { result: unknown; summary: string; actions?: ClientAction[] };
export type ToolContext = {
  actor: Actor;
  today: string;
  /** The screen the person is on, as the panel reported it; the screen tools check against it. */
  page?: PageSnapshot;
  /** Companies whose text, written by someone else, entered this turn (see `untrusted`). */
  tainted?: Set<string>;
};

/**
 * Text someone else wrote (a client's ticket, a comment, a task) goes to the
 * model wrapped with its origin and marked untrusted, so it reads as data and
 * never as an instruction; the system prompt has a fixed rule for it. Reading
 * it also narrows the rest of the turn to that company (see assistant.ts).
 */
export function untrusted(ctx: ToolContext, companyId: string, origem: string, texto: string | null | undefined) {
  if (!texto) return texto ?? null;
  ctx.tainted?.add(companyId);
  return { origem, nao_confiavel: true as const, texto };
}

/** A message the model should relay; anything else is a bug and stays generic. */
export class ToolError extends Error {}

/** Which part of the Console a tool serves; Jev picks the areas a message needs. Core tools have none. */
export const toolAreas = {
  empresas: "Empresas e clientes: dados cadastrais, pessoas com acesso, cadastrar ou alterar empresa, dar acesso",
  financeiro: "Financeiro: faturas, boletos, Pix, cobranças em rascunho, recorrências, totais, avisos de cobrança, quem deve",
  chamados: "Chamados de suporte: ler a conversa, abrir, responder, mudar situação ou responsável",
  projetos: "Projetos e tarefas: quadro, criar, alterar, mover ou excluir tarefas, ler ou escrever comentários nas tarefas, criar ou alterar projeto",
  produtos: "Produtos, serviços e catálogo: o que a empresa contratou, vincular item do catálogo, cadastrar item",
  contratos: "Contratos: texto, vigência, modelos, criar rascunho",
  orcamentos: "Orçamentos e propostas: ler, criar, copiar, alterar, duplicar",
  bookmarks: "Arquivos (antes Bookmarks): achar arquivos pelo nome ou pelo que está escrito neles, ler e resumir o texto de um arquivo, links e lousas em pastas",
  tela: "Preencher, completar ou acionar o formulário aberto na tela agora",
} as const;
export type ToolArea = keyof typeof toolAreas;

export type AnyTool = {
  name: string;
  description: string;
  input: z.ZodType;
  area?: ToolArea;
  /** Hidden from clients; the executor refuses it too. */
  staffOnly?: boolean;
  /** Pointless for staff (they are the team); hidden from them. */
  clientOnly?: boolean;
  /** Changes data: the call becomes a confirmation card and runs only from its click. */
  write?: boolean;
  /** Settles the arguments a card will carry (the form a fill targets); throws a ToolError to refuse. */
  prepare?: (ctx: ToolContext, input: never) => Record<string, unknown>;
  run: (ctx: ToolContext, input: never) => Promise<ToolOutcome>;
};
export function tool<S extends z.ZodType>(def: {
  name: string;
  description: string;
  input: S;
  area?: ToolArea;
  staffOnly?: boolean;
  clientOnly?: boolean;
  write?: boolean;
  prepare?: (ctx: ToolContext, input: z.output<S>) => Record<string, unknown>;
  run: (ctx: ToolContext, input: z.output<S>) => Promise<ToolOutcome>;
}): AnyTool {
  return def as unknown as AnyTool;
}

export const id = z.string().uuid();
export const limit = (fallback: number) => z.number().int().min(1).max(50).default(fallback);
export const civilDate = z.union([z.iso.date(), z.literal("")]);

/** Which companies a read may span: a list for clients, `null` (all) for staff. */
export function scopeOf(actor: Actor, area: Area, companyId?: string) {
  if (companyId) {
    if (!canAccess(actor, companyId, area)) throw new ToolError("Você não tem acesso a essa empresa nesta área.");
    return [companyId];
  }
  if (actor.admin) return null;
  const ids = allowedIds(actor, area);
  if (!ids.length) throw new ToolError("Seu acesso não inclui esta área. Peça a um Administrador da empresa.");
  return ids;
}
export const within = <T extends { companyId: unknown }>(column: T["companyId"], ids: string[] | null) =>
  ids ? inArray(column as never, ids) : undefined;

export const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Runs an existing server action with the given fields; its validation and permissions apply. */
export async function submit(
  action: (state: object, form: FormData) => Promise<{ error?: string; success?: string; href?: string }>,
  fields: Record<string, string | undefined>,
  repeated: Record<string, string[]> = {},
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.set(key, value);
  for (const [key, values] of Object.entries(repeated)) for (const value of values) form.append(key, value);
  const state = await action({}, form);
  if (state.error) throw new ToolError(state.error);
  return state;
}

/** People for a task: user ids from ler_projeto, or "eu"/"mim"/the person's e-mail for themselves. */
export const resolvePeople = (actor: Actor, people: string[] | undefined) =>
  people?.map((value) => (["eu", "mim", "me", actor.user.email.toLowerCase()].includes(value.trim().toLowerCase()) ? actor.user.id : value.trim()));

/** "1234,56" for the money fields the actions parse with moneyToCents. */
export const reais = (value: number) => value.toFixed(2).replace(".", ",");
