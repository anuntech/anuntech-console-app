import "server-only";
import { and, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { auditEvents, bookmarks } from "@/db/schema";
import { db } from "../db";
import type { Actor } from "../access/access";
import { foldersFor, scopeOf } from "../bookmarks/bookmarks";
import { descendantIds, folderPath } from "../bookmarks/folder-tree";
import type { ZipEntry } from "./zip-rules";

/**
 * What a signed-in person downloads as a folder's .zip: the files of the
 * folder and of the subfolders they see (a gate they do not pass, or a
 * folder not shared with them, stays out with what is inside), with the
 * path below the folder. Null when they do not see the folder.
 */
export async function folderZipFor(actor: Actor, folderId: string): Promise<{ name: string; companyId: string | null; entries: ZipEntry[] } | null> {
  const visible = await foldersFor(scopeOf(actor), "all");
  const folder = visible.find((f) => f.id === folderId);
  if (!folder) return null;
  const tree = visible.map((f) => ({ id: f.id, parentId: f.parentId ?? null, companyId: f.companyId, name: f.name }));
  const ids = [folder.id, ...descendantIds(tree, folder.id)];
  const rows = await db
    .select({
      id: bookmarks.id,
      fileName: bookmarks.fileName,
      folderId: bookmarks.folderId,
      size: sql<number>`coalesce(${bookmarks.fileSize}, octet_length(${bookmarks.content}), 0)::float8`,
    })
    .from(bookmarks)
    .where(and(inArray(bookmarks.folderId, ids), isNull(bookmarks.deletedAt), isNotNull(bookmarks.fileName)))
    .orderBy(bookmarks.title);
  const top = folderPath(tree, folder.id).length;
  return {
    name: folder.name,
    companyId: folder.companyId,
    entries: rows.map((r) => ({
      id: r.id,
      fileName: r.fileName!,
      size: r.size,
      path: r.folderId === folder.id ? "" : folderPath(tree, r.folderId!).slice(top).map((f) => f.name).join(" › "),
    })),
  };
}

export async function auditZip(actorId: string, companyId: string | null, folderId: string, files: number, extra?: Record<string, unknown>) {
  await db.insert(auditEvents).values({ actorId, companyId, action: "bookmark_folder.downloaded", entityId: folderId, details: { files, ...extra } });
}
