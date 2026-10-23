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
