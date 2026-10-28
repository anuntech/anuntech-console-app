import type { PageAction } from "./assistant-stream";

/*
 * "Confirmar todos" on the cards of one answer. Each card still goes through
 * its own confirmation (nonce, hash, the person's access, once); this only
 * says which cards one click may decide, and how their page actions merge.
 * No DOM and no server code, so tests import it.
 */

type Card = { status: string; tainted: boolean; path: string | null };

/**
 * The cards one click decides, in the order the answer showed them.
 * Discarding takes every pending card. Confirming leaves out the ones that
 * need a look of their own: prepared after reading someone else's text
 * (they carry the warning) and screen actions (they belong to one page).
 */
export function batchOf<T extends Card>(cards: readonly T[], decision: "confirmar" | "descartar"): T[] {
  return cards.filter((card) => card.status === "pending" && (decision === "descartar" || (!card.tainted && !card.path)));
}

/**
 * Whether an answer shows the buttons for all: at least two cards one click
 * would confirm, counting those already on their way (so the buttons stay,
 * saying "Fazendo…", while the batch runs).
 */
export const offersBatch = (cards: readonly Card[]) =>
  batchOf(cards.map((card) => (card.status === "busy" ? { ...card, status: "pending" } : card)), "confirmar").length >= 2;

/** What the confirmed cards ask of the page, once each: eleven refreshes are one. */
export function mergeActions(actions: readonly PageAction[]): PageAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = JSON.stringify(action);
    return seen.has(key) ? false : (seen.add(key), true);
  });
}
