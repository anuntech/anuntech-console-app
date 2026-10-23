import assert from "node:assert/strict";
import test from "node:test";
import { isViewableImage } from "../mobile/src/lib/file-kind";
import { dayKey, dayLabel } from "../mobile/src/lib/thread-days";

test("a day is the civil day in São Paulo, not UTC", () => {
  // 01:30 UTC on the 21st is still the 20th in São Paulo (UTC-3).
  assert.equal(dayKey("2026-10-21T01:30:00.000Z"), "2026-10-20");
  assert.equal(dayKey("2026-10-21T03:30:00.000Z"), "2026-10-21");
});

test("the thread's day separators read as the web's", () => {
  const now = new Date("2026-10-23T15:00:00.000Z");
  assert.equal(dayLabel("2026-10-23T12:00:00.000Z", now), "Hoje");
  assert.equal(dayLabel("2026-10-22T12:00:00.000Z", now), "Ontem");
  // Late on the 22nd in São Paulo is already the 23rd in UTC: still Ontem.
  assert.equal(dayLabel("2026-10-23T02:00:00.000Z", now), "Ontem");
  assert.equal(dayLabel("2026-10-20T12:00:00.000Z", now), "20 de outubro");
  assert.equal(dayLabel("2025-10-20T12:00:00.000Z", now), "20 de outubro de 2025");
});

test("photos open in the app's viewer; PDFs and SVG go to the share sheet", () => {
  assert.equal(isViewableImage("foto.jpg", "image/jpeg"), true);
  assert.equal(isViewableImage("print", "image/png"), true);
  assert.equal(isViewableImage("logo.svg", "image/svg+xml"), false);
  assert.equal(isViewableImage("contrato.pdf", "application/pdf"), false);
  assert.equal(isViewableImage("Lousa.png"), true);
  assert.equal(isViewableImage("IMG_0001.HEIC", null), true);
  assert.equal(isViewableImage("boleto.pdf"), false);
});
