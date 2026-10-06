"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  MAX_AUDIO_BYTES,
  MAX_SECONDS,
  MIME_ORDER,
  MIN_AUDIO_BYTES,
  MIN_SECONDS,
  PRIVACY_LINE,
  WARN_AT,
} from "@/lib/voice/voice-rules";

/*
 * Dictation: tap to record, tap to stop, the text comes back from
 * /api/transcricao and goes to the field. Nothing is ever sent for the
 * person. This is the only place in the Console that opens the microphone,
 * and every path out of a recording (stop, cancel, error, unmount, the page
 * hidden) turns it off.
 */

export type DictationPhase = "idle" | "starting" | "recording" | "transcribing" | "error";

type State = { phase: DictationPhase; seconds: number; level: number; notice: string; canRetry: boolean };
const initial: State = { phase: "idle", seconds: 0, level: 0, notice: "", canRetry: false };

type Session = {
  discard: boolean;
  stream?: MediaStream;
  recorder?: MediaRecorder;
  ctx?: AudioContext;
  wakeLock?: WakeLockSentinel;
  chunks: Blob[];
  mime: string;
  startedAt: number;
  peak: number;
  metered: boolean;
  intervals: number[];
  cleanup: (() => void)[];
};

const subscribe = () => () => {};
function detect() {
  try {
    return (
      window.isSecureContext &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined" &&
      MIME_ORDER.some((type) => MediaRecorder.isTypeSupported(type))
    );
  } catch {
    return false;
  }
}

/** Below this loudness (RMS, 0 to 1) a recording is taken as silence and not sent. */
const SILENCE = 0.01;
const tooBig = "O áudio ficou grande demais. Grave até 2 minutos por vez.";
const failed = "Não foi possível transcrever agora. Tente de novo ou digite o texto.";

function permissionNotice(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Nenhum microfone foi encontrado neste aparelho.";
  if (name === "NotReadableError" || name === "AbortError")
    return "O microfone está em uso por outro app. Encerre a ligação ou feche o app e tente de novo.";
  return "O microfone está bloqueado para o Console. Libere o microfone nas configurações do navegador e tente de novo. Se você abriu o link pelo WhatsApp ou Instagram, abra no Safari ou no Chrome.";
}

/** One open microphone at a time: starting a recording ends another one (a transcription in flight goes on). */
let live: { cancel: () => void } | null = null;

