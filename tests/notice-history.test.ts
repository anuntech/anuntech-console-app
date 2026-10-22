import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  NOTICE_HISTORY_PAGE_SIZE,
  noticeActionLabel,
  noticeHistoryPage,
  noticeRecipient,
  noticeStatusLabel,
  noticeTone,
} from "../src/lib/notifications/notice-history-view";
import { MAX_AUDIO_BYTES, MAX_SECONDS, MIN_AUDIO_BYTES, MIN_SECONDS, PRIVACY_LINE, WARN_AT, WAV_RATE } from "../src/lib/voice/voice-rules";

test("the history pages 20 at a time and keeps a page within the ones there are", () => {
  assert.equal(NOTICE_HISTORY_PAGE_SIZE, 20);
  assert.deepEqual(noticeHistoryPage(undefined, 0), { page: 1, pageCount: 1 });
  assert.deepEqual(noticeHistoryPage("2", 41), { page: 2, pageCount: 3 });
  assert.deepEqual(noticeHistoryPage(3, 41), { page: 3, pageCount: 3 });
  assert.deepEqual(noticeHistoryPage("9", 41), { page: 3, pageCount: 3 });
  assert.deepEqual(noticeHistoryPage(["2"], 41), { page: 1, pageCount: 3 });
  assert.deepEqual(noticeHistoryPage("0", 41), { page: 1, pageCount: 3 });
  assert.deepEqual(noticeHistoryPage("2abc", 41), { page: 1, pageCount: 3 });
  assert.deepEqual(noticeHistoryPage(1.5, 41), { page: 1, pageCount: 3 });
});

test("a notice reads as the web shows it", () => {
  assert.equal(noticeRecipient("whatsapp", "5511987650002"), "(11) 98765-0002");
  assert.equal(noticeRecipient("whatsapp", "4915112345678"), "4915112345678");
  assert.equal(noticeRecipient("email", "nome@empresa.com.br"), "nome@empresa.com.br");
  assert.equal(noticeRecipient("email", ""), "E-mail");
  assert.equal(noticeRecipient("whatsapp", ""), "WhatsApp");
  assert.equal(noticeActionLabel("billing.notice"), "Financeiro");
  assert.equal(noticeActionLabel("ticket.created"), "Chamado aberto");
  assert.equal(noticeActionLabel("something.new"), "something.new");
  assert.equal(noticeStatusLabel("skipped"), "Não enviado");
  assert.equal(noticeStatusLabel("mystery"), "mystery");
  assert.equal(noticeTone("read"), "good");
  assert.equal(noticeTone("failed"), "danger");
  assert.equal(noticeTone("expired"), "attention");
  assert.equal(noticeTone("accepted"), "info");
  assert.equal(noticeTone("waiting"), "neutral");
});

test("the app's dictation keeps the web's numbers (mobile/src/lib/dictation.ts)", () => {
  const source = readFileSync(new URL("../mobile/src/lib/dictation.ts", import.meta.url), "utf8");
  const number = (name: string) => Number(source.match(new RegExp(`const ${name} = ([\\d_]+);`))?.[1].replaceAll("_", ""));
  assert.equal(number("MAX_SECONDS"), MAX_SECONDS);
  assert.equal(number("WARN_AT"), WARN_AT);
  assert.equal(number("MIN_SECONDS"), MIN_SECONDS);
  assert.equal(number("MAX_AUDIO_BYTES"), MAX_AUDIO_BYTES);
  assert.equal(number("MIN_AUDIO_BYTES"), MIN_AUDIO_BYTES);
  assert.equal(number("WAV_RATE"), WAV_RATE);
  assert.ok(source.includes(`"${PRIVACY_LINE}"`));
});
