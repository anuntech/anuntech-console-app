import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditEvents, catalogItems } from "@/db/schema";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/http/same-origin";
import { ImageError, normalizeImage, readImageBytes } from "@/lib/images/normalize-image";
import { catalogIconAccess, catalogIconEditor } from "@/lib/catalog/catalog-icon-access";
import {
  MAX_ICON_UPLOAD_BYTES,
  deleteCatalogIcon,
  iconImageMessages,
  readCatalogIcon,
  storeCatalogIcon,
} from "@/lib/catalog/catalog-icon-store";
import { catalogIconSrc, isGalleryIcon, isStoredCatalogIcon } from "@/lib/catalog/catalog-icons";

/*
 * A catalog item's icon. GET serves an uploaded or generated icon to whoever
 * sees a product or service made from the item; the URL carries the file's
 * uuid (?v=), so it is cached for good and changes with the icon. The team
 * changes it: POST takes an image (an upload, or the AI option picked in the
 * editor), PATCH picks a bundled gallery icon, DELETE leaves the item without one.
 * Route handlers rather than Server Actions: they answer while the edit form
 * stays open, and the file never passes through the form.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };
type Source = "upload" | "ai" | "gallery" | "removed";

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: privateHeaders });
const missing = () => fail("Item não encontrado.", 404);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class MissingItem extends Error {}

/** Swaps the icon under a row lock and records who did it; returns the one it replaced. */
async function replaceIcon(actorId: string, itemId: string, icon: string | null, source: Source) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ icon: catalogItems.icon })
      .from(catalogItems)
      .where(eq(catalogItems.id, itemId))
      .for("update");
    if (!current) throw new MissingItem();
    await tx.update(catalogItems).set({ icon, updatedAt: new Date() }).where(eq(catalogItems.id, itemId));
    await tx.insert(auditEvents).values({
      actorId,
      action: "catalog.icon_changed",
      entityId: itemId,
      details: { source },
    });
    return current.icon;
  });
}

async function cleanup(icon: string | null, itemId: string) {
  if (!isStoredCatalogIcon(icon, itemId)) return;
  try {
    await deleteCatalogIcon(icon);
  } catch {
    // Storage cleanup must never roll back the item's committed icon.
    console.warn("catalog_icon_cleanup_failed");
  }
}

function refresh() {
  revalidatePath("/produtos");
  revalidatePath("/configuracoes/catalogo");
  revalidatePath("/painel");
}

const saved = (itemId: string, icon: string | null) =>
  Response.json({ icon, src: catalogIconSrc(itemId, icon) }, { headers: privateHeaders });

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const version = new URL(request.url).searchParams.get("v") ?? "";
  if (!uuid.test(id) || !uuid.test(version)) return new Response(null, { status: 404 });
  const access = await catalogIconAccess(id);
  if (access === "signed-out") return new Response(null, { status: 401 });
  if (access === "denied") return new Response(null, { status: 404 });
  const [item] = await db.select({ icon: catalogItems.icon }).from(catalogItems).where(eq(catalogItems.id, id));
  // Only the current file: an old ?v= must not cache the new icon under its URL.
  if (!item || !isStoredCatalogIcon(item.icon, id) || item.icon !== `catalog-icons/${id}/${version}.webp`)
    return new Response(null, { status: 404 });
  try {
    const bytes = await readCatalogIcon(item.icon);
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=31536000, immutable",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return fail("A alteração foi recusada. Recarregue a página e tente de novo.", 403);
  const actor = await catalogIconEditor();
  const { id } = await params;
  if (!actor || !uuid.test(id)) return missing();
  if (Number(request.headers.get("content-length") || 0) > MAX_ICON_UPLOAD_BYTES)
    return fail(iconImageMessages.too_large, 413);
  const [item] = await db.select({ id: catalogItems.id }).from(catalogItems).where(eq(catalogItems.id, id));
  if (!item) return missing();
  // An option picked in "Gerar com IA" comes back as bytes, through this same path.
  const source: Source = request.headers.get("x-icon-source") === "ai" ? "ai" : "upload";
  let uploaded: string | null = null;
  let committed = false;
  try {
    const bytes = await readImageBytes(request.body, MAX_ICON_UPLOAD_BYTES);
    const icon = await normalizeImage(bytes, request.headers.get("content-type") || "", {
      size: 256,
      fit: "contain",
      quality: 82,
      background: "#ffffff",
    });
    uploaded = await storeCatalogIcon(id, icon);
    const previous = await replaceIcon(actor.user.id, id, uploaded, source);
    committed = true;
    await cleanup(previous, id);
    refresh();
    return saved(id, uploaded);
  } catch (error) {
    if (uploaded && !committed) await cleanup(uploaded, id);
    if (error instanceof ImageError) return fail(iconImageMessages[error.reason], error.status);
    if (error instanceof MissingItem) return missing();
    return fail("Não foi possível salvar o ícone. Tente de novo.", 503);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return fail("A alteração foi recusada. Recarregue a página e tente de novo.", 403);
  const actor = await catalogIconEditor();
  const { id } = await params;
  if (!actor || !uuid.test(id)) return missing();
  let payload: { icon?: unknown } | null = null;
  try {
    payload = JSON.parse((await readImageBytes(request.body, 4096)).toString("utf8"));
  } catch {
    payload = null;
  }
  // Only the bundled gallery: never an arbitrary URL or someone else's file.
  if (!isGalleryIcon(payload?.icon)) return fail("Escolha um ícone da galeria.", 400);
  try {
    const previous = await replaceIcon(actor.user.id, id, payload.icon, "gallery");
    await cleanup(previous, id);
    refresh();
    return saved(id, payload.icon);
  } catch (error) {
    if (error instanceof MissingItem) return missing();
    return fail("Não foi possível salvar o ícone. Tente de novo.", 503);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return fail("A alteração foi recusada. Recarregue a página e tente de novo.", 403);
  const actor = await catalogIconEditor();
  const { id } = await params;
  if (!actor || !uuid.test(id)) return missing();
  try {
    const previous = await replaceIcon(actor.user.id, id, null, "removed");
    await cleanup(previous, id);
    refresh();
    return saved(id, null);
  } catch (error) {
    if (error instanceof MissingItem) return missing();
    return fail("Não foi possível remover o ícone. Tente de novo.", 503);
  }
}
