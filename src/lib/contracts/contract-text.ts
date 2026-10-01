/**
 * A contract is kept as plain text, so the structure is read from how the
 * text is written: an all-caps opening line is the title, "CLÁUSULA 1 — …"
 * or other all-caps lines are headings, "1.1 …" lines are numbered clauses,
 * "CONTRATANTE: …" lines are parties. Everything else is a paragraph.
 */
export type ContractBlock =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "party"; label: string; text: string }
  | { type: "clause"; number: string; text: string }
  | { type: "paragraph"; text: string };

const CLAUSE = /^(\d+(?:\.\d+)+)\.?\s+(.+)$/;
const PARTY = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,40}):\s+(.+)$/;
const HEADING = /^(CL[ÁA]USULA|CAP[ÍI]TULO|SE[ÇC][ÃA]O|ANEXO|T[ÍI]TULO)\s+[\dIVXLC]+/i;

/** Short, mostly upper-case, no sentence punctuation at the end. */
function shouts(line: string) {
  const letters = line.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3 || line.length > 120) return false;
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  return upper / letters.length > 0.85 && !/[.;:]$/.test(line.trim());
}

export function contractBlocks(body: string): ContractBlock[] {
  const blocks: ContractBlock[] = [];
  const paragraphs = body.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  paragraphs.forEach((paragraph, index) => {
    const lines = paragraph.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const [first, ...rest] = lines;
    let content = lines;
    if (index === 0 && shouts(first) && !PARTY.test(first) && !CLAUSE.test(first)) {
      blocks.push({ type: "title", text: first });
      content = rest;
    } else if ((HEADING.test(first) || shouts(first)) && !PARTY.test(first) && !CLAUSE.test(first)) {
      blocks.push({ type: "heading", text: first });
      content = rest;
    }
    // Lines that belong to the same clause continue it instead of starting a paragraph.
    let open: ContractBlock | null = null;
    for (const line of content) {
      const clause = CLAUSE.exec(line);
      const party = PARTY.exec(line);
      if (clause) {
        open = { type: "clause", number: clause[1], text: clause[2].trim() };
        blocks.push(open);
      } else if (party) {
        open = { type: "party", label: party[1].trim(), text: party[2].trim() };
        blocks.push(open);
      } else if (open && open.type === "clause") {
        open.text += `\n${line}`;
      } else {
        open = { type: "paragraph", text: line };
        blocks.push(open);
      }
    }
  });
  return blocks;
}

/* ---------- review: requests anchored to blocks, and what changed ---------- */

/** Blocks a client can ask to change; titles and headings only name what follows. */
export function requestable(block: ContractBlock) {
  return block.type === "clause" || block.type === "party" || block.type === "paragraph";
}

/** How a request names its block: "Cláusula 3.2", "Contratante", "Parágrafo". */
export function blockLabel(block: ContractBlock) {
  switch (block.type) {
    case "clause":
      return `Cláusula ${block.number}`;
    case "party":
      return block.label.charAt(0) + block.label.slice(1).toLowerCase();
    default:
      return "Parágrafo";
  }
}

/**
 * The draft with a block's text swapped for the proposed one, or null when
 * the block no longer reads as it did (the team already changed it, or the
 * same words appear twice): then the team applies it by hand. Clause numbers
 * and party labels stay; only the text after them changes.
 */
export function applyProposal(body: string, excerpt: string, proposed: string) {
  const text = body.replace(/\r\n?/g, "\n");
  const first = text.indexOf(excerpt);
  if (!excerpt || first < 0 || text.indexOf(excerpt, first + 1) >= 0) return null;
  // Only a whole block counts: from the line start (after a clause number or a
  // party label) to the line end, never a matching phrase inside another clause.
  const prefix = text.slice(text.lastIndexOf("\n", first - 1) + 1, first);
  const end = text[first + excerpt.length];
  if (!LINE_PREFIX.test(prefix) || (end !== undefined && end !== "\n")) return null;
  return text.slice(0, first) + proposed.trim() + text.slice(first + excerpt.length);
}
const LINE_PREFIX = /^\s*(?:\d+(?:\.\d+)+\.?\s+|[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,40}:\s+)?$/;

export type BlockChange = { block: ContractBlock; change: "same" | "added" | "removed"; index?: number };

const blockKey = (block: ContractBlock) =>
  `${block.type}|${"number" in block ? block.number : "label" in block ? block.label : ""}|${block.text}`;

/** Longest common subsequence of two lists, as pairs of matching positions. */
function matches<T>(a: T[], b: T[], same: (x: T, y: T) => boolean) {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] = same(a[i], b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/**
 * The new version's blocks in order, each marked same or added (changed
 * blocks count as added), with the blocks that left the text placed where
 * they were, marked removed. `index` is the block's position in the new text.
 */
export function diffBlocks(previous: ContractBlock[], next: ContractBlock[]): BlockChange[] {
  const pairs = matches(previous.map(blockKey), next.map(blockKey), (x, y) => x === y);
  const out: BlockChange[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, nj] of [...pairs, [previous.length, next.length] as [number, number]]) {
    while (i < pi) out.push({ block: previous[i++], change: "removed" });
    while (j < nj) out.push({ block: next[j], change: "added", index: j++ });
    if (pi < previous.length) {
      out.push({ block: next[nj], change: "same", index: nj });
      i++;
      j++;
    }
  }
  return out;
}

export type WordChange = { text: string; change: "same" | "added" | "removed" };

/** Word by word, what a proposed text keeps, drops and adds; spacing stays with each word. */
export function diffWords(before: string, after: string): WordChange[] {
  const split = (text: string) => text.match(/\s*\S+/g) ?? [];
  const a = split(before);
  const b = split(after);
  const pairs = matches(a, b, (x, y) => x.trim() === y.trim());
  const out: WordChange[] = [];
  const push = (text: string, change: WordChange["change"]) => {
    const last = out[out.length - 1];
    if (last && last.change === change) last.text += text;
    else out.push({ text, change });
  };
  let i = 0;
  let j = 0;
  for (const [ai, bj] of [...pairs, [a.length, b.length] as [number, number]]) {
    while (i < ai) push(a[i++], "removed");
    while (j < bj) push(b[j++], "added");
    if (ai < a.length) {
      push(b[bj], "same");
      i++;
      j++;
    }
  }
  return out;
}
