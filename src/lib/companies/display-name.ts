/*
 * How a company is named on screen.
 *
 * The database keeps one name per company: the razão social, exactly as the
 * Receita Federal registers it (console_companies.name). That is the name for
 * documents (cadastro card, invoices, contracts, quotes, PDFs) and stays
 * untouched there. Everywhere else (titles, lists, cards, links, sentences)
 * the person reads the display name: the same name without the MEI number,
 * without the legal suffix and, when the registry wrote it all in capitals,
 * in normal case.
 *
 *   "46.301.732 ALINE DE SOUZA BEZERRA" (CNPJ 46.301.732/0001-12)
 *     → "Aline de Souza Bezerra"
 *   "CLINICA VIDA PLENA LTDA" → "Clinica Vida Plena"
 *   "Anuntech Tecnologia Ltda." → "Anuntech Tecnologia"
 *
 * Pure and dependency-free, so it runs on the server, in the browser and in tests.
 */

const digits = (value: string) => value.replace(/\D/g, "");

/** Leading CNPJ root of a MEI razão social: "46.301.732 NOME", "46301732 - NOME". */
const LEADING_ROOT = /^\s*(\d{2}\.?\d{3}\.?\d{3})(?:\s*[-–]\s*|\s+)(?=\S)/;
/** Trailing CPF of an older MEI razão social: "NOME 123.456.789-01". */
const TRAILING_CPF = /(?:\s*[-–]\s*|\s+)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\s*$/;

/**
 * The razão social without the numbers the Receita glues to a MEI's name: the
 * CNPJ root in front, when it is the root of this company's CNPJ, and a CPF at
 * the end, when the company has a CNPJ. Casing and suffix stay as they are.
 */
export function stripMeiNumbers(name: string, document?: string | null) {
  const cnpj = digits(document ?? "");
  if (cnpj.length !== 14) return name.trim();
  let rest = name;
  const root = LEADING_ROOT.exec(rest);
  if (root && digits(root[1]) === cnpj.slice(0, 8)) rest = rest.slice(root[0].length);
  rest = rest.replace(TRAILING_CPF, "");
  return rest.trim() || name.trim();
}

/** Legal-nature suffixes that say what kind of company it is, not who it is. */
const SUFFIX =
  /(?:[\s,–-]+)(?:LTDA\.?|EIRELI|EPP|MEI|ME|S\/A|S\.\s?A\.?|SA|S\/S|SS|SLU|SOCIEDADE\s+LIMITADA)\s*$/i;

/** "PADARIA BOM GRAO LTDA ME" → "PADARIA BOM GRAO". Never leaves less than two letters. */
export function stripLegalSuffix(name: string) {
  let rest = name.trim();
  for (let guard = 0; guard < 3; guard++) {
    const next = rest.replace(SUFFIX, "").replace(/[\s,–-]+$/, "");
    if (next === rest || next.replace(/[^\p{L}]/gu, "").length < 2) break;
    rest = next;
  }
  return rest;
}

/** Joining words that stay lowercase inside a Brazilian name. */
const CONNECTORS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "di", "du", "e", "em", "na", "no", "nas", "nos", "para", "por", "com"]);
const VOWEL = /[aeiouáàâãéêíóôõúü]/i;
const ROMAN = /^[IVX]{2,4}$/;

function caseWord(word: string, first: boolean) {
  if (!/\p{L}/u.test(word) || /\d/.test(word)) return word;
  // Acronyms and roman numerals keep their capitals: "BRF", "SP", "III".
  if ((!VOWEL.test(word) && word.length <= 4) || ROMAN.test(word)) return word;
  const lower = word.toLocaleLowerCase("pt-BR");
  if (!first && CONNECTORS.has(lower)) return lower;
  // "AUTO-PECAS" → "Auto-Pecas", "D'ÁVILA" → "D'Ávila".
  return lower.replace(/(^|[-'’/])(\p{L})/gu, (_, mark: string, letter: string) => mark + letter.toLocaleUpperCase("pt-BR"));
}

/**
 * Normal case for a name the registry wrote all in capitals. A name that
 * already has lowercase letters was typed by a person and is kept as typed.
 */
export function readableCase(name: string) {
  if (name !== name.toLocaleUpperCase("pt-BR")) return name;
  return name
    .split(/(\s+)/)
    .map((part, index) => (/^\s+$/.test(part) ? part : caseWord(part, index === 0)))
    .join("");
}

/**
 * The name people read: no MEI numbers, no legal suffix, normal case.
 * Pass the company's document so a MEI's CNPJ root can be recognised.
 * `keepSuffix` keeps "Ltda", "ME" … for places that need the legal nature.
 */
export function companyDisplayName(name: string, document?: string | null, options: { keepSuffix?: boolean } = {}) {
  const bare = stripMeiNumbers(name, document);
  const named = options.keepSuffix ? bare : stripLegalSuffix(bare);
  return readableCase(named.replace(/\s+/g, " ").trim()) || name.trim();
}

/**
 * Two initials for a company tile: the first two words that are names, so
 * numbers and joining words do not count ("46.301.732 ALINE DE SOUZA" → "AS").
 */
export function companyNameInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word) && !CONNECTORS.has(word.toLocaleLowerCase("pt-BR")));
  const pool = words.length ? words : name.trim().split(/\s+/).filter(Boolean);
  return ((pool[0]?.[0] || "") + (pool[1]?.[0] || "")).toLocaleUpperCase("pt-BR") || "•";
}
