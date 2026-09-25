import "server-only";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { allowedIds, canAccess, type Actor } from "./access";
import type { Area } from "./permissions";

/* Shared plumbing for the assistant's tools: types, access scoping, form submission. */

export type ClientAction =
  | { type: "navigate"; href: string }
  | { type: "open_support" }
  | { type: "fill"; fields: { campo: string; valor: string }[]; submit: boolean }
  | { type: "click"; text: string };
export type ToolOutcome = { result: unknown; summary: string; actions?: ClientAction[] };
export type ToolContext = { actor: Actor; today: string };

/** A message the model should relay; anything else is a bug and stays generic. */
export class ToolError extends Error {}

export type AnyTool = {
  name: string;
  description: string;
  input: z.ZodType;
  /** Hidden from clients; the executor refuses it too. */
  staffOnly?: boolean;
  /** Changes data; the consent gate runs before it. */
  write?: boolean;
  run: (ctx: ToolContext, input: never) => Promise<ToolOutcome>;
};
export function tool<S extends z.ZodType>(def: {
  name: string;
  description: string;
  input: S;
  staffOnly?: boolean;
  write?: boolean;
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
  if (!ids.length) throw new ToolError("Seu acesso não inclui esta área. Peça ao gestor da empresa.");
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

/** "1234,56" for the money fields the actions parse with moneyToCents. */
export const reais = (value: number) => value.toFixed(2).replace(".", ",");
