import assert from "node:assert/strict";
import test from "node:test";
import {
  audioFormat,
  encodeWav,
  joinTranscript,
  MAX_AUDIO_BYTES,
  MAX_SECONDS,
  shouldFallback,
  transcriptionOptions,
  voiceEnabledFrom,
  voiceModels,
  WAV_RATE,
} from "../src/lib/voice/voice-rules";

test("recorded Content-Types map to the formats the transcription models take", () => {
  assert.equal(audioFormat("audio/wav"), "wav");
  assert.equal(audioFormat("audio/x-wav"), "wav");
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

test("every transcription asks for zero data retention, and Portuguese where the model takes it", () => {
  const gateway = { zeroDataRetention: true, disallowPromptTraining: true };
  assert.deepEqual(transcriptionOptions("microsoft/mai-transcribe-2"), { gateway, azure: { locales: ["pt-BR"] } });
  assert.deepEqual(transcriptionOptions("spacexai/grok-stt"), { gateway });
});

test("dictation follows the AI Gateway, with VOICE_INPUT=off as the switch", () => {
  assert.equal(voiceEnabledFrom({ AI_GATEWAY_API_KEY: "k" }), true);
  assert.equal(voiceEnabledFrom({ VERCEL_OIDC_TOKEN: "t" }), true);
  assert.equal(voiceEnabledFrom({ VERCEL: "1" }), true);
  assert.equal(voiceEnabledFrom({ AI_GATEWAY_API_KEY: "k", VOICE_INPUT: "off" }), false);
  assert.equal(voiceEnabledFrom({ VOICE_INPUT: "on", OPENROUTER_API_KEY: "k" }), false);
});

test("each recording goes only to the models that read its format", () => {
  assert.deepEqual(voiceModels({}, "wav"), ["microsoft/mai-transcribe-2", "spacexai/grok-stt"]);
  assert.deepEqual(voiceModels({}, "ogg"), ["microsoft/mai-transcribe-2", "spacexai/grok-stt"]);
  // MAI reads no WebM or MP4: a recording the browser could not convert goes to Grok only.
  assert.deepEqual(voiceModels({}, "webm"), ["spacexai/grok-stt"]);
  assert.deepEqual(voiceModels({}, "m4a"), ["spacexai/grok-stt"]);
  assert.deepEqual(voiceModels({ VOICE_FALLBACK_MODEL: "off" }, "wav"), ["microsoft/mai-transcribe-2"]);
  assert.deepEqual(voiceModels({ VOICE_FALLBACK_MODEL: "off" }, "webm"), []);
  assert.deepEqual(voiceModels({ VOICE_MODEL: "a/b", VOICE_FALLBACK_MODEL: "a/b" }, "webm"), ["a/b"]);
});

test("the browser's WAV is 16-bit mono PCM with a correct header, loud samples clipped", () => {
  const view = new DataView(encodeWav(new Float32Array([0, 1, -1, 2, -0.5]), WAV_RATE));
  const text = (at: number, length: number) => String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(at + i)));
  assert.equal(view.byteLength, 44 + 10);
  assert.deepEqual([text(0, 4), text(8, 4), text(12, 4), text(36, 4)], ["RIFF", "WAVE", "fmt ", "data"]);
  assert.equal(view.getUint32(4, true), 36 + 10);
  assert.deepEqual([view.getUint16(20, true), view.getUint16(22, true), view.getUint32(24, true), view.getUint16(34, true)], [1, 1, 16000, 16]);
  assert.equal(view.getUint32(40, true), 10);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => view.getInt16(44 + i * 2, true)), [0, 32767, -32768, 32767, -16384]);
});

test("two minutes of speech fit under the body limit, which fits under Vercel's", () => {
  // As WAV, the format the browser sends, and as the recording itself when it cannot convert.
  assert.ok(44 + (MAX_SECONDS + 1) * WAV_RATE * 2 < MAX_AUDIO_BYTES);
  assert.ok((MAX_SECONDS * 32_000) / 8 < MAX_AUDIO_BYTES / 4);
  assert.ok(MAX_AUDIO_BYTES < 4_500_000);
});
