import { eq } from "drizzle-orm";
import { catalogItems } from "@/db/schema";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/http/same-origin";
import { catalogIconEditor } from "@/lib/catalog/catalog-icon-access";
import {
  IconAiError,
  MAX_ICON_HINT,
  generateCatalogIcons,
  iconAiEnabled,
  reserveIconGeneration,
} from "@/lib/catalog/icon-ai";
import { ICON_DEADLINE_MS } from "@/lib/catalog/icon-rules";

/*
 * "Gerar com IA" in the catalog editor: four icon options for one item, as
 * data URLs for the dialog. Nothing is stored here; the option the team picks
 * goes back through POST /api/catalogo/<id>/icone. Staff only, throttled per
 * person, and the prompt comes from the item's saved name and description.
 */
export const runtime = "nodejs";
export const maxDuration = 90;

const respond = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generic = "Não foi possível gerar agora. Tente de novo ou envie uma imagem.";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return respond({ error: "O pedido foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await catalogIconEditor();
  const { id } = await params;
  if (!actor || !uuid.test(id)) return respond({ error: "Item não encontrado." }, 404);
  if (!iconAiEnabled())
    return respond({ error: "A geração de ícones está desligada. Envie uma imagem ou escolha um ícone da galeria." }, 503);
  const [item] = await db
    .select({ name: catalogItems.name, description: catalogItems.description })
    .from(catalogItems)
    .where(eq(catalogItems.id, id));
  if (!item) return respond({ error: "Item não encontrado." }, 404);

  const body = (await request.json().catch(() => null)) as { hint?: unknown } | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return respond({ error: "Pedido inválido." }, 400);
  if (body.hint !== undefined && body.hint !== null && typeof body.hint !== "string")
    return respond({ error: "A descrição do ícone veio num formato inválido." }, 400);
  const hint = typeof body.hint === "string" ? body.hint.trim() : "";
  if (hint.length > MAX_ICON_HINT)
    return respond({ error: `A descrição do ícone pode ter até ${MAX_ICON_HINT} caracteres.` }, 400);

  const reserved = await reserveIconGeneration(actor.user.id).catch((error: unknown) => {
    console.error("[icon-ai] throttle failed", error instanceof Error ? error.message : "unknown");
    return null;
  });
  if (reserved === null) return respond({ error: generic }, 503);
  if (!reserved)
    return respond({ error: "Você gerou muitos ícones na última hora. Envie uma imagem ou tente mais tarde." }, 429);

  const deadline = AbortSignal.timeout(ICON_DEADLINE_MS);
  try {
    const images = await generateCatalogIcons(
      { name: item.name, description: item.description, hint },
      AbortSignal.any([request.signal, deadline]),
    );
    return respond({ options: images.map((image) => `data:image/webp;base64,${image.toString("base64")}`) });
  } catch (error) {
    if (error instanceof IconAiError && error.status === 499 && deadline.aborted && !request.signal.aborted)
      return respond({ error: "A geração demorou demais. Tente de novo ou envie uma imagem." }, 504);
    if (error instanceof IconAiError) return respond({ error: error.message || generic }, error.status);
    console.error("[icon-ai] failed", error instanceof Error ? error.name : "unknown");
    return respond({ error: generic }, 502);
  }
}
