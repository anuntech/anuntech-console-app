import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type * as ExpoAudio from "expo-audio";
import { File } from "expo-file-system";
import { sessionHeaders } from "./api";
import { CONSOLE_URL } from "./config";
import { haptic } from "./haptics";

/*
 * Dictation, as the web's "Falar" (src/components/console/use-dictation.ts):
 * tap to record, tap to stop, the text comes back from the Console's
 * transcription (/api/v1/transcricao, the same rules, limits and models as
 * the web's /api/transcricao) and goes into the field for the person to
 * review. Nothing is ever sent for them. The phone records 16 kHz mono WAV,
 * which the best model for Portuguese reads, and the file is deleted as soon
 * as it was sent. Every path out (stop, cancel, error, leaving the app,
 * leaving the screen) turns the microphone off.
 */

/*
 * The recorder is a native module that builds before 1.2.0 do not have: an
 * update over the air must not crash them, so there the microphone simply
 * does not show (as on a browser without MediaRecorder).
 */
const audio: typeof ExpoAudio | null = requireOptionalNativeModule("ExpoAudio")
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("expo-audio") as typeof ExpoAudio)
  : null;
/** Whether this build can record. */
export const dictationAvailable = !!audio;
/** Chosen once, at load: the hook order never changes. */
const useStream: (options: ExpoAudio.AudioStreamOptions) => { stream: ExpoAudio.AudioStream } | { stream: null } = audio
  ? audio.useAudioStream
  : () => ({ stream: null });

// The same numbers as src/lib/voice/voice-rules.ts (the app imports only the API's types).
export const MAX_SECONDS = 120;
export const WARN_AT = 110;
const MIN_SECONDS = 1;
const MAX_AUDIO_BYTES = 4_000_000;
const MIN_AUDIO_BYTES = 2_000;
const WAV_RATE = 16_000;
export const PRIVACY_LINE = "O áudio vai para um serviço de transcrição e não fica guardado.";
const uploadWaitMs = (bytes: number) => 50_000 + Math.ceil(bytes / 40);
/** Below this loudness (RMS, 0 to 1) a recording is taken as silence and not sent. */
const SILENCE = 0.01;

const tooBig = "O áudio ficou grande demais. Grave até 2 minutos por vez.";
const failed = "Não foi possível transcrever agora. Tente de novo ou digite o texto.";

/** "0:07", "1:42": the recording timer. */
export const clockLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * Puts dictated text at the end of what was typed, with a space between
 * them, cut to the field's limit (never what was already typed), as
 * joinTranscript in voice-rules.ts does at the caret.
 */
export function appendTranscript(value: string, inserted: string, maxLength: number) {
  const words = inserted.trim();
  if (!words) return { value, truncated: false };
  const lead = value && !/\s$/.test(value) ? " " : "";
  const room = Math.max(0, maxLength - value.length - lead.length);
  const piece = words.slice(0, room);
  return { value: piece ? value + lead + piece : value, truncated: piece.length < words.length };
}

export type DictationPhase = "idle" | "starting" | "recording" | "transcribing" | "error";
/** `limit`: where this recording stops on its own (2 minutes, less on a phone that records at a higher rate). */
type State = { phase: DictationPhase; seconds: number; limit: number; notice: string; canRetry: boolean };
const initial: State = { phase: "idle", seconds: 0, limit: MAX_SECONDS, notice: "", canRetry: false };

/** The loudness of one buffer of 16-bit samples, 0 to 1. */
function loudness(buffer: ExpoAudio.AudioStreamBuffer) {
  const samples = new Int16Array(buffer.data);
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += (sample / 32768) ** 2;
  return Math.sqrt(sum / samples.length);
}

