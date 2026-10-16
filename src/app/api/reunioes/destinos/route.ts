import { appCaller } from "@/lib/meetings/meeting-connections";
import { destinationsFor } from "@/lib/meetings/meeting-notes";

/** The Mac app's "Salvar em" menu: who is connected and where they may save notes. */
export async function GET(request: Request) {
  const caller = await appCaller(request);
  if (!caller) return new Response(null, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  const { actor } = caller;
  return Response.json(
    { person: { name: actor.user.name, email: actor.user.email }, spaces: await destinationsFor(actor) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
