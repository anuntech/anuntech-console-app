import assert from "node:assert/strict";
import test from "node:test";
import { audience, deleteNote, describe, hostOf, letterTile } from "../mobile/src/lib/bookmark-text";
import { LETTER_TONES, letterTile as webLetterTile } from "../src/lib/bookmarks/letter-tile";

const folder = { visibility: "people" as const, ownerId: "u1", owner: "Ana", sharedWith: [] as unknown[] };

test("a folder says who sees it, as the web's header", () => {
  assert.equal(audience({ ...folder, visibility: "company" }, "u1"), "Toda a empresa");
  assert.equal(audience(folder, "u1"), "Só você");
  assert.equal(audience(folder, "u2"), "Só Ana");
  assert.equal(audience({ ...folder, sharedWith: [{}] }, "u2"), "Só Ana e 1 pessoa");
  assert.equal(audience({ ...folder, sharedWith: [{}, {}] }, "u1"), "Só você e 2 pessoas");
});

test("a bookmark reads as host, file and size, or Lousa", () => {
  assert.equal(hostOf("https://www.example.com/a/b?c#d"), "example.com");
  assert.equal(hostOf(null), null);
  assert.equal(describe({ kind: "link", url: "https://drive.google.com/x", fileName: null, fileSize: null }), "drive.google.com");
  assert.equal(describe({ kind: "file", url: null, fileName: "contrato.pdf", fileSize: 2048 }), "contrato.pdf · 2 KB");
  assert.equal(describe({ kind: "file", url: null, fileName: "foto.jpg", fileSize: 1024 * 1024 }), "foto.jpg · 1,0 MB");
  assert.equal(describe({ kind: "board", url: null, fileName: null, fileSize: null }), "Lousa");
});

test("deleting says what goes with it", () => {
  assert.equal(deleteNote({ kind: "file" }), ", com o arquivo");
  assert.equal(deleteNote({ kind: "board" }), ", com o desenho");
  assert.equal(deleteNote({ kind: "link" }), "");
});

test("a link's tile is the web's letter and tone, without calling anyone", () => {
  const urls = [
    "https://www.example.com/a",
    "https://drive.google.com/x?y#z",
    "https://Docs.Anuntech.COM:8443/path",
    "http://user:pass@intranet.empresa.com.br/",
    "https://123.45.6.7/painel",
    "https://[::1]:3000/",
    "https://-foo.com",
    "example.com/sem-esquema",
    "mailto:ana@example.com",
    "https://a.co",
    "https://z.io",
    "https://notion.so/page",
    "https://figma.com/file/1",
  ];
  for (const url of urls) {
    const web = webLetterTile(url);
    const app = letterTile(url);
    assert.deepEqual(app, web, url);
    assert.ok(app.tone >= 0 && app.tone < LETTER_TONES);
  }
  assert.deepEqual(letterTile("https://www.example.com"), { letter: "e", tone: webLetterTile("https://example.com").tone });
  assert.equal(letterTile("mailto:ana@example.com").letter, "•");
  // Accented hosts: the web reads the punycode ("xn--"), the app the letters; both still a letter.
  assert.equal(letterTile("https://ação.com.br").letter, "a");
});

test("the app's folder tree: levels, trail and order", async () => {
  const { childrenOf, folderTrail, folderTree } = await import("../mobile/src/lib/bookmark-text");
  const folders = [
    { id: "a", name: "Marca", parentId: null },
    { id: "b", name: "Logo", parentId: "a" },
    { id: "c", name: "SVG", parentId: "b" },
    { id: "d", name: "Atas", parentId: null },
    { id: "e", name: "Solta", parentId: "invisivel" },
  ];
  assert.deepEqual(childrenOf(folders, null).map((f) => f.id), ["d", "a", "e"]);
  assert.deepEqual(childrenOf(folders, "a").map((f) => f.id), ["b"]);
  assert.deepEqual(folderTrail(folders, "c").map((f) => f.name), ["Marca", "Logo", "SVG"]);
  assert.deepEqual(folderTree(folders).map((f) => `${f.depth}${f.id}`), ["0d", "0a", "1b", "2c", "0e"]);
});

test("the app's tags, types and orders are the web's", async () => {
  const { TAG_LABELS, KIND_OPTIONS, SORT_OPTIONS, excerptParts, trashNote } = await import("../mobile/src/lib/bookmark-text");
  const { tagLabels } = await import("../src/lib/drive/tag-rules");
  const { KIND_FILTERS, SORTS } = await import("../src/lib/bookmarks/list-filters");
  assert.deepEqual(TAG_LABELS, tagLabels);
  assert.deepEqual(KIND_OPTIONS.slice(1), KIND_FILTERS.map((k) => ({ value: k.value, label: k.label })));
  assert.deepEqual(SORT_OPTIONS, SORTS.map((s) => ({ value: s.value, label: s.label })));
  assert.deepEqual(excerptParts("o ⟦contrato⟧ da"), [
    { text: "o ", hit: false },
    { text: "contrato", hit: true },
    { text: " da", hit: false },
  ]);
  const now = Date.parse("2026-10-27T12:00:00Z");
  assert.equal(trashNote("2026-10-27T10:00:00Z", now), "some em 30 dias");
  assert.equal(trashNote("2026-09-27T13:00:00Z", now), "some em 1 dia");
  assert.equal(trashNote("2026-09-01T00:00:00Z", now), "some hoje");
});
