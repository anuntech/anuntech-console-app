import "server-only";
import { isJson, sameOrigin } from "../http/same-origin";
import { storageConfigured } from "./r2";
import { linkByToken, unlockCookieName, unlocked, type ShareLink } from "./share-links";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
export const respondPublic = (data: unknown, status = 200) => Response.json(data, { status, headers });

/**
 * The door of a request link's upload routes: the Console's own page, a JSON
 * body with the link's token, a link that works and is open in this browser.
 * No session: the token is the right, as the address was.
 */
export async function publicRoute<T>(
  request: Request,
  run: (link: ShareLink, body: Record<string, unknown>, ip: string) => Promise<{ ok: true; value: T } | { ok: false; error: string; status: number }>,
) {
  if (!sameOrigin(request) || !isJson(request)) return respondPublic({ error: "O envio foi recusado. Recarregue a página e tente de novo." }, 403);
  if (!storageConfigured()) return respondPublic({ error: "O envio de arquivos não está disponível agora." }, 503);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const link = typeof body.token === "string" ? await linkByToken(body.token) : null;
  if (!link || link.kind !== "request") return respondPublic({ error: "Link não encontrado." }, 404);
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${unlockCookieName(link)}=([^;]+)`))?.[1];
  if (!unlocked(link, cookie ? decodeURIComponent(cookie) : undefined)) return respondPublic({ error: "Digite a senha do link." }, 403);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    const result = await run(link, body, ip);
    return result.ok ? respondPublic(result.value) : respondPublic({ error: result.error }, result.status);
  } catch (error) {
    console.error("[arquivos] public upload failed", error instanceof Error ? error.message : error);
    return respondPublic({ error: "Não foi possível continuar o envio agora. Tente de novo." }, 500);
  }
}
