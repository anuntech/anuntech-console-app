import { appActor } from "@/lib/api/app-request";
import { transcribeFor } from "@/lib/voice/voice-http";

/*
 * The app's dictation: the same as /api/transcricao (rules, hourly limit,
 * zero-retention models, nothing stored), with the app's session instead of
 * the browser's origin. The body is the raw recording (16 kHz mono WAV).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { actor, response } = await appActor(request);
  if (!actor) {
    const refusal = response ?? Response.json({ error: "Entre novamente para continuar." }, { status: 401 });
    refusal.headers.set("Cache-Control", "private, no-store");
    return refusal;
  }
  return transcribeFor(actor, request);
}
