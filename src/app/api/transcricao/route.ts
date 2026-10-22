import { getActor } from "@/lib/access/access";
import { sameOrigin } from "@/lib/http/same-origin";
import { transcribeFor, voiceOff } from "@/lib/voice/voice-http";
import { voiceEnabled } from "@/lib/voice/voice-server";

/*
 * Dictation: the browser posts the recording as raw audio, this answers
 * with the text. The person reviews it in the field and sends it themselves.
 * A route handler, not a Server Action: actions run one at a time per page
 * (it would hold the form's own submit) and cannot be cancelled. The rules
 * are in voice-http.ts, shared with the app's /api/v1/transcricao.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "O envio foi recusado. Recarregue a página e tente de novo." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  if (!voiceEnabled()) return voiceOff();
  return transcribeFor(await getActor(), request);
}
