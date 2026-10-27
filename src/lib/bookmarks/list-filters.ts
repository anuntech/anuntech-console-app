/*
 * Arquivos' list filters and order (the "Tipo" and "Ordem" pickers): pure, so
 * the page, the query and the tests read the same names. A file's type is
 * its extension.
 */

export const KIND_FILTERS = [
  { value: "arquivos", label: "Arquivos" },
  { value: "links", label: "Links" },
  { value: "lousas", label: "Lousas" },
  { value: "pdf", label: "PDF" },
  { value: "imagens", label: "Imagens" },
  { value: "videos", label: "Vídeos" },
  { value: "documentos", label: "Documentos" },
  { value: "planilhas", label: "Planilhas" },
  { value: "apresentacoes", label: "Apresentações" },
] as const;
export type KindFilter = (typeof KIND_FILTERS)[number]["value"];

/** The extensions of each file group. */
export const KIND_EXTENSIONS: Partial<Record<KindFilter, string[]>> = {
  pdf: ["pdf"],
  imagens: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "svg", "tif", "tiff", "bmp"],
  videos: ["mp4", "mov", "m4v", "webm", "avi", "mkv", "wmv"],
  documentos: ["doc", "docx", "odt", "rtf", "txt", "md", "pages"],
  planilhas: ["xls", "xlsx", "xlsm", "csv", "tsv", "ods", "numbers"],
  apresentacoes: ["ppt", "pptx", "key", "odp"],
};

/** The regular expression a file name matches for a group ("\.(pdf)$"), or null for the other filters. */
export const extensionPattern = (kind: KindFilter) => (KIND_EXTENSIONS[kind] ? `\\.(${KIND_EXTENSIONS[kind]!.join("|")})$` : null);

export const SORTS = [
  { value: "", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "nome", label: "Nome (A–Z)" },
  { value: "tamanho", label: "Maiores primeiro" },
] as const;
export type SortOrder = (typeof SORTS)[number]["value"];

export const isKindFilter = (value: string): value is KindFilter => KIND_FILTERS.some((k) => k.value === value);
export const isSortOrder = (value: string): value is SortOrder => SORTS.some((s) => s.value === value);
