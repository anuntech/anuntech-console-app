import { createHash } from "node:crypto";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { bookmarks } from "@/db/schema";
import { db } from "@/lib/db";
import { objectSize, putObject } from "@/lib/drive/r2";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * One-shot: the files saved before Arquivos (up to 1 MB, in the database)
 * move to R2. Each one is sent, its size checked in R2, and only then the
 * bookmark points at the object and its bytes leave the database. Safe to
 * call again: it takes only what still has bytes and no key. Removed in the
 * next deploy.
 */
const TOKEN_SHA256 = "32d32c199d7a1c20eb23f2bee113488fc8a12652e876bbf8bd51589d80d00359";

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  const pending = await db
    .select({ id: bookmarks.id, companyId: bookmarks.companyId, content: bookmarks.content })
    .from(bookmarks)
    .where(and(isNotNull(bookmarks.content), isNull(bookmarks.storageKey)))
    .limit(200);
  let moved = 0;
  const failed: string[] = [];
  for (const row of pending) {
    const bytes = new Uint8Array(row.content!);
    // The bookmark's own id: an earlier file never had an upload.
    const key = `${row.companyId ?? "anuntech"}/${row.id}`;
    try {
      await putObject(key, bytes);
      if ((await objectSize(key)) !== bytes.length) throw new Error("size");
      const [updated] = await db
        .update(bookmarks)
        .set({ storageKey: key, fileSize: bytes.length, content: null })
        .where(and(eq(bookmarks.id, row.id), isNull(bookmarks.storageKey)))
        .returning({ id: bookmarks.id });
      if (updated) moved++;
    } catch {
      failed.push(row.id);
    }
  }
  const [{ left }] = await db
    .select({ left: db.$count(bookmarks, and(isNotNull(bookmarks.content), isNull(bookmarks.storageKey))) })
    .from(bookmarks)
    .limit(1);
  return Response.json({ ok: failed.length === 0, found: pending.length, moved, failed, left });
}
