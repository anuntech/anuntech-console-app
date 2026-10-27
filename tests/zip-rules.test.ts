import { test } from "node:test";
import assert from "node:assert/strict";
import { ZIP_MAX_BYTES, ZIP_MAX_FILES, zipFileName, zipNames, zipRefusal } from "../src/lib/drive/zip-rules";

const entry = (fileName: string, path = "", size = 1) => ({ id: fileName + path, fileName, size, path });

test("each file under its folder path, repeated names numbered", () => {
  const named = zipNames([entry("logo.svg"), entry("logo.svg"), entry("logo.SVG"), entry("logo.svg", "Marca › SVG"), entry("LEIAME")]);
  assert.deepEqual(
    named.map((n) => n.zipPath),
    ["logo.svg", "logo (2).svg", "logo (3).SVG", "Marca/SVG/logo.svg", "LEIAME"],
  );
});

test("names cannot climb out of the zip or hide characters", () => {
  const [a, b] = zipNames([entry("../../etc/passwd"), entry("nota\u0000.txt", "..")]);
  assert.equal(a.zipPath, "..-..-etc-passwd");
  assert.equal(b.zipPath, "_/nota.txt");
  assert.equal(zipFileName("Marca / 2026"), "Marca - 2026.zip");
});

test("empty, too many files or too big is refused with a way out", () => {
  assert.ok(zipRefusal([])?.includes("não tem arquivos"));
  assert.ok(zipRefusal(Array.from({ length: ZIP_MAX_FILES + 1 }, () => ({ size: 1 })))?.includes("pastas de dentro"));
  assert.ok(zipRefusal([{ size: ZIP_MAX_BYTES }, { size: 1 }])?.includes("3,5 GB"));
  assert.equal(zipRefusal([{ size: 10 }]), null);
});
