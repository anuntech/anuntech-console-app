import "server-only";
import { getActor, type Actor } from "../access/access";
import { isJson, sameOrigin } from "../http/same-origin";
import { logDatabaseFault } from "../action-errors";
import { storageConfigured } from "./r2";
import type { UploadResult } from "./uploads";

const headers = { "Cache-Control": "private, no-store" };
export const respond = (data: unknown, status = 200) => Response.json(data, { status, headers });

/**
 * The shared door of the upload routes: the Console's own page, a JSON body,
 * a signed-in person and the storage configured. `run` gets the parsed body.
 */
export async function uploadRoute<T>(request: Request, run: (actor: Actor, body: unknown) => Promise<UploadResult<T>>) {
  if (!sameOrigin(request) || (request.method !== "DELETE" && !isJson(request)))
    return respond({ error: "O envio foi recusado. Recarregue a página e tente de novo." }, 403);
  if (!storageConfigured()) return respond({ error: "O envio de arquivos grandes ainda não está disponível." }, 503);
  const actor = await getActor();
  try {
    const body = request.method === "DELETE" ? null : await request.json().catch(() => null);
    const result = await run(actor, body);
    return result.ok ? respond(result.value) : respond({ error: result.error }, result.status);
  } catch (error) {
    if (!logDatabaseFault("arquivos", error)) console.error("[arquivos] route failed", error instanceof Error ? error.message : error);
    return respond({ error: "Não foi possível continuar o envio agora. Tente de novo." }, 500);
  }
}
