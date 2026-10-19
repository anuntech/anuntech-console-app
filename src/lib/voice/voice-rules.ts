import { gatewayReady, PRIVATE_GATEWAY } from "../ai/gateway-env";

/*
 * Dictation by microphone, the rules both sides share: what may be recorded,
 * how big, which formats the transcription models take and how the text
 * lands in a field. No DOM and no server code, so tests and both sides import it.
 */

/** A recording stops on its own at 2 minutes; the person sees a warning 10 seconds before. */
export const MAX_SECONDS = 120;
export const WARN_AT = 110;
export const MIN_SECONDS = 1;
/** Under Vercel's 4.5 MB request body limit, with room for the headers. Two minutes of WAV_RATE audio fit. */
export const MAX_AUDIO_BYTES = 4_000_000;
/** The browser turns the recording into 16 kHz mono WAV (16-bit) before sending: 32 kB a second. */
export const WAV_RATE = 16_000;
export const MIN_AUDIO_BYTES = 2_000;
/** Transcriptions per person per rolling hour. */
export const HOURLY_LIMIT = 30;

/** What MediaRecorder should try, best first: Chrome, Android and Safari 18.4+ record webm; older Safari records mp4 (AAC). */
export const MIME_ORDER = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"] as const;

export type AudioFormat = "wav" | "webm" | "m4a" | "ogg" | "aac";

/** The format of a recorded Content-Type; null when it is not audio we take. */
export function audioFormat(mime: string | null | undefined): AudioFormat | null {
  const type = (mime ?? "").split(";")[0].trim().toLowerCase();
  if (type === "audio/wav" || type === "audio/x-wav" || type === "audio/wave") return "wav";
  if (type === "audio/webm") return "webm";
  if (type === "audio/ogg") return "ogg";
  if (type === "audio/mp4" || type === "audio/x-m4a" || type === "audio/m4a") return "m4a";
  if (type === "audio/aac") return "aac";
  return null;
}

/** Dictation is on when the AI Gateway is configured, unless VOICE_INPUT=off turns it off. */
export function voiceEnabledFrom(env: Record<string, string | undefined>) {
  return gatewayReady(env) && env.VOICE_INPUT !== "off";
}

/*
 * The two transcription models on the AI Gateway whose providers keep
 * nothing, checked live on 19/10/2026 with a Portuguese sample. MAI-Transcribe-2
 * (Azure) wrote it word for word with the pt-BR locale, but only reads WAV,
 * MP3, FLAC and Ogg, so the browser sends WAV. Grok STT (xAI) reads every
 * format a browser records but took the sample for English and garbled it:
 * it is the fallback, for a recording the browser could not convert or a
 * failure of MAI. The person reviews the text before sending it either way.
 */
export const DEFAULT_VOICE_MODEL = "microsoft/mai-transcribe-2";
export const DEFAULT_VOICE_FALLBACK = "spacexai/grok-stt";

/** What each default model reads; a model set by VOICE_MODEL is tried with any format. */
const READS: Record<string, AudioFormat[]> = {
  "microsoft/mai-transcribe-2": ["wav", "ogg"],
  "spacexai/grok-stt": ["wav", "webm", "m4a", "ogg", "aac"],
};

/**
 * The models to try for this recording, in order: the fallback is skipped
 * when "off" or the same as the first, and a model that cannot read the format is skipped.
 */
export function voiceModels(env: Record<string, string | undefined>, format: AudioFormat) {
  const first = env.VOICE_MODEL || DEFAULT_VOICE_MODEL;
  const second = env.VOICE_FALLBACK_MODEL || DEFAULT_VOICE_FALLBACK;
  const models = second === "off" || second === first ? [first] : [first, second];
  return models.filter((model) => READS[model]?.includes(format) ?? true);
}

/**
 * Options for one transcription: only providers that keep nothing, and
 * Portuguese for the Microsoft models (Azure takes locales; xAI detects the
 * language by itself, its own `language` only formats numbers).
 */
export function transcriptionOptions(model: string) {
  return {
    gateway: { ...PRIVATE_GATEWAY },
    ...(model.startsWith("microsoft/") ? { azure: { locales: ["pt-BR"] } } : {}),
  };
}

/** 16-bit PCM WAV, mono, from samples in [-1, 1]: the format every transcription model reads. */
export function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  const size = samples.length * 2;
  const out = new DataView(new ArrayBuffer(44 + size));
  const text = (at: number, value: string) => [...value].forEach((char, i) => out.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF");
  out.setUint32(4, 36 + size, true);
  text(8, "WAVE");
  text(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); // PCM
  out.setUint16(22, 1, true); // mono
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  text(36, "data");
  out.setUint32(40, size, true);
  samples.forEach((sample, i) => {
    const value = Math.max(-1, Math.min(1, sample));
    out.setInt16(44 + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  });
  return out.buffer;
}

/**
 * Whether a failed attempt is worth one more try with the fallback model.
 * Not for 401/402/403: the same key would fail the same way.
 */
export function shouldFallback(status: number, emptyText = false) {
  if (status >= 200 && status < 300) return emptyText;
  if (status === 401 || status === 402 || status === 403) return false;
  return status === 0 || status === 400 || status === 404 || status === 408 || status === 415 || status === 422 || status === 429 || status >= 500;
}

/**
 * Puts dictated text where the cursor was, with one space on each side where
 * the neighbours need it. A field set from code ignores maxLength, so the
 * inserted text is cut (never what was already typed).
 */
export function joinTranscript(value: string, start: number, end: number, inserted: string, maxLength: number) {
  const words = inserted.trim();
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  if (!words) return { value, caret: to, truncated: false };
  const before = value.slice(0, from);
  const after = value.slice(to);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  const room = Math.max(0, maxLength - before.length - after.length - lead.length - trail.length);
  const piece = words.slice(0, room);
  const truncated = piece.length < words.length;
  if (!piece) return { value, caret: to, truncated };
  const next = before + lead + piece + trail + after;
  return { value: next, caret: before.length + lead.length + piece.length + trail.length, truncated };
}

/** Shown while the microphone is open: where the audio goes. */
export const PRIVACY_LINE = "O áudio vai para um serviço de transcrição e não fica guardado.";

/** "0:07", "1:42": the recording timer. */
export const clockLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
