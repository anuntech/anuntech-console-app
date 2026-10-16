/**
 * Reads the Markdown of a meeting note into blocks the reader draws as React
 * elements, so nothing in the file ever becomes HTML. It knows the shapes the
 * Mac app writes (headings, paragraphs, lists, task lists, a rule, **bold**,
 * timed transcript lines) and shows anything else as plain text.
 *
 * The note is the summary on top and, after the first rule, the transcript.
 * Pure: the reader page and the tests use it.
 */

export type Inline = { text: string; bold: boolean };
export type ListItem = { content: Inline[]; checked: boolean | null };
export type NoteBlock =
  | { type: "heading"; level: 1 | 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; items: ListItem[] }
  | { type: "rule" };
export type TranscriptLine = { time: string | null; text: string };

const RULE = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ITEM = /^\s*[-*+]\s+(?:\[([ xX])\]\s+)?(.*)$/;
const TIMED = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/;

/** `**bold**` runs; an unmatched marker stays as it was written. */
export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let rest = text;
  while (rest) {
    const start = rest.indexOf("**");
    const end = start >= 0 ? rest.indexOf("**", start + 2) : -1;
    if (start < 0 || end < 0) {
      parts.push({ text: rest, bold: false });
      break;
    }
    if (start > 0) parts.push({ text: rest.slice(0, start), bold: false });
    if (end > start + 2) parts.push({ text: rest.slice(start + 2, end), bold: true });
    rest = rest.slice(end + 2);
  }
  return parts;
}

export function parseNote(markdown: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  let list: ListItem[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
    if (list.length) blocks.push({ type: "list", items: list });
    paragraph = [];
    list = [];
  };
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ type: "rule" });
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, content: parseInline(heading[2]) });
      continue;
    }
    const item = line.match(ITEM);
    if (item) {
      if (paragraph.length) flush();
      list.push({
        content: parseInline(item[2]),
        checked: item[1] === undefined ? null : item[1].toLowerCase() === "x",
      });
      continue;
    }
    // A line under a list item continues it; anything else is prose.
    if (list.length && /^\s{2,}\S/.test(raw)) {
      const last = list[list.length - 1];
      last.content = [...last.content, ...parseInline(` ${line.trim()}`)];
      continue;
    }
    if (list.length) flush();
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

/** The note's two halves: what was decided, and everything that was said. */
export function splitNote(markdown: string): { notes: string; transcript: string | null } {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const rule = lines.findIndex((line) => RULE.test(line));
  if (rule < 0) return { notes: markdown, transcript: null };
  const after = lines.slice(rule + 1);
  // The heading right under the rule ("## Transcrição") is the reader's own label.
  const first = after.findIndex((line) => line.trim());
  if (first >= 0 && HEADING.test(after[first])) after.splice(first, 1);
  const transcript = after.join("\n").trim();
  return { notes: lines.slice(0, rule).join("\n").trim(), transcript: transcript || null };
}

/** One entry per paragraph of the transcript, with its "[mm:ss]" when it has one. */
export function transcriptLines(transcript: string): TranscriptLine[] {
  return transcript
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n|\n(?=\[\d{1,2}:\d{2})/)
    .map((chunk) => chunk.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((chunk) => {
      const timed = chunk.match(TIMED);
      return timed ? { time: timed[1], text: timed[2] } : { time: null, text: chunk };
    });
}
