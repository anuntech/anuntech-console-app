import "server-only";
import { actorForSession } from "../access/access";
import { auth } from "../auth/auth";
import { isJson } from "../http/same-origin";

/**
 * The person behind a request from the native app, for the routes that are
 * not oRPC procedures (the assistant's stream). Same rules as /api/v1: the
 * session cookie the app keeps, no assisted access, and a browser on another
 * site never gets through (the app sends no Sec-Fetch-Site). Writes also need
 * a JSON body, which a form cannot send.
 */
export async function appActor(request: Request, { json = false }: { json?: boolean } = {}) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    return { response: Response.json({ error: "Origem não permitida." }, { status: 403 }) } as const;
  if (json && !isJson(request)) return { response: Response.json({ error: "Pedido recusado." }, { status: 403 }) } as const;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified)
    return { response: Response.json({ error: "Entre novamente para continuar." }, { status: 401 }) } as const;
  return { actor: await actorForSession(session, { assisted: false }) } as const;
}
