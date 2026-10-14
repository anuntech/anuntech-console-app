import "server-only";
import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import { ImageError, readImageBytes, type ImageFailure } from "../images/normalize-image";
import { isStoredCatalogIcon } from "./catalog-icons";

/*
 * Uploaded and AI-generated catalog icons: private Vercel Blob files at
 * "catalog-icons/<itemId>/<uuid>.webp", one new file per change (never
 * overwritten), served by /api/catalogo/<itemId>/icone with access checks.
 * Bundled gallery icons are static files and never come through here.
 */

/** The upload limit, after the browser shrinks the picture to 512 px. */
export const MAX_ICON_UPLOAD_BYTES = 2 * 1024 * 1024;
/** A stored icon is a 256 px WebP of a few KB; anything bigger is not ours. */
const MAX_STORED_ICON_BYTES = 512 * 1024;

/** What failed in the shared image pipeline, worded for an icon. */
export const iconImageMessages: Record<ImageFailure, string> = {
  empty: "Escolha uma imagem para enviar.",
  too_large: "A imagem deve ter até 2 MB.",
  type: "Use uma imagem PNG, JPEG ou WebP.",
  corrupt: "O arquivo não é uma imagem válida.",
  dimensions: "Use uma imagem estática com até 16 megapixels e 8.192 pixels por lado.",
  unreadable: "Não foi possível ler esta imagem. Escolha outra.",
  output_too_large: "Não foi possível reduzir esta imagem.",
};

export async function storeCatalogIcon(itemId: string, webp: Buffer) {
  const pathname = `catalog-icons/${itemId}/${randomUUID()}.webp`;
  if (!isStoredCatalogIcon(pathname, itemId)) throw new Error("Invalid catalog item id");
  await put(pathname, webp, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "image/webp",
    // Each file name is used once, so its content never changes.
    cacheControlMaxAge: 60 * 60 * 24 * 365,
    abortSignal: AbortSignal.timeout(20000),
  });
  return pathname;
}

export async function readCatalogIcon(pathname: string) {
  if (!isStoredCatalogIcon(pathname)) return null;
  const result = await get(pathname, {
    access: "private",
    abortSignal: AbortSignal.timeout(10000),
  });
  if (result?.statusCode !== 200 || !result.stream) return null;
  if (
    result.blob.contentType !== "image/webp" ||
    (result.blob.size ?? 0) > MAX_STORED_ICON_BYTES
  ) {
    await result.stream.cancel();
    return null;
  }
  try {
    return await readImageBytes(result.stream, MAX_STORED_ICON_BYTES);
  } catch (error) {
    if (error instanceof ImageError) return null;
    throw error;
  }
}

export async function deleteCatalogIcon(pathname: string) {
  if (!isStoredCatalogIcon(pathname)) return;
  await del(pathname, {
    abortSignal: AbortSignal.timeout(10000),
  });
}