/** `onText` puts the transcript in the field; it may return a notice to show instead of the default one. */
export function useDictation(onText: (text: string) => string | void) {
  const [state, setState] = useState(initial);
  const update = (patch: Partial<State>) => setState((previous) => ({ ...previous, ...patch }));
  const deliver = useRef(onText);
  useEffect(() => {
    deliver.current = onText;
  });
  const peak = useRef(0);
  /** Whether the level was read at all: without it, silence cannot be told apart. */
  const metered = useRef(false);
  /** Bumped by Cancelar: a start still waiting for the microphone then gives up. */
  const attempt = useRef(0);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  /** The recording kept for "Tentar de novo" after a failure worth retrying. */
  const kept = useRef<ArrayBuffer | null>(null);
  const live = useRef(false);
  const { stream } = useStream({
    sampleRate: WAV_RATE,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer) => {
      metered.current = true;
      peak.current = Math.max(peak.current, loudness(buffer));
    },
  });

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  /** Turns the microphone off and returns the recording's file, if there was one. */
  async function release(): Promise<{ uri: string; size: number; duration: number } | null> {
    clearTimer();
    if (!live.current || !stream) return null;
    live.current = false;
    let result: { uri: string; size: number; duration: number } | null = null;
    try {
      result = await stream.stopFileRecordingAsync();
    } catch {
      result = null;
    }
    try {
      stream.stop();
    } catch {
      /* already off */
    }
    return result;
  }

  const remove = (uri: string) => {
    try {
      new File(uri).delete();
    } catch {
      /* the cache is cleared by the system anyway */
    }
  };

  function fail(notice: string, canRetry: boolean) {
    if (!canRetry) kept.current = null;
    haptic.error();
    update({ phase: "error", notice, canRetry, seconds: 0 });
  }

  async function send(recording: ArrayBuffer) {
    kept.current = recording;
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    // The wait starts with the upload and grows with it: 2 minutes of WAV take a while on a slow line.
    const wait = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, uploadWaitMs(recording.byteLength));
    update({ phase: "transcribing", notice: "Transcrevendo…", canRetry: false, seconds: 0 });
    try {
      const response = await fetch(`${CONSOLE_URL}/api/v1/transcricao`, {
        method: "POST",
        headers: { ...(await sessionHeaders()), "Content-Type": "audio/wav" },
        body: recording,
        // The cookie goes by hand, as in every API call.
        credentials: "omit",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) return fail("Sua sessão terminou. Entre de novo para usar o microfone.", false);
      const body = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!response.ok || !body?.text) return fail(body?.error || failed, [502, 503, 504].includes(response.status));
      kept.current = null;
      const note = deliver.current(body.text);
      haptic.success();
      update({ phase: "idle", notice: note || "Texto inserido. Revise antes de enviar.", canRetry: false });
    } catch {
      // Cancelled by the person: the field stays as it was.
      if (controller.signal.aborted && !timedOut) return;
      fail(
        timedOut
          ? "A transcrição demorou demais. Toque em Tentar de novo."
          : "Não foi possível enviar o áudio. Confira a conexão e toque em Tentar de novo.",
        true,
      );
    } finally {
      clearTimeout(wait);
      if (request.current === controller) request.current = null;
    }
  }

  async function stop() {
    if (!live.current) return;
    const elapsed = (Date.now() - startedAt.current) / 1000;
    const file = await release();
    if (!file) return fail("A gravação parou com um erro. Grave de novo.", false);
    let recording: ArrayBuffer;
    try {
      recording = await new File(file.uri).arrayBuffer();
    } catch {
      remove(file.uri);
      return fail("A gravação parou com um erro. Grave de novo.", false);
    }
    remove(file.uri);
    if (elapsed < MIN_SECONDS || recording.byteLength < MIN_AUDIO_BYTES || (metered.current && peak.current < SILENCE))
      return update({ phase: "idle", notice: "Não deu para ouvir nada. Fale perto do microfone e tente de novo.", seconds: 0 });
    if (recording.byteLength > MAX_AUDIO_BYTES) return fail(tooBig, false);
    void send(recording);
  }

  async function start() {
    if (!audio || !stream || live.current || request.current || state.phase === "starting") return;
    kept.current = null;
    peak.current = 0;
    metered.current = false;
    const mine = ++attempt.current;
    haptic.light();
    update({ phase: "starting", notice: "Permita o uso do microfone.", canRetry: false, seconds: 0 });
    const permission = await audio.requestRecordingPermissionsAsync().catch(() => null);
    if (mine !== attempt.current) return;
    if (!permission?.granted)
      return fail(
        permission && !permission.canAskAgain
          ? "O microfone está bloqueado para o Console. Libere o microfone nos Ajustes do celular e tente de novo."
          : "Sem o microfone, digite o texto.",
        false,
      );
    try {
      await stream.start();
      live.current = true;
      await stream.startFileRecordingAsync({ format: "wav" });
    } catch {
      await release();
      if (mine !== attempt.current) return;
      return fail("O microfone está em uso por outro app. Encerre a ligação ou feche o app e tente de novo.", false);
    }
    if (mine !== attempt.current) {
      const file = await release();
      if (file) remove(file.uri);
      return;
    }
    startedAt.current = Date.now();
    // Some phones only record at 44.1 or 48 kHz: the recording then ends earlier, before it passes the size the Console takes.
    const bytesPerSecond = (stream.sampleRate || WAV_RATE) * 2;
    const limit = Math.min(MAX_SECONDS, Math.floor((MAX_AUDIO_BYTES - 1_000) / bytesPerSecond));
    let warned = false;
    timer.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      update({ seconds: Math.floor(elapsed) });
      if (elapsed >= limit - (MAX_SECONDS - WARN_AT) && !warned) {
        warned = true;
        haptic.medium();
        update({ notice: "Faltam 10 segundos." });
      }
      if (elapsed >= limit) void stop();
    }, 250);
    update({ phase: "recording", limit, notice: `Gravando. ${PRIVACY_LINE} Toque em Parar quando terminar.` });
  }

  async function cancel() {
    attempt.current += 1;
    request.current?.abort();
    request.current = null;
    kept.current = null;
    const file = await release();
    if (file) remove(file.uri);
    update({ ...initial, notice: "Gravação descartada." });
  }

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  });
  // Leaving the app ends the recording; what was said is still transcribed.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && live.current) void stopRef.current();
    });
    return () => subscription.remove();
  }, []);
  // Leaving the screen discards everything.
  useEffect(
    () => () => {
      request.current?.abort();
      clearTimer();
      if (live.current) {
        live.current = false;
        try {
          stream?.stop();
        } catch {
          /* already off */
        }
      }
    },
    [stream],
  );

  const busy = state.phase === "starting" || state.phase === "recording" || state.phase === "transcribing";
  return {
    ...state,
    available: dictationAvailable,
    busy,
    /** The last ten seconds. */
    ending: state.phase === "recording" && state.seconds >= state.limit - (MAX_SECONDS - WARN_AT),
    start: () => void start(),
    stop: () => void stop(),
    cancel: () => void cancel(),
    retry: () => {
      if (kept.current && !request.current && !live.current) void send(kept.current);
    },
    /** Clears what the last dictation left on screen (after the message went out). */
    dismiss: () => {
      if (busy) return;
      kept.current = null;
      setState(initial);
    },
  };
}

export type Dictation = ReturnType<typeof useDictation>;
