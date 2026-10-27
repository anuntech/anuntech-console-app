import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { bookmarks, fileTexts } from "@/db/schema";
import { db } from "../db";
import { downloadUrl, storageConfigured } from "./r2";

/*
 * Where a file's card picture is read (Arquivos): a five-minute address to
 * the small WebP in R2 (lib/drive/thumbnails.ts makes it), only for the file
 * as it is now (a new version waits for its own). The web's
 * /api/bookmarks/<id>/miniatura redirects to it; the app's bookmarks.list
 * gets it beside each item, so the phone never sends its session to R2.
 * Callers check that the person sees the item first.
 */

export const thumbKeyOf = (storageKey: string) => `thumbs/${storageKey}.webp`;

const signed = (storageKey: string) => downloadUrl(thumbKeyOf(storageKey), "miniatura.webp", true, "image/webp");

/** The picture's address for each of these items that has one ready, by id. */
export async function thumbnailAddresses(bookmarkIds: string[]): Promise<Map<string, string>> {
  if (!bookmarkIds.length || !storageConfigured()) return new Map();
  const rows = await db
    .select({ id: bookmarks.id, key: bookmarks.storageKey, thumb: fileTexts.thumbStatus, source: fileTexts.sourceKey })
    .from(bookmarks)
    .innerJoin(fileTexts, eq(fileTexts.bookmarkId, bookmarks.id))
    .where(and(inArray(bookmarks.id, bookmarkIds), eq(fileTexts.thumbStatus, "done")));
  const ready = rows.filter((row): row is typeof row & { key: string } => !!row.key && row.source === row.key);
  return new Map(await Promise.all(ready.map(async (row) => [row.id, await signed(row.key)] as const)));
}

/** One item's picture address, or null when it has none ready. */
export async function thumbnailAddress(bookmarkId: string) {
  return (await thumbnailAddresses([bookmarkId])).get(bookmarkId) ?? null;
}
