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

/** What going to the trash also takes along: the web's ", com o arquivo" / ", com o desenho". */
export const deleteNote = (item: Pick<Item, "kind">) =>
  item.kind === "file" ? ", com o arquivo" : item.kind === "board" ? ", com o desenho" : "";

/* ---------- Arquivos as the web has it (subfolders, tags, filters, trash) ---------- */

type TreeFolder = { id: string; name: string; parentId?: string | null };

/** The folders at one level: the top (a folder whose parent the person cannot see shows there too), or inside `parentId`. */
export function childrenOf<T extends TreeFolder>(folders: T[], parentId: string | null): T[] {
  const ids = new Set(folders.map((f) => f.id));
  return folders
    .filter((f) => (parentId ? f.parentId === parentId : !f.parentId || !ids.has(f.parentId)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** From the top to the folder itself (Marca › Logo › SVG). */
export function folderTrail<T extends TreeFolder>(folders: T[], id: string): T[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const trail: T[] = [];
  const seen = new Set<string>();
  for (let current = byId.get(id); current && !seen.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined) {
    seen.add(current.id);
    trail.unshift(current);
  }
  return trail;
}

/** Every folder in tree order, each with its depth, for the pickers. */
export function folderTree<T extends TreeFolder>(folders: T[]): (T & { depth: number })[] {
  const out: (T & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const f of childrenOf(folders, parent)) {
      if (out.some((o) => o.id === f.id)) continue;
      out.push({ ...f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** The tags' names, as the web's (src/lib/drive/tag-rules.ts; the test keeps them equal). */
export const TAG_LABELS: Record<string, string> = {
  contrato: "Contrato",
  proposta: "Proposta",
  "nota-fiscal": "Nota fiscal",
  boleto: "Boleto",
  comprovante: "Comprovante",
  relatorio: "Relatório",
  apresentacao: "Apresentação",
  planilha: "Planilha",
  marca: "Marca e logo",
  foto: "Foto",
  video: "Vídeo",
  "documento-pessoal": "Documento pessoal",
  ata: "Ata",
  briefing: "Briefing",
};

/** The web's "Tipo" and "Ordem" (src/lib/bookmarks/list-filters.ts; the test keeps them equal). */
export const KIND_OPTIONS = [
  { value: "", label: "Todos os tipos" },
  { value: "arquivos", label: "Arquivos" },
  { value: "links", label: "Links" },
  { value: "lousas", label: "Lousas" },
  { value: "pdf", label: "PDF" },
  { value: "imagens", label: "Imagens" },
  { value: "videos", label: "Vídeos" },
  { value: "documentos", label: "Documentos" },
  { value: "planilhas", label: "Planilhas" },
  { value: "apresentacoes", label: "Apresentações" },
];
export const SORT_OPTIONS = [
  { value: "", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "nome", label: "Nome (A–Z)" },
  { value: "tamanho", label: "Maiores primeiro" },
];

/** Where a search found its words in the file, as pieces to show the words in bold. */
export function excerptParts(excerpt: string) {
  const parts: { text: string; hit: boolean }[] = [];
  for (const piece of excerpt.split("⟦")) {
    const [hit, rest] = piece.includes("⟧") ? piece.split("⟧", 2) : [null, piece];
    if (hit) parts.push({ text: hit, hit: true });
    if (rest) parts.push({ text: rest, hit: false });
  }
  return parts;
}

/** "some em 27 dias" under an item in the trash (30 days from when it was deleted). */
export function trashNote(deletedAt: string, now = Date.now()) {
  const left = Math.max(0, Math.ceil((new Date(deletedAt).getTime() + 30 * 86_400_000 - now) / 86_400_000));
  return left === 0 ? "some hoje" : `some em ${left === 1 ? "1 dia" : `${left} dias`}`;
}
