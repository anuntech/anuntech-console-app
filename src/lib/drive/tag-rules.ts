/*
 * Arquivos' tags (phase 4c): one per item, from a fixed list, so the list can
 * be filtered the same way in every company. The Console suggests one for
 * each file from its name, its kind and the start of its text (rules, here,
 * pure); only when no rule fits, the model picks one from the list
 * (lib/drive/file-tags.ts). A tag a person chose is never changed.
 */

export const TAGS = [
  { slug: "contrato", label: "Contrato" },
  { slug: "proposta", label: "Proposta" },
  { slug: "nota-fiscal", label: "Nota fiscal" },
  { slug: "boleto", label: "Boleto" },
  { slug: "comprovante", label: "Comprovante" },
  { slug: "relatorio", label: "Relatório" },
  { slug: "apresentacao", label: "Apresentação" },
  { slug: "planilha", label: "Planilha" },
  { slug: "marca", label: "Marca e logo" },
  { slug: "foto", label: "Foto" },
  { slug: "video", label: "Vídeo" },
  { slug: "documento-pessoal", label: "Documento pessoal" },
  { slug: "ata", label: "Ata" },
  { slug: "briefing", label: "Briefing" },
] as const;
export type TagSlug = (typeof TAGS)[number]["slug"];
export const TAG_SLUGS = TAGS.map((t) => t.slug) as [TagSlug, ...TagSlug[]];
export const tagLabels = Object.fromEntries(TAGS.map((t) => [t.slug, t.label])) as Record<TagSlug, string>;
export const isTag = (value: unknown): value is TagSlug => typeof value === "string" && (TAG_SLUGS as string[]).includes(value);

/** Who set an item's tag: the Console's suggestion, or a person (whose choice, even "none", stays). */
export type TagSource = "auto" | "person";

/** Lowercase, accents out, so "Relatório" and "relatorio" read the same. */
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

type Rule = [TagSlug, RegExp];
/** By the item's title and file name: what a person called it says most. Personal documents first. */
const BY_NAME: Rule[] = [
  ["documento-pessoal", /\b(rg|cnh|cpf|identidade|passaporte|certidao de (nascimento|casamento)|comprovante de (residencia|endereco))\b/],
  ["nota-fiscal", /\b(nf|nfe|nfs ?e|nota fiscal|notas fiscais|danfe)\b/],
  ["boleto", /\bboletos?\b/],
  ["comprovante", /\b(comprovantes?|recibos?)\b/],
  ["contrato", /\b(contratos?|aditivos?|distrato)\b/],
  ["proposta", /\b(propostas?|orcamentos?|cotacao|cotacoes)\b/],
  ["relatorio", /\b(relatorios?|report)\b/],
  ["ata", /\b(atas?|ata de reuniao)\b/],
  ["briefing", /\bbriefings?\b/],
  ["apresentacao", /\b(apresentacao|apresentacoes|deck|pitch|slides)\b/],
  ["marca", /\b(logo|logos|logotipo|logomarca|marca|brand|favicon|identidade visual|manual da marca)\b/],
];
/** By the start of the text, when the name says nothing. */
const BY_TEXT: Rule[] = [
  ["nota-fiscal", /\b(danfe|nota fiscal( de servicos)? eletronica|nfs-e|documento auxiliar da nota fiscal)\b/],
  ["boleto", /\b(linha digitavel|pagavel (em qualquer banco|preferencialmente))\b/],
  ["comprovante", /\bcomprovante de (pagamento|transferencia|pix|deposito)\b/],
  ["contrato", /\b(contrato de|contratante|contratada|clausula primeira)\b/],
  ["proposta", /\b(proposta comercial|proposta de (servicos|prestacao)|orcamento)\b/],
  ["ata", /\b(ata da reuniao|ata de reuniao|pauta da reuniao)\b/],
  ["relatorio", /^\W*relatorio\b/],
  ["briefing", /^\W*briefing\b/],
];
const BY_KIND: [TagSlug, Set<string>][] = [
  ["apresentacao", new Set(["ppt", "pptx", "pptm", "key", "odp"])],
  ["planilha", new Set(["xls", "xlsx", "xlsm", "csv", "tsv", "ods", "numbers"])],
  ["foto", new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "tif", "tiff", "bmp", "raw", "dng"])],
  ["video", new Set(["mp4", "mov", "m4v", "webm", "avi", "mkv", "wmv"])],
];
/** A logo is usually a drawing: these kinds named like a brand read as "Marca e logo", not as a photo. */
const VECTOR = new Set(["svg", "ai", "eps", "pdf", "png"]);

/** The tag the rules suggest for a file, or null when none fits (then the model may be asked). */
export function suggestTag({ title, fileName, text }: { title: string; fileName: string; text?: string | null }): TagSlug | null {
  const name = plain(`${title} ${fileName.replace(/[_.-]+/g, " ")}`);
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  for (const [tag, pattern] of BY_NAME) {
    if (!pattern.test(name)) continue;
    // "Marca" only for something that can be a logo; a spreadsheet called "Marcas" is a spreadsheet.
    if (tag === "marca" && !VECTOR.has(ext) && !BY_KIND.find(([t]) => t === "foto")![1].has(ext)) continue;
    return tag;
  }
  const head = plain((text ?? "").slice(0, 3000));
  for (const [tag, pattern] of BY_TEXT) if (pattern.test(head)) return tag;
  for (const [tag, kinds] of BY_KIND) if (kinds.has(ext)) return tag;
  return null;
}
