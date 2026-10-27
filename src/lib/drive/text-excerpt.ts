/* The excerpt of a content search (lib/bookmarks/bookmarks.ts), for the list. Pure; no dependency, so the browser bundle stays small. */

/** The two markers around a word the search found, in the excerpt. */
export const MARK_OPEN = "⟦";
export const MARK_CLOSE = "⟧";

/** An excerpt as pieces, for the list to highlight the words found. */
export function excerptPieces(excerpt: string) {
  const pieces: { text: string; hit: boolean }[] = [];
  for (const part of excerpt.split(MARK_OPEN)) {
    const [hit, rest] = part.includes(MARK_CLOSE) ? part.split(MARK_CLOSE, 2) : [null, part];
    if (hit) pieces.push({ text: hit, hit: true });
    if (rest) pieces.push({ text: rest, hit: false });
  }
  return pieces;
}