function createDictation(update: (patch: Partial<State>) => void) {
  // Set by the field on every render, so the text goes where it is now.
  let deliver: (text: string) => string | void = () => {};
  let session: Session | null = null;
  let request: AbortController | null = null;
  let kept: Blob | null = null;
  const self = {
    cancel: () => {
      if (session) halt(false);
    },
  };

  function release(s: Session) {
    s.intervals.forEach((id) => window.clearInterval(id));
    s.intervals = [];
    s.cleanup.forEach((fn) => fn());
    s.cleanup = [];
    s.stream?.getTracks().forEach((track) => track.stop());
    if (s.ctx && s.ctx.state !== "closed") void s.ctx.close().catch(() => {});
    void s.wakeLock?.release().catch(() => {});
    s.wakeLock = undefined;
    if (session === s) session = null;
    if (live === self && !session) live = null;
  }

  function fail(notice: string, canRetry: boolean) {
    if (!canRetry) kept = null;
    update({ phase: "error", notice, canRetry, seconds: 0, level: 0 });
  }

  async function send(audio: Blob) {
    kept = audio;
    const controller = new AbortController();
    request = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 50_000);
    update({ phase: "transcribing", notice: "Transcrevendo…", canRetry: false, seconds: 0, level: 0 });
    try {
      const res = await fetch("/api/transcricao", {
        method: "POST",
        body: audio,
        headers: { "Content-Type": audio.type || "audio/webm" },
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!res.headers.get("content-type")?.includes("application/json")) {
        // A session that ended answers with the sign-in page; anything else is the server failing.
        if (res.redirected || res.status === 401) return fail("Sua sessão terminou. Entre de novo para usar o microfone.", false);
        return fail(failed, res.status >= 500);
      }
      const body = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !body.text) return fail(body.error || failed, [502, 503, 504].includes(res.status));
      kept = null;
      // The field may answer with its own notice (the text was cut at its limit).
      const note = deliver(body.text);
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
      window.clearTimeout(timer);
      if (request === controller) request = null;
    }
  }

  function finish(s: Session) {
    const elapsed = (performance.now() - s.startedAt) / 1000;
    const audio = new Blob(s.chunks, { type: s.recorder?.mimeType || s.mime || "audio/webm" });
    release(s);
    if (s.discard) return;
    if (elapsed < MIN_SECONDS || audio.size < MIN_AUDIO_BYTES || (s.metered && s.peak < SILENCE))
      return update({ phase: "idle", notice: "Não deu para ouvir nada. Fale perto do microfone e tente de novo.", seconds: 0, level: 0 });
    if (audio.size > MAX_AUDIO_BYTES) return fail(tooBig, false);
    void send(audio);
  }

  function stopSession(s: Session) {
    if (s.recorder && s.recorder.state !== "inactive") {
      try {
        s.recorder.stop();
      } catch {
        s.discard = true;
        release(s);
        fail("A gravação parou com um erro. Grave de novo.", false);
      }
    }
  }

  function begin(s: Session, stream: MediaStream) {
    const mime = MIME_ORDER.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32_000 });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    s.recorder = recorder;
    s.mime = mime;
    recorder.ondataavailable = (event) => {
      if (event.data.size) s.chunks.push(event.data);
    };
    recorder.onstop = () => finish(s);
    // Chunks every second: Safari writes a playable file and a hidden page keeps what was said.
    recorder.start(1000);
    s.startedAt = performance.now();
    if (s.ctx) {
      try {
        const analyser = s.ctx.createAnalyser();
        analyser.fftSize = 1024;
        s.ctx.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        s.intervals.push(
          window.setInterval(() => {
            // A suspended context (iOS) reads zeros: then the level says nothing about silence.
            if (s.ctx?.state !== "running") return;
            analyser.getByteTimeDomainData(samples);
            let sum = 0;
            for (const value of samples) sum += ((value - 128) / 128) ** 2;
            const rms = Math.sqrt(sum / samples.length);
            s.metered = true;
            s.peak = Math.max(s.peak, rms);
            update({ level: Math.min(1, rms * 5) });
          }, 120),
        );
      } catch {
        /* The level is a nicety; recording goes on without it. */
      }
    }
    let warned = false;
    s.intervals.push(
      window.setInterval(() => {
        const elapsed = (performance.now() - s.startedAt) / 1000;
        update({ seconds: Math.floor(elapsed) });
        if (elapsed >= WARN_AT && !warned) {
          warned = true;
          update({ notice: "Faltam 10 segundos." });
        }
        if (elapsed >= MAX_SECONDS) stopSession(s);
      }, 250),
    );
    // Switching apps, locking the phone or losing the microphone ends the recording; what was said is still transcribed.
    const onHide = () => {
      if (document.visibilityState === "hidden") stopSession(s);
    };
    document.addEventListener("visibilitychange", onHide);
    s.cleanup.push(() => document.removeEventListener("visibilitychange", onHide));
    for (const track of stream.getAudioTracks()) track.onended = () => stopSession(s);
    update({ phase: "recording", notice: `Gravando. ${PRIVACY_LINE} Toque em Parar quando terminar.` });
  }

  function start() {
    if (session || request) return;
    if (live && live !== self) live.cancel();
    live = self;
    kept = null;
    const s: Session = { discard: false, chunks: [], mime: "", startedAt: performance.now(), peak: 0, metered: false, intervals: [], cleanup: [] };
    session = s;
    update({ phase: "starting", notice: "Permita o uso do microfone.", canRetry: false, seconds: 0, level: 0 });
    // iOS lets audio start only inside the tap, so the context is made before any await.
    try {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) {
        s.ctx = new Context();
        void s.ctx.resume().catch(() => {});
      }
    } catch {
      /* No level meter on this browser. */
    }
    // The screen would lock after about 30 seconds without a touch and cut the recording short.
    navigator.wakeLock?.request("screen").then(
      (lock) => {
        if (s.discard || session !== s) void lock.release().catch(() => {});
        else s.wakeLock = lock;
      },
      () => {},
    );
    navigator.mediaDevices
      .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(
        (stream) => {
          s.stream = stream;
          if (s.discard) return release(s);
          try {
            begin(s, stream);
          } catch {
            s.discard = true;
            release(s);
            fail("Não foi possível abrir o microfone. Tente de novo.", false);
          }
        },
        (error) => {
          release(s);
          if (s.discard) return;
          fail(permissionNotice(error), false);
        },
      );
  }

  function halt(silent: boolean) {
    request?.abort();
    request = null;
    kept = null;
    const s = session;
    if (s) {
      s.discard = true;
      if (s.recorder && s.recorder.state !== "inactive") {
        try {
          s.recorder.stop();
        } catch {
          /* released below */
        }
      }
      release(s);
    }
    if (!silent) update({ ...initial, notice: "Gravação descartada." });
  }

  return {
    start,
    stop: () => session && stopSession(session),
    cancel: () => halt(false),
    retry: () => {
      if (kept && !request && !session) void send(kept);
    },
    /** A word from the field while it waits (the form was sent during the transcription). */
    say: (notice: string) => update({ notice }),
    /** Clears what the last dictation left on screen (after the message went out). */
    dismiss: () => {
      if (session || request) return;
      kept = null;
      update(initial);
    },
    dispose: () => halt(true),
    deliverTo: (fn: (text: string) => string | void) => {
      deliver = fn;
    },
  };
}

/** `onText` puts the transcript in the field; it may return a notice to show instead of the default one. */
export function useDictation(onText: (text: string) => string | void) {
  const supported = useSyncExternalStore(subscribe, detect, () => false);
  const [state, setState] = useState(initial);
  const [control] = useState(() => createDictation((patch) => setState((previous) => ({ ...previous, ...patch }))));
  useEffect(() => {
    control.deliverTo(onText);
  });
  useEffect(() => () => control.dispose(), [control]);
  const busy = state.phase === "starting" || state.phase === "recording" || state.phase === "transcribing";
  // Escape ends the recording, wherever the focus is, before any sheet or panel sees it (they skip a prevented Escape).
  useEffect(() => {
    if (!busy) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      control.cancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, control]);
  return {
    supported,
    busy,
    ...state,
    /** The last ten seconds, shown on screen too. */
    ending: state.phase === "recording" && state.seconds >= WARN_AT,
    start: control.start,
    stop: control.stop,
    cancel: control.cancel,
    retry: control.retry,
    dismiss: control.dismiss,
    say: control.say,
  };
}
