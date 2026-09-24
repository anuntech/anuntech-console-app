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
