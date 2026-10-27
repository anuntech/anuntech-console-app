import { fileSize, when } from "./format";

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

/* ---------- The cards and the viewer (the web's file-card.tsx and file-preview.tsx) ---------- */

/** What kind of file an item is, for its icon and badge: the web's src/lib/bookmarks/file-types.ts (the test keeps them equal). */
export type FileGroup = "image" | "video" | "audio" | "pdf" | "document" | "sheet" | "slides" | "archive" | "code" | "design" | "other";

const GROUPS: [FileGroup, string[]][] = [
  ["image", ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "svg", "tif", "tiff", "bmp", "ico", "raw", "dng"]],
  ["video", ["mp4", "mov", "m4v", "webm", "avi", "mkv", "wmv"]],
  ["audio", ["mp3", "m4a", "wav", "ogg", "aac", "flac", "opus"]],
  ["pdf", ["pdf"]],
  ["document", ["doc", "docx", "odt", "rtf", "txt", "md", "pages"]],
  ["sheet", ["xls", "xlsx", "xlsm", "csv", "tsv", "ods", "numbers"]],
  ["slides", ["ppt", "pptx", "key", "odp"]],
  ["archive", ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]],
  ["code", ["json", "xml", "html", "htm", "css", "js", "ts", "tsx", "jsx", "py", "sql", "yml", "yaml", "sh"]],
  ["design", ["fig", "sketch", "xd", "ai", "psd", "eps", "indd", "afdesign"]],
];
const BY_EXTENSION = new Map(GROUPS.flatMap(([group, extensions]) => extensions.map((ext) => [ext, group] as const)));

export const extensionOf = (fileName: string | null | undefined) =>
  fileName && fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase().slice(0, 8) : "";

/** "PDF", "DOCX" or "ARQUIVO", and the group that picks the icon. */
export function fileTypeOf(fileName: string | null | undefined): { group: FileGroup; label: string } {
  const ext = extensionOf(fileName);
  return { group: BY_EXTENSION.get(ext) ?? "other", label: ext ? ext.toUpperCase() : "ARQUIVO" };
}

/** The groups whose text, when the Console read it, shows as the top of a page. */
export const showsPage = (group: FileGroup) => group === "pdf" || group === "document" || group === "sheet" || group === "slides" || group === "code";

/**
 * "Copiar link": the item's address in the Console (the web's ?abrir=), which
 * opens only for who already sees it. `base` is the Console's address.
 */
export const itemLink = (base: string, id: string) => `${base.replace(/\/+$/, "")}/bookmarks?abrir=${encodeURIComponent(id)}`;

/** Where an item sits among the list's files, for the viewer's arrows: "2 de 14", and who is before and after. */
export function neighbours(ids: string[], id: string) {
  const at = ids.indexOf(id);
  return {
    at,
    previous: at > 0 ? ids[at - 1] : null,
    next: at >= 0 && at < ids.length - 1 ? ids[at + 1] : null,
    label: ids.length > 1 && at >= 0 ? `${at + 1} de ${ids.length}` : null,
  };
}

type Detailed = {
  fileName: string | null;
  fileSize: number | null;
  folderId: string | null;
  companyId: string | null;
  tag?: string | null;
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The viewer's "Detalhes", in the web's words and order. */
export function fileDetails(item: Detailed, folderName: (id: string) => string | undefined, companyName: (id: string) => string | undefined): [string, string][] {
  return [
    ["Tipo", fileTypeOf(item.fileName).label],
    ["Tamanho", item.fileSize ? fileSize(item.fileSize) : "—"],
    ["Pasta", item.folderId ? (folderName(item.folderId) ?? "—") : "Sem pasta"],
    ["Empresa", item.companyId ? (companyName(item.companyId) ?? "—") : "Anuntech"],
    ["Etiqueta", item.tag ? (TAG_LABELS[item.tag] ?? item.tag) : "—"],
    ["Adicionado por", item.ownerName ?? "—"],
    ["Adicionado em", when(item.createdAt)],
    ["Alterado em", when(item.updatedAt || item.createdAt)],
  ];
}

/** The rail's own views, as chips: "Recentes" and "Com estrela" (with how many). */
export function viewChips(starredCount: number | undefined) {
  return [
    { value: "recentes", label: "Recentes" },
    { value: "estrela", label: starredCount ? `Com estrela · ${starredCount}` : "Com estrela" },
  ];
}
