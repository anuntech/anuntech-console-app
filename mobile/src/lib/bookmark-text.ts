import { fileSize } from "./format";

/*
 * How a bookmark and a folder read in the app, in the web's words. Pure and
 * dependency-free (tests/mobile-bookmark-text.test.ts).
 */

type Item = { kind: "link" | "file" | "board"; url: string | null; fileName: string | null; fileSize: number | null };
type Folder = { visibility: "company" | "people"; ownerId: string; owner: string; sharedWith: unknown[] };

/** The site's address without the scheme, path and "www." ("console.anuntech.com"). */
export function hostOf(url: string | null) {
  if (!url) return null;
  return url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0]?.replace(/^www\./, "") || null;
}

/** The host as the web's tile reads it (URL.hostname without "www."), or the text itself when it is not a URL. */
function tileHost(url: string) {
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(url);
  if (!scheme) return url;
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#\\]*)/i.exec(url)?.[1];
  if (authority === undefined) return "";
  const at = authority.slice(authority.lastIndexOf("@") + 1);
  const host = at.startsWith("[") ? at.slice(0, at.indexOf("]") + 1) : at.replace(/:\d*$/, "");
  return host ? host.toLowerCase().replace(/^www\./, "") : url;
}

/**
 * A link's tile, as the web draws it, without calling anyone: the host's first
 * letter ("•" when it has none) on one of three tones picked by a hash of the
 * host. Same as src/lib/bookmarks/letter-tile.ts (the test keeps them equal).
 */
export function letterTile(url: string) {
  const host = tileHost(url);
  let hash = 0;
  for (const char of host) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { letter: host.replace(/^[^a-z0-9]+/i, "").charAt(0) || "•", tone: hash % 3 };
}

/** What the web's list says under the title: host, file name and size, or "Lousa". */
export function describe(item: Item) {
  if (item.kind === "board") return "Lousa";
  if (item.kind === "link") return hostOf(item.url);
  return [item.fileName, item.fileSize ? fileSize(item.fileSize) : null].filter(Boolean).join(" · ");
}

/** "Toda a empresa", "Só você", "Só Ana e 2 pessoas": the web's header line of a folder. */
export function audience(folder: Folder, viewerId: string | undefined) {
  if (folder.visibility === "company") return "Toda a empresa";
  const owner = folder.ownerId === viewerId ? "você" : folder.owner;
  const n = folder.sharedWith.length;
  return n ? `Só ${owner} e ${n} ${n === 1 ? "pessoa" : "pessoas"}` : `Só ${owner}`;
}

/** What deleting also takes away: the web's ", com o arquivo" / ", com o desenho". */
export const deleteNote = (item: Pick<Item, "kind">) =>
  item.kind === "file" ? ", com o arquivo" : item.kind === "board" ? ", com o desenho" : "";
