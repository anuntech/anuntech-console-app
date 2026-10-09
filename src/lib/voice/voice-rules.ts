/*
 * Dictation by microphone, the rules both sides share: what may be recorded,
 * how big, which formats the transcription endpoint takes and how the text
 * lands in a field. No DOM and no server code, so tests and both sides import it.
 */

/** A recording stops on its own at 2 minutes; the person sees a warning 10 seconds before. */
export const MAX_SECONDS = 120;
export const WARN_AT = 110;
export const MIN_SECONDS = 1;
/** Under Vercel's 4.5 MB request body limit, with room for the headers. */
export const MAX_AUDIO_BYTES = 4_000_000;
export const MIN_AUDIO_BYTES = 2_000;
/** Transcriptions per person per rolling hour. */
export const HOURLY_LIMIT = 30;

/** What MediaRecorder should try, best first: Chrome, Android and Safari 18.4+ record webm; older Safari records mp4 (AAC). */
export const MIME_ORDER = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"] as const;

export type AudioFormat = "webm" | "m4a" | "ogg" | "aac";

/** The format OpenRouter's transcription endpoint expects for a recorded Content-Type; null when it is not audio we take. */
export function audioFormat(mime: string | null | undefined): AudioFormat | null {
  const type = (mime ?? "").split(";")[0].trim().toLowerCase();
  if (type === "audio/webm") return "webm";
  if (type === "audio/ogg") return "ogg";
  if (type === "audio/mp4" || type === "audio/x-m4a" || type === "audio/m4a") return "m4a";
  if (type === "audio/aac") return "aac";
  return null;
}

/** Dictation is on when OpenRouter is configured, unless VOICE_INPUT=off turns it off. */
export function voiceEnabledFrom(env: Record<string, string | undefined>) {
  return !!env.OPENROUTER_API_KEY && env.VOICE_INPUT !== "off";
}

/*
 * Whisper on providers with zero data retention (Groq, DeepInfra, Together),
 * checked in production on 09/10/2026 with a Portuguese sample in webm and m4a.
 * MAI-Transcribe-2 answered 400 for every format and language, and Voxtral's
 * zero-retention endpoint sits behind a regional surcharge the account refuses.
 */
export const DEFAULT_VOICE_MODEL = "openai/whisper-large-v3-turbo";
export const DEFAULT_VOICE_FALLBACK = "openai/whisper-large-v3";

/** The models to try, in order: the fallback is skipped when "off" or the same as the first. */
export function voiceModels(env: Record<string, string | undefined>) {
  const first = env.VOICE_MODEL || DEFAULT_VOICE_MODEL;
  const second = env.VOICE_FALLBACK_MODEL || DEFAULT_VOICE_FALLBACK;
  return second === "off" || second === first ? [first] : [first, second];
}

/** Request body for POST /api/v1/audio/transcriptions: Portuguese, and only providers that keep nothing. */
export function transcriptionBody(model: string, data: string, format: AudioFormat) {
  return { model, input_audio: { data, format }, language: "pt", provider: { zdr: true } };
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
