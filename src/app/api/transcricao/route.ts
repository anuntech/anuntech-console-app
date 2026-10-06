import { allowedIds, getActor } from "@/lib/access/access";
import { sameOrigin } from "@/lib/http/same-origin";
import { audioFormat, MAX_AUDIO_BYTES, MIN_AUDIO_BYTES } from "@/lib/voice/voice-rules";
import { chargeLongAudio, reserveVoice, transcribe, voiceEnabled, VoiceError } from "@/lib/voice/voice-server";

/*
 * Dictation: the browser posts the recording as raw audio, this answers
 * with the text. The person reviews it in the field and sends it themselves.
 * A route handler, not a Server Action: actions run one at a time per page
 * (it would hold the form's own submit) and cannot be cancelled.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const respond = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

const tooBig = "O áudio ficou grande demais. Grave até 2 minutos por vez.";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return respond({ error: "O envio foi recusado. Recarregue a página e tente de novo." }, 403);
  if (!voiceEnabled()) return respond({ error: "O microfone não está disponível agora. Digite o texto." }, 404);
  const actor = await getActor();
  // The same people who can open a ticket or talk to the assistant.
  if (!actor.admin && !allowedIds(actor, "support").length) return respond({ error: "Acesso negado." }, 403);
  const format = audioFormat(request.headers.get("content-type"));
  if (!format)
    return respond(
      { error: "Este navegador gravou o áudio num formato que o Console não aceita. Digite o texto ou use outro navegador." },
      415,
    );
  if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES) return respond({ error: tooBig }, 413);
  const reserved = await reserveVoice(actor.user.id).catch((error: unknown) => {
    console.error("[voice] throttle failed", error instanceof Error ? error.message : "unknown");
    return null;
  });
  if (reserved === null) return respond({ error: "Não foi possível transcrever agora. Tente de novo ou digite o texto." }, 503);
  if (!reserved)
    return respond({ error: "Você usou o microfone muitas vezes na última hora. Digite o texto ou tente mais tarde." }, 429);
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length > MAX_AUDIO_BYTES) return respond({ error: tooBig }, 413);
  if (bytes.length < MIN_AUDIO_BYTES) return respond({ error: "O áudio chegou vazio. Grave de novo." }, 400);
  try {
    const { text, seconds } = await transcribe(bytes, format, request.signal);
    await chargeLongAudio(actor.user.id, seconds).catch(() => {});
    return respond({ text });
  } catch (error) {
    if (error instanceof VoiceError) return respond({ error: error.message }, error.status);
    console.error("[voice] failed", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
    return respond({ error: "Não foi possível transcrever agora. Tente de novo ou digite o texto." }, 502);
  }
}
