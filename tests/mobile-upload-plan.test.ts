import assert from "node:assert/strict";
import test from "node:test";
import {
  LARGE_DOWNLOAD_BYTES,
  PART_URL_BATCH,
  fileTitle,
  opensOutside,
  partBatches,
  partRange,
  percentLabel,
  progressShare,
  retryDelay,
  sentLabel,
  spaceAlmostFull,
  spaceHeading,
  spaceLabel,
  spacePercent,
  spaceSegments,
  spaceShare,
} from "../mobile/src/lib/upload-plan";
import { fileSize } from "../mobile/src/lib/format";
import { PART_URL_BATCH as SERVER_BATCH, partCountFor, partSizeFor } from "../src/lib/drive/drive-rules";
import { fileSizeLabel } from "../src/lib/format";

const MB = 1024 ** 2;
const GB = 1024 ** 3;

test("the app asks for part addresses within the Console's batch", () => {
  assert.equal(PART_URL_BATCH, SERVER_BATCH);
  assert.deepEqual(partBatches(1), [[1]]);
  assert.deepEqual(partBatches(7, 5), [[1, 2, 3, 4, 5], [6, 7]]);
  const big = partBatches(250);
  assert.deepEqual(
    big.map((b) => b.length),
    [100, 100, 50],
  );
  assert.deepEqual(big.flat(), Array.from({ length: 250 }, (_, i) => i + 1));
  assert.deepEqual(partBatches(0), []);
});

test("the parts cover the file exactly, with the Console's part size", () => {
  for (const size of [1, 300 * 1024, 16 * MB, 17 * MB, 20 * MB + 3, 5 * GB, 100 * GB]) {
    const partSize = partSizeFor(size);
    const count = partCountFor(size, partSize);
    let next = 0;
    for (let n = 1; n <= count; n++) {
      const { start, length } = partRange(n, partSize, size);
      assert.equal(start, next, `part ${n} of ${size} starts where the last ended`);
      assert.ok(length > 0 && length <= partSize);
      next = start + length;
    }
    assert.equal(next, size, `the parts of ${size} add up to the file`);
  }
  // A 17 MB video: 16 MB and 1 MB.
  assert.deepEqual(partRange(1, 16 * MB, 17 * MB), { start: 0, length: 16 * MB });
  assert.deepEqual(partRange(2, 16 * MB, 17 * MB), { start: 16 * MB, length: MB });
  assert.deepEqual(partRange(3, 16 * MB, 17 * MB), { start: 32 * MB, length: 0 });
});

test("progress reads as the web's tray", () => {
  assert.equal(progressShare(0, 0), 0);
  assert.equal(progressShare(50, 100), 0.5);
  assert.equal(progressShare(150, 100), 1);
  assert.equal(percentLabel(999, 1000), "99%");
  assert.equal(percentLabel(1000, 1000), "100%");
  assert.equal(sentLabel(0, 20 * MB), "1 KB de 20,0 MB");
  assert.equal(sentLabel(16 * MB, 2 * GB), "16,0 MB de 2,0 GB");
  assert.deepEqual([1, 2].map(retryDelay), [1000, 2000]);
});

test("a file's title is its name without the extension", () => {
  assert.equal(fileTitle("Vídeo da obra.mov"), "Vídeo da obra");
  assert.equal(fileTitle("contrato.final.pdf"), "contrato.final");
  assert.equal(fileTitle(".env"), ".env");
  assert.equal(fileTitle("x".repeat(300)).length, 160);
});

test("large files open through the system", () => {
  assert.equal(opensOutside(null), false);
  assert.equal(opensOutside(LARGE_DOWNLOAD_BYTES), false);
  assert.equal(opensOutside(LARGE_DOWNLOAD_BYTES + 1), true);
  assert.equal(opensOutside(3 * GB), true);
});

test("the storage meter says what the web's says", () => {
  assert.equal(spaceHeading(null), "Armazenamento");
  assert.equal(spaceHeading("Padaria"), "Padaria");
  assert.equal(spaceLabel(0, 5 * GB), "0 KB de 5,0 GB · 5,0 GB livres");
  assert.equal(spaceLabel(1.2 * GB, 5 * GB), "1,2 GB de 5,0 GB · 3,8 GB livres");
  // Over the limit nothing is left; the web's fileSizeLabel(0) also reads "1 KB".
  assert.equal(spaceLabel(6 * GB, 5 * GB), `6,0 GB de 5,0 GB · ${fileSizeLabel(0)} livres`);
  assert.equal(spaceLabel(300 * MB, null), "300,0 MB usados, sem limite");
  assert.equal(spacePercent(GB, 5 * GB), "20%");
  assert.equal(spacePercent(6 * GB, 5 * GB), "100%");
  assert.equal(spacePercent(GB, null), null);
  assert.equal(spaceShare(GB, 5 * GB), 0.2);
  assert.equal(spaceShare(6 * GB, 5 * GB), 1);
  assert.equal(spaceShare(GB, null), 0);
  assert.equal(spaceAlmostFull(4.5 * GB, 5 * GB), false);
  assert.equal(spaceAlmostFull(4.6 * GB, 5 * GB), true);
  assert.equal(spaceAlmostFull(100 * GB, null), false);
});

test("the storage bar is split into photos and videos, documents and the rest", () => {
  const parts = { media: GB, documents: 0.5 * GB, other: 0.001 * GB };
  assert.deepEqual(
    spaceSegments(1.501 * GB, 5 * GB, parts).map(({ key, label, share }) => [key, label, Math.round(share * 1000) / 1000]),
    [
      ["media", "Fotos e vídeos", 0.2],
      ["documents", "Documentos", 0.1],
      // A sliver still shows, as the web's 1.5%.
      ["other", "Outros", 0.015],
    ],
  );
  // Without a limit (Anuntech's own) the bar is what is used.
  assert.deepEqual(spaceSegments(2 * GB, null, { media: GB, documents: GB, other: 0 }).map((s) => s.share), [0.5, 0.5]);
  // An older Console sends no split: all of it is "Outros".
  assert.deepEqual(spaceSegments(GB, 5 * GB).map((s) => [s.key, s.bytes]), [["other", GB]]);
  assert.deepEqual(spaceSegments(0, 5 * GB, { media: 0, documents: 0, other: 0 }), []);
  assert.deepEqual(spaceSegments(0, null), []);
});

test("sizes in MB and GB read as on the web", () => {
  for (const bytes of [2 * MB, 300 * MB + 5, GB, 5 * GB, 100 * GB]) assert.equal(fileSize(bytes), fileSizeLabel(bytes));
});
