import assert from "node:assert/strict";
import test from "node:test";
import {
  audioFormat,
  joinTranscript,
  MAX_AUDIO_BYTES,
  MAX_SECONDS,
  shouldFallback,
  transcriptionBody,
  voiceEnabledFrom,
  voiceModels,
} from "../src/lib/voice/voice-rules";

test("recorded Content-Types map to the formats the transcription endpoint takes", () => {
  assert.equal(audioFormat("audio/webm;codecs=opus"), "webm");
  assert.equal(audioFormat("audio/webm"), "webm");
  assert.equal(audioFormat("audio/mp4"), "m4a");
  assert.equal(audioFormat("audio/x-m4a"), "m4a");
  assert.equal(audioFormat("Audio/OGG; codecs=opus"), "ogg");
  assert.equal(audioFormat("audio/aac"), "aac");
  for (const other of ["text/plain", "video/mp4", "", null, undefined]) assert.equal(audioFormat(other), null);
});

test("dictated text lands at the cursor with one space on each side", () => {
  assert.deepEqual(joinTranscript("", 0, 0, "  Olá mundo ", 100), { value: "Olá mundo", caret: 9, truncated: false });
  assert.deepEqual(joinTranscript("Parou", 5, 5, "o boleto", 100), { value: "Parou o boleto", caret: 14, truncated: false });
  assert.deepEqual(joinTranscript("Antes depois", 5, 5, "no meio", 100), { value: "Antes no meio depois", caret: 13, truncated: false });
  assert.deepEqual(joinTranscript("Linha\n", 6, 6, "nova", 100), { value: "Linha\nnova", caret: 10, truncated: false });
  assert.deepEqual(joinTranscript("troque ISTO aqui", 7, 11, "isso", 100), { value: "troque isso aqui", caret: 11, truncated: false });
  assert.deepEqual(joinTranscript("texto", 5, 5, "   ", 100), { value: "texto", caret: 5, truncated: false });
});

test("a field's limit cuts the dictated text, never what was typed", () => {
  const result = joinTranscript("abcde", 5, 5, "fghij", 8);
  assert.deepEqual(result, { value: "abcde fg", caret: 8, truncated: true });
  assert.deepEqual(joinTranscript("abcdefgh", 8, 8, "mais", 8), { value: "abcdefgh", caret: 8, truncated: true });
});

test("only failures another model could fix fall back", () => {
  for (const status of [0, 400, 404, 408, 415, 422, 429, 500, 502, 503]) assert.equal(shouldFallback(status), true, String(status));
  for (const status of [401, 402, 403]) assert.equal(shouldFallback(status), false, String(status));
  assert.equal(shouldFallback(200, true), true);
  assert.equal(shouldFallback(200, false), false);
});

test("every transcription asks for Portuguese and zero data retention", () => {
  assert.deepEqual(transcriptionBody("m", "QUJD", "webm"), { model: "m", input_audio: { data: "QUJD", format: "webm" }, language: "pt", provider: { zdr: true } });
});

test("dictation follows the OpenRouter key, with VOICE_INPUT=off as the switch", () => {
  assert.equal(voiceEnabledFrom({ OPENROUTER_API_KEY: "k" }), true);
  assert.equal(voiceEnabledFrom({ OPENROUTER_API_KEY: "k", VOICE_INPUT: "off" }), false);
  assert.equal(voiceEnabledFrom({ VOICE_INPUT: "on" }), false);
  assert.deepEqual(voiceModels({}), ["microsoft/mai-transcribe-2", "mistralai/voxtral-mini-transcribe"]);
  assert.deepEqual(voiceModels({ VOICE_FALLBACK_MODEL: "off" }), ["microsoft/mai-transcribe-2"]);
  assert.deepEqual(voiceModels({ VOICE_MODEL: "a", VOICE_FALLBACK_MODEL: "a" }), ["a"]);
});

test("two minutes of speech fit under the body limit, which fits under Vercel's", () => {
  assert.ok((MAX_SECONDS * 32_000) / 8 < MAX_AUDIO_BYTES / 4);
  assert.ok(MAX_AUDIO_BYTES < 4_500_000);
});
