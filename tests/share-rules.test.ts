import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPIRY_CHOICES, passwordRefusal, requestRefusal, shareClosedText, shareState } from "../src/lib/drive/share-rules";

const now = new Date("2026-10-26T12:00:00Z");
const base = { revokedAt: null, expiresAt: null, maxDownloads: null, downloads: 0 };

test("a link works until it is turned off, expires or runs out of downloads", () => {
  assert.equal(shareState(base, now), "active");
  assert.equal(shareState({ ...base, revokedAt: now }, now), "revoked");
  assert.equal(shareState({ ...base, expiresAt: new Date("2026-10-26T11:59:59Z") }, now), "expired");
  assert.equal(shareState({ ...base, expiresAt: new Date("2026-10-27T00:00:00Z") }, now), "active");
  assert.equal(shareState({ ...base, maxDownloads: 2, downloads: 2 }, now), "exhausted");
  assert.equal(shareState({ ...base, maxDownloads: 2, downloads: 1 }, now), "active");
  // Turned off wins over everything else.
  assert.equal(shareState({ ...base, revokedAt: now, maxDownloads: 1, downloads: 5 }, now), "revoked");
  for (const text of Object.values(shareClosedText)) assert.doesNotMatch(text, /arquivo .*\.|pasta/i);
});

test("programs and scripts never come in through a request link; documents do", () => {
  for (const name of ["setup.exe", "run.BAT", "x.ps1", "app.dmg", "a.js", "atalho.lnk"]) assert.ok(requestRefusal(name), name);
  for (const name of ["contrato.pdf", "fotos.zip", "planilha.xlsx", "video.mov", "README"]) assert.equal(requestRefusal(name), null, name);
});

test("a link's password is optional, 6 to 100 characters", () => {
  assert.equal(passwordRefusal(""), null);
  assert.match(passwordRefusal("12345") ?? "", /6/);
  assert.equal(passwordRefusal("123456"), null);
  assert.match(passwordRefusal("x".repeat(101)) ?? "", /100/);
  assert.ok(EXPIRY_CHOICES.some((c) => c.value === ""));
});

test("the blocked check reads the name as it will be saved", () => {
  assert.ok(requestRefusal("evil.exe\u0001"));
  assert.ok(requestRefusal("evil.exe."));
  assert.ok(requestRefusal("evil.exe . "));
  assert.equal(requestRefusal("relatorio.pdf."), null);
});
