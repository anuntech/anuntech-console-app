import { appCaller, exchangeCode, revokeConnection } from "@/lib/meetings/meeting-connections";
import { exchangeInput } from "@/lib/meetings/meeting-rules";

/*
 * The Mac meeting-notes app (lib/meetings). No session cookie here: POST
 * trades the one-time code and the PKCE verifier for a key, and DELETE is
 * the app's own "Desconectar", signed with that key.
 */

const respond = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 4096)
    return respond({ error: "Pedido grande demais." }, 413);
  const parsed = exchangeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond({ error: "Pedido de conexão inválido. Conecte de novo pelo app." }, 400);
  const connected = await exchangeCode(parsed.data);
  if (!connected)
    return respond({ error: "O código expirou ou já foi usado. Conecte de novo pelo app." }, 400);
  return respond(connected);
}

export async function DELETE(request: Request) {
  const caller = await appCaller(request);
  if (!caller) return new Response(null, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  await revokeConnection(caller.actor.user.id, caller.connectionId, "app");
  return new Response(null, { status: 204 });
}
