import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { router } from "@/lib/api/router";
import { logDatabaseFault } from "@/lib/action-errors";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      // Expected refusals are answers; anything else is logged without values.
      if (!(error instanceof ORPCError) || error.status >= 500)
        if (!logDatabaseFault("api", error)) console.error("[api] failure");
    }),
  ],
});

/**
 * The native app's API (contract in lib/api/contract.ts). It authenticates by
 * the session cookie the app keeps in SecureStore, so a browser on another
 * site never gets through: the app sends no Sec-Fetch-Site.
 */
async function serve(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    return Response.json({ message: "Origem não permitida." }, { status: 403 });
  const { matched, response } = await handler.handle(request, {
    prefix: "/api/v1",
    context: { headers: request.headers },
  });
  if (!matched) return Response.json({ message: "Não encontrado." }, { status: 404 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const GET = serve;
export const POST = serve;
