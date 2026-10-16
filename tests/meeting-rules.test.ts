import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";
import {
  bearerToken,
  callbackUrl,
  CHALLENGE,
  exchangeInput,
  meetingInfo,
  newCode,
  newToken,
  noteInput,
  verifierMatches,
} from "../src/lib/meetings/meeting-rules";
import { durationLabel } from "../src/lib/meetings/meeting-format";
import { kindOf, meetingHref } from "../src/lib/bookmarks/board-rules";

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("hex");

test("the app's challenge is the verifier's SHA-256 in hex, and only the verifier opens it", () => {
  assert.match(challenge, CHALLENGE);
  assert.equal(verifierMatches(verifier, challenge), true);
  assert.equal(verifierMatches(randomBytes(32).toString("base64url"), challenge), false);
  assert.equal(verifierMatches(verifier, challenge.toUpperCase()), false);
  // Too short to be a PKCE verifier, or carrying characters the RFC does not allow.
  assert.equal(verifierMatches("abc", createHash("sha256").update("abc").digest("hex")), false);
  const spaced = `${verifier} `;
  assert.equal(verifierMatches(spaced, createHash("sha256").update(spaced).digest("hex")), false);
});

test("keys are recognized only in a Bearer header of the right shape", () => {
  const token = newToken();
  assert.match(token, /^anr_[A-Za-z0-9_-]{43}$/);
  assert.equal(bearerToken(`Bearer ${token}`), token);
  for (const header of [null, "", token, `Basic ${token}`, `Bearer ${token}x`, `Bearer ${newCode()}`, `Bearer ${token} extra`])
    assert.equal(bearerToken(header), null, String(header));
});

test("the code goes back to the app through its URL scheme", () => {
  const code = newCode();
  assert.equal(callbackUrl(code), `anuntech-reunioes://conectado?code=${code}`);
});

test("the exchange takes the code and verifier as they come, and cleans the Mac's name", () => {
  const code = newCode();
  const parsed = exchangeInput.parse({ code, verifier, device: "  MacBook\u0000 Pro\n do Kauan " });
  assert.equal(parsed.device, "MacBook Pro do Kauan");
  assert.equal(exchangeInput.parse({ code, verifier }).device, "Mac");
  assert.equal(exchangeInput.parse({ code, verifier, device: "x".repeat(200) }).device, "Mac");
  assert.equal(exchangeInput.safeParse({ code: "short", verifier }).success, false);
});

test("a note needs a title, a dated file name, its Markdown and when it happened", () => {
  const note = {
    noteId: crypto.randomUUID(),
    space: "internal",
    title: "Kickoff",
    fileName: "2026-10-16-1430.md",
    markdown: "# Kickoff\n\n## Resumo\n\n- Um ponto",
    startedAt: "2026-10-16T14:30:00-03:00",
    durationSeconds: 2520,
  };
  assert.equal(noteInput.parse(note).folderId, null);
  assert.equal(noteInput.safeParse({ ...note, fileName: "2026-10-16-1430-2.md" }).success, true);
  for (const bad of [
    { fileName: "../../etc/passwd" },
    { fileName: "nota.md" },
    { fileName: "2026-10-16-1430.html" },
    { title: "   " },
    { markdown: "" },
    { markdown: "x".repeat(1024 * 1024 + 1) },
    { space: "outra" },
    { startedAt: "ontem" },
    { durationSeconds: -1 },
    { noteId: "1" },
  ])
    assert.equal(noteInput.safeParse({ ...note, ...bad }).success, false, JSON.stringify(bad).slice(0, 60));
});

test("a meeting bookmark is told apart from files, links and whiteboards", () => {
  const meeting = { source: "reunioes", noteId: "n", startedAt: "2026-10-16T17:30:00.000Z", durationSeconds: 60, device: null };
  assert.deepEqual(meetingInfo(meeting), meeting);
  assert.equal(meetingInfo({ ...meeting, source: "outro" }), null);
  assert.equal(meetingInfo(null), null);
  assert.equal(kindOf({ url: null, fileName: "2026-10-16-1430.md", meeting }), "meeting");
  assert.equal(kindOf({ url: null, fileName: "2026-10-16-1430.md", meeting: null }), "file");
  assert.equal(kindOf({ url: null, fileName: null, board: true, meeting }), "board");
  assert.equal(meetingHref("abc"), "/bookmarks/abc/reuniao");
});

test("durations read in minutes, then hours", () => {
  assert.equal(durationLabel(0), "1 min");
  assert.equal(durationLabel(2520), "42 min");
  assert.equal(durationLabel(3600), "1 h");
  assert.equal(durationLabel(3900), "1 h 05 min");
  assert.equal(durationLabel(8100), "2 h 15 min");
});
