import { appCaller, reserveNote } from "@/lib/meetings/meeting-connections";
import { saveMeetingNote } from "@/lib/meetings/meeting-notes";
import { MAX_NOTE_BYTES, NOTE_TOO_LARGE, noteInput } from "@/lib/meetings/meeting-rules";
import { meetingHref } from "@/lib/bookmarks/board-rules";

/*
 * A meeting note from the Mac app, saved as a bookmark file where the person
 * chose. The audio never comes here: it stays on the Mac next to the note.
 */

const respond = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  const caller = await appCaller(request);
  if (!caller) return new Response(null, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  // The JSON around the Markdown (escapes, other fields) needs some room over the file's own limit.
  if (Number(request.headers.get("content-length") || 0) > MAX_NOTE_BYTES * 1.5)
    return respond({ error: NOTE_TOO_LARGE }, 413);
  const parsed = noteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond({ error: parsed.error.issues[0]?.message ?? "Nota inválida." }, 400);
  const { actor } = caller;
  const allowed = await reserveNote(actor.user.id).catch(() => null);
  if (allowed === null) return respond({ error: "Não foi possível salvar agora. O app tenta de novo." }, 503);
  if (!allowed) return respond({ error: "Muitas notas na última hora. O app tenta de novo mais tarde." }, 429);
  const saved = await saveMeetingNote(actor, parsed.data, caller.device);
  if (!saved) return respond({ error: "Você não pode salvar nesta empresa ou pasta. Escolha outro destino no app." }, 403);
  const origin = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
  return respond({ id: saved.id, url: `${origin}${meetingHref(saved.id)}` }, saved.created ? 201 : 200);
}
