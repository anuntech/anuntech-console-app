import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COMPANY_QUOTA_BYTES,
  MAX_FILE_BYTES,
  bytesLabel,
  cleanFileName,
  partCountFor,
  partSizeFor,
  storageKeyFor,
  uploadRefusal,
} from "../src/lib/drive/drive-rules";
import { fileSizeLabel } from "../src/lib/format";
import { LARGE_BOOKMARK_FILE, limitLabel } from "../src/lib/tickets/attachment-rules";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

test("the limits Kauan chose: 100 GB per file, 5 GB per client company", () => {
  assert.equal(MAX_FILE_BYTES, 100 * GB);
  assert.equal(DEFAULT_COMPANY_QUOTA_BYTES, 5 * GB);
  assert.equal(LARGE_BOOKMARK_FILE.maxBytes, MAX_FILE_BYTES);
  assert.equal(limitLabel(MAX_FILE_BYTES), "100 GB");
});

test("parts are 16 MB, larger only so a file never needs more than 9,000 of them", () => {
  assert.equal(partSizeFor(1), 16 * MB);
  assert.equal(partSizeFor(20 * MB), 16 * MB);
  assert.equal(partCountFor(20 * MB), 2);
  assert.equal(partCountFor(1), 1);
  const big = MAX_FILE_BYTES;
  assert.ok(partCountFor(big) <= 9000, String(partCountFor(big)));
  assert.ok(partSizeFor(big) <= 5 * GB && partSizeFor(big) % MB === 0);
});

test("a file starts only within the size and the space left", () => {
  assert.equal(uploadRefusal({ size: 10 * MB, used: 0, quota: 5 * GB }), null);
  assert.equal(uploadRefusal({ size: 10 * GB, used: 0, quota: null }), null);
  assert.match(uploadRefusal({ size: 0, used: 0, quota: null }) ?? "", /conteúdo/);
  assert.match(uploadRefusal({ size: MAX_FILE_BYTES + 1, used: 0, quota: null }) ?? "", /100 GB/);
  assert.match(uploadRefusal({ size: 2 * GB, used: 4 * GB, quota: 5 * GB }) ?? "", /restam 1 GB de 5 GB/);
});

test("keys never carry the file name; names are cleaned of paths and control characters", () => {
  assert.equal(storageKeyFor(null, "u1"), "anuntech/u1");
  assert.equal(storageKeyFor("c1", "u1"), "c1/u1");
  assert.equal(cleanFileName("../../etc/passwd"), "passwd");
  assert.equal(cleanFileName("C:\\fotos\\a\u0007.png"), "a.png");
  assert.equal(cleanFileName("   "), "arquivo");
  assert.equal(cleanFileName("x".repeat(300)).length, 200);
});

test("sizes read in the Console's words", () => {
  assert.equal(bytesLabel(512), "512 B");
  assert.equal(bytesLabel(1.5 * GB), "1,5 GB");
  assert.equal(fileSizeLabel(3 * GB), "3,0 GB");
  assert.equal(fileSizeLabel(2 * MB), "2,0 MB");
});

test("the preview shows pictures, PDFs, video, audio and text; anything else is downloaded", async () => {
  const { previewOf, TEXT_PREVIEW_BYTES } = await import("../src/lib/drive/drive-rules");
  assert.equal(previewOf("Logo.PNG")?.kind, "image");
  assert.equal(previewOf("manual.pdf")?.type, "application/pdf");
  assert.equal(previewOf("vinheta.mov")?.kind, "video");
  assert.equal(previewOf("voz.mp3")?.kind, "audio");
  assert.equal(previewOf("leia-me.md")?.type, "text/plain; charset=utf-8");
  assert.equal(previewOf("leia-me.md", TEXT_PREVIEW_BYTES + 1), null);
  assert.equal(previewOf("site.html"), null);
  assert.equal(previewOf("instalador.exe"), null);
  assert.equal(previewOf(null), null);
});
