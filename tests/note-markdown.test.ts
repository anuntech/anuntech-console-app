import assert from "node:assert/strict";
import test from "node:test";
import { parseInline, parseNote, splitNote, transcriptLines } from "../src/lib/bookmarks/note-markdown";

const note = `# Kickoff do site

**Data:** 16/10/2026 14:30 · **Duração:** 42 min

## Resumo

- O cliente quer o site no ar em novembro.
- A home sai primeiro.

## Decisões

- Usar o domínio atual.

## Próximos passos

- [ ] **Kauan:** enviar a proposta (até sexta)
- [x] **Ana:** mandar o logo

---

## Transcrição

[00:00] Bom dia, vamos começar.

[00:12] Então, sobre o prazo...
continua aqui.
[01:05] Fechado.
`;

test("the note splits at the first rule: summary on top, transcript below", () => {
  const { notes, transcript } = splitNote(note);
  assert.ok(notes.startsWith("# Kickoff do site"));
  assert.ok(notes.endsWith("(até sexta)\n- [x] **Ana:** mandar o logo"));
  assert.ok(transcript?.startsWith("[00:00] Bom dia"));
  assert.deepEqual(splitNote("# Só resumo\n\n- a"), { notes: "# Só resumo\n\n- a", transcript: null });
});

test("headings, paragraphs, lists and task lists become blocks", () => {
  const blocks = parseNote(splitNote(note).notes);
  assert.deepEqual(
    blocks.map((block) => block.type),
    ["heading", "paragraph", "heading", "list", "heading", "list", "heading", "list"],
  );
  const tasks = blocks[7];
  assert.equal(tasks.type, "list");
  if (tasks.type !== "list") return;
  assert.deepEqual(
    tasks.items.map((item) => item.checked),
    [false, true],
  );
  assert.deepEqual(tasks.items[0].content, [
    { text: "Kauan:", bold: true },
    { text: " enviar a proposta (até sexta)", bold: false },
  ]);
});

test("markup in a note stays text: HTML, links and unmatched markers", () => {
  const [block] = parseNote('<img src=x onerror="alert(1)"> [link](javascript:alert(1)) **meio');
  assert.equal(block.type, "paragraph");
  if (block.type !== "paragraph") return;
  assert.deepEqual(block.content, [
    { text: '<img src=x onerror="alert(1)"> [link](javascript:alert(1)) **meio', bold: false },
  ]);
  assert.deepEqual(parseInline("****"), []);
  assert.deepEqual(parseInline("a **b** c"), [
    { text: "a ", bold: false },
    { text: "b", bold: true },
    { text: " c", bold: false },
  ]);
});

test("the transcript reads one entry per timed line or paragraph", () => {
  const lines = transcriptLines(splitNote(note).transcript ?? "");
  assert.deepEqual(lines, [
    { time: "00:00", text: "Bom dia, vamos começar." },
    { time: "00:12", text: "Então, sobre o prazo... continua aqui." },
    { time: "01:05", text: "Fechado." },
  ]);
  assert.deepEqual(transcriptLines("sem tempo\n\n[1:02:03] longa"), [
    { time: null, text: "sem tempo" },
    { time: "1:02:03", text: "longa" },
  ]);
});
