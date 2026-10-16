/*
 * How a link in the assistant's answer opens. A model can be steered by text
 * it read, so a link must say where it goes: a path of the Console opens in
 * the app; anything else opens in a new tab with its domain shown beside the
 * label; the rest is plain text.
 */

const BASE = "https://console.invalid";

export type LinkTarget = { kind: "internal"; href: string } | { kind: "external"; href: string; host: string } | { kind: "text" };

export function linkTarget(href: string): LinkTarget {
  // "/x" yes; "//evil.com" and "/\evil.com" (browsers read the backslash as a slash) no.
  if (/^\/(?![/\\])/.test(href)) {
    try {
      // Tabs and newlines vanish when a URL is parsed ("/\t/evil.com" becomes "//evil.com"): the origin decides.
      const url = new URL(href, BASE);
      if (url.origin === BASE) return { kind: "internal", href: `${url.pathname}${url.search}${url.hash}` };
    } catch {
      /* unparsable: plain text */
    }
    return { kind: "text" };
  }
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      return { kind: "external", href: url.toString(), host: url.hostname };
    } catch {
      /* unparsable: plain text */
    }
  }
  return { kind: "text" };
}
