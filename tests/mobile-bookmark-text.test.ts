import assert from "node:assert/strict";
import test from "node:test";
import {
  audience,
  deleteNote,
  describe,
  extensionOf,
  fileDetails,
  fileTypeOf,
  hostOf,
  itemLink,
  letterTile,
  neighbours,
  showsPage,
  viewChips,
  type FileGroup,
} from "../mobile/src/lib/bookmark-text";
import { extensionOf as webExtensionOf, fileTypeOf as webFileTypeOf, showsPage as webShowsPage } from "../src/lib/bookmarks/file-types";
import { consoleTarget } from "../mobile/src/lib/console-paths";
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

test("a file's kind and badge are the web's (file-types.ts)", () => {
  const names = ["foto.JPG", "video.mov", "a.b.pdf", "planilha.xlsx", "deck.key", "notas.md", "pacote.tar.gz", "logo.fig", "script.py", "musica.m4a", "sem-extensao", "", null, undefined, "arquivo.desconhecido", "x.verylongextension"];
  for (const name of names) {
    assert.deepEqual(fileTypeOf(name), webFileTypeOf(name), String(name));
    assert.equal(extensionOf(name), webExtensionOf(name), String(name));
  }
  assert.deepEqual(fileTypeOf("contrato.pdf"), { group: "pdf", label: "PDF" });
  assert.deepEqual(fileTypeOf("sem-extensao"), { group: "other", label: "ARQUIVO" });
  const groups: FileGroup[] = ["image", "video", "audio", "pdf", "document", "sheet", "slides", "archive", "code", "design", "other"];
  for (const group of groups) assert.equal(showsPage(group), webShowsPage(group), group);
});

test("\"Copiar link\" is the web's ?abrir= address, and the app opens it on the item", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
  assert.equal(itemLink("https://console.anuntech.com", id), `https://console.anuntech.com/bookmarks?abrir=${id}`);
  assert.equal(itemLink("http://localhost:3000/", id), `http://localhost:3000/bookmarks?abrir=${id}`);
  const reach = { finance: false, managed: false };
  assert.deepEqual(consoleTarget(`/bookmarks?abrir=${id}`, reach), { kind: "app", href: `/bookmarks/${id}/ver` });
  assert.deepEqual(consoleTarget(`/bookmarks?abrir=${id.toUpperCase()}`, reach), { kind: "app", href: `/bookmarks/${id}/ver` });
  assert.deepEqual(consoleTarget("/bookmarks?abrir=../conta", reach), { kind: "app", href: "/bookmarks" });
});

test("the viewer's arrows go through the list's files", () => {
  assert.deepEqual(neighbours(["a", "b", "c"], "b"), { at: 1, previous: "a", next: "c", label: "2 de 3" });
  assert.deepEqual(neighbours(["a", "b", "c"], "a"), { at: 0, previous: null, next: "b", label: "1 de 3" });
  assert.deepEqual(neighbours(["a", "b", "c"], "c"), { at: 2, previous: "b", next: null, label: "3 de 3" });
  assert.deepEqual(neighbours(["a"], "a"), { at: 0, previous: null, next: null, label: null });
  assert.deepEqual(neighbours(["a", "b"], "z"), { at: -1, previous: null, next: null, label: null });
});

test("the viewer's details are the web's, in its order", () => {
  const item = {
    fileName: "obra.jpg",
    fileSize: 2 * 1024 * 1024,
    folderId: "f1",
    companyId: "c1",
    tag: "foto",
    ownerName: "Ana",
    createdAt: "2026-10-20T12:00:00.000Z",
    updatedAt: "2026-10-21T12:00:00.000Z",
  };
  const details = fileDetails(item, (id) => (id === "f1" ? "Obra" : undefined), (id) => (id === "c1" ? "Padaria" : undefined));
  assert.deepEqual(
    details.map(([term]) => term),
    ["Tipo", "Tamanho", "Pasta", "Empresa", "Etiqueta", "Adicionado por", "Adicionado em", "Alterado em"],
  );
  assert.deepEqual(details.slice(0, 6), [
    ["Tipo", "JPG"],
    ["Tamanho", "2,0 MB"],
    ["Pasta", "Obra"],
    ["Empresa", "Padaria"],
    ["Etiqueta", "Foto"],
    ["Adicionado por", "Ana"],
  ]);
  const loose = fileDetails({ ...item, folderId: null, companyId: null, tag: null, ownerName: null, fileSize: null }, () => undefined, () => undefined);
  assert.deepEqual(loose.slice(1, 6).map(([, value]) => value), ["—", "Sem pasta", "Anuntech", "—", "—"]);
});

test("\"Recentes\" and \"Com estrela\" chips, with the stars counted", () => {
  assert.deepEqual(viewChips(0), [
    { value: "recentes", label: "Recentes" },
    { value: "estrela", label: "Com estrela" },
  ]);
  assert.equal(viewChips(3)[1].label, "Com estrela · 3");
  assert.equal(viewChips(undefined)[1].label, "Com estrela");
});
