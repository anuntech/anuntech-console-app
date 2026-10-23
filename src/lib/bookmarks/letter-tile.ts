/*
 * A link's tile, without calling anyone: the host's first letter on one of
 * three tones picked by a hash of the host. Pure; the app draws the same tile
 * from its own copy (mobile/src/lib/bookmark-text.ts), and
 * tests/mobile-bookmark-text.test.ts keeps the two equal.
 */

/** How many tones a tile can take (brand and neutrals, see bookmarks-view). */
export const LETTER_TONES = 3;

/** The address's host without "www.", or the text itself when it is not a URL. */
export function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The letter ("•" when the host has none) and the tone index of a link's tile. */
export function letterTile(url: string) {
  const host = linkHost(url);
  let hash = 0;
  for (const char of host) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { letter: host.replace(/^[^a-z0-9]+/i, "").charAt(0) || "•", tone: hash % LETTER_TONES };
}
