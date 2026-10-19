import "server-only";
import { createHmac } from "node:crypto";
import { gateway, NoTranscriptGeneratedError, transcribe as transcribeWith } from "ai";
import { GatewayError } from "@ai-sdk/gateway";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { HOURLY_LIMIT, MAX_SECONDS, portuguese, shouldFallback, transcriptionOptions, voiceEnabledFrom, voiceModels, wavSeconds, type AudioFormat } from "./voice-rules";

/*
 * Speech to text through the AI Gateway, like every AI call of the Console.
 * Jev itself only reads text and answers with decisions, so a transcription
 * model does this part: MAI-Transcribe-2, then Grok STT (voice-rules.ts).
 * Every call only reaches providers with zero data retention, and the audio
 * lives only in this request: nothing is stored or logged but the numbers.
 */

export const voiceEnabled = () => voiceEnabledFrom(process.env);

export class VoiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const voiceKey = (userId: string) => createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`voice:${userId}`).digest("hex");

/** Per-person throttle shared by every instance, on the OTP limits table (HMAC key, never the raw id). */
export async function reserveVoice(userId: string) {
  const key = voiceKey(userId);
  const result = await db.execute(sql`
    INSERT INTO console_otp_limits (key,last_sent_at,window_start,count) VALUES (${key},now(),now(),1)
    ON CONFLICT (key) DO UPDATE SET last_sent_at=now(),
      window_start=CASE WHEN console_otp_limits.window_start < now()-interval '1 hour' THEN now() ELSE console_otp_limits.window_start END,
      count=CASE WHEN console_otp_limits.window_start < now()-interval '1 hour' THEN 1 ELSE console_otp_limits.count+1 END
    WHERE console_otp_limits.window_start < now()-interval '1 hour' OR console_otp_limits.count < ${HOURLY_LIMIT}
    RETURNING key`);
  return result.rows.length > 0;
}

/**
 * The browser stops at 2 minutes, but a request could carry more: audio
 * longer than that counts as one more transcription for each extra 2 minutes.
 */
export async function chargeLongAudio(userId: string, seconds: number | undefined) {
  const extra = seconds ? Math.ceil(seconds / MAX_SECONDS) - 1 : 0;
  if (extra <= 0) return;
  await db.execute(sql`UPDATE console_otp_limits SET count = count + ${extra} WHERE key = ${voiceKey(userId)}`);
}

/** The status a failed attempt counts as, for the fallback rule; 0 when the Gateway was not reached. */
function failedStatus(error: unknown): { status: number; detail: string } {
  if (NoTranscriptGeneratedError.isInstance(error)) return { status: 200, detail: "empty transcript" };
  if (GatewayError.isInstance(error)) {
    // A deadline comes back as a 500 around the abort: say so, the status alone looks like the Gateway failing.
    const cause = (error as { cause?: unknown }).cause;
    const late = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
    return { status: error.statusCode, detail: late ? `timeout (${cause.name})` : error.message.slice(0, 200) };
  }
  // A missing or refused credential, as the SDK rewraps it: the status is gone, the name stays.
  if (error instanceof Error && error.name.startsWith("Gateway")) return { status: 401, detail: error.name };
  return { status: 0, detail: error instanceof Error ? error.name : "unknown" };
}

export async function transcribe(bytes: Buffer, format: AudioFormat, signal: AbortSignal): Promise<{ text: string; seconds?: number }> {
  const models = voiceModels(process.env, format);
  if (!models.length)
    throw new VoiceError(415, "Este navegador gravou o áudio num formato que o Console não aceita. Digite o texto ou use outro navegador.");
  // Whether the last attempt answered, but with nothing heard.
  let unclear = false;
  for (const [index, model] of models.entries()) {
    const started = Date.now();
    let status = 200;
    let detail = "empty transcript";
    try {
      const result = await transcribeWith({
        model: gateway.transcriptionModel(model),
        audio: bytes,
        providerOptions: transcriptionOptions(model),
        // The fallback below is the retry; each attempt gets 20 seconds.
        maxRetries: 0,
        abortSignal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
      // Grok took a Portuguese sample for English and garbled it: text in another language counts as unclear.
      const text = portuguese(result.language) ? result.text.trim() : "";
      if (!text && result.text.trim()) detail = `language ${result.language}`;
      // The model may leave the duration out: the last segment's end, or a WAV's header, says it too.
      // The largest wins, so a header can only make a recording count for more.
      const seconds = Math.max(result.durationInSeconds ?? 0, result.segments.at(-1)?.endSecond ?? 0, wavSeconds(bytes) ?? 0) || undefined;
      if (text) {
        console.info("[voice]", {
          model,
          format,
          bytes: bytes.length,
          seconds,
          cost: (result.providerMetadata?.gateway as { cost?: unknown } | undefined)?.cost,
          ms: Date.now() - started,
          fallback: index > 0,
        });
        if (seconds === undefined) console.warn("[voice] duration unknown", { model, format, bytes: bytes.length });
        return { text, seconds };
      }
    } catch (error) {
      // The person cancelled: nobody is waiting for an answer.
      if (signal.aborted) throw new VoiceError(499, "");
      ({ status, detail } = failedStatus(error));
    }
    const empty = status >= 200 && status < 300;
    unclear = empty;
    console.warn("[voice] Gateway refused", { model, status, detail });
    if (status === 401 || status === 402 || status === 403)
      throw new VoiceError(503, "A transcrição está indisponível agora. Digite o texto ou tente mais tarde.");
    if (!shouldFallback(status, empty)) break;
  }
  if (unclear) throw new VoiceError(422, "Não deu para entender o áudio. Fale perto do microfone e tente de novo.");
  throw new VoiceError(502, "Não foi possível transcrever agora. Tente de novo ou digite o texto.");
}
