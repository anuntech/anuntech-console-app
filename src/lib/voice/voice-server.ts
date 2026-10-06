import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { HOURLY_LIMIT, MAX_SECONDS, shouldFallback, transcriptionBody, voiceEnabledFrom, voiceModels, type AudioFormat } from "./voice-rules";

/*
 * Speech to text through OpenRouter, with the key the assistant and Jev
 * already use. Jev itself only reads text and answers with decisions, so a
 * transcription model does this part: MAI-Transcribe-2, then Voxtral Mini.
 * Every call asks for providers with zero data retention, and the audio
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

type Reply = { text?: string; usage?: { seconds?: number; cost?: number }; error?: { message?: string } };

export async function transcribe(bytes: Buffer, format: AudioFormat, signal: AbortSignal): Promise<{ text: string; seconds?: number }> {
  const data = bytes.toString("base64");
  const models = voiceModels(process.env);
  // Whether the last attempt answered, but with nothing heard.
  let unclear = false;
  for (const [index, model] of models.entries()) {
    const started = Date.now();
    let status = 0;
    let reply: Reply | null = null;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.BETTER_AUTH_URL || "https://console.anuntech.com",
          "X-Title": "Anuntech Console",
        },
        body: JSON.stringify(transcriptionBody(model, data, format)),
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
      status = res.status;
      reply = (await res.json().catch(() => null)) as Reply | null;
    } catch {
      // The person cancelled: nobody is waiting for an answer.
      if (signal.aborted) throw new VoiceError(499, "");
    }
    const text = reply?.text?.trim() ?? "";
    if (status >= 200 && status < 300 && text) {
      console.info("[voice]", {
        model,
        format,
        bytes: bytes.length,
        seconds: reply?.usage?.seconds,
        cost: reply?.usage?.cost,
        ms: Date.now() - started,
        fallback: index > 0,
      });
      return { text, seconds: reply?.usage?.seconds };
    }
    const empty = status >= 200 && status < 300;
    unclear = empty;
    console.warn("[voice] OpenRouter refused", {
      model,
      status,
      detail: empty ? "empty transcript" : String(reply?.error?.message ?? `HTTP ${status}`).slice(0, 200),
    });
    if (status === 401 || status === 402 || status === 403)
      throw new VoiceError(503, "A transcrição está indisponível agora. Digite o texto ou tente mais tarde.");
    if (!shouldFallback(status, empty)) break;
  }
  if (unclear) throw new VoiceError(422, "Não deu para entender o áudio. Fale perto do microfone e tente de novo.");
  throw new VoiceError(502, "Não foi possível transcrever agora. Tente de novo ou digite o texto.");
}
