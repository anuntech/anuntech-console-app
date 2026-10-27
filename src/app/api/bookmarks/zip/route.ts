import { and, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { bookmarks } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { db } from "@/lib/db";
import { recordDownload } from "@/lib/drive/activity";
import { zipResponse } from "@/lib/drive/zip-stream";
import { zipRefusal } from "@/lib/drive/zip-rules";

export const runtime = "nodejs";
export const maxDuration = 800;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The files of the list's selection (`?id=…&id=…`, up to 200) as one .zip; each one by the same check as its download. */
export async function GET(request: Request) {
  const actor = await getActor();
  const ids = [...new Set(new URL(request.url).searchParams.getAll("id"))].filter((id) => UUID.test(id)).slice(0, 200);
  const seen = (await Promise.all(ids.map((id) => bookmarkFor(actor, id)))).filter((item) => !!item?.fileName);
  if (!seen.length) return new Response("Nenhum dos itens escolhidos é um arquivo que você pode baixar.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const sizes = await db
    .select({ id: bookmarks.id, size: sql<number>`coalesce(${bookmarks.fileSize}, octet_length(${bookmarks.content}), 0)::float8` })
    .from(bookmarks)
    .where(and(inArray(bookmarks.id, seen.map((item) => item!.id)), isNull(bookmarks.deletedAt), isNotNull(bookmarks.fileName)));
  const sizeOf = new Map(sizes.map((s) => [s.id, s.size]));
  const entries = seen.map((item) => ({ id: item!.id, fileName: item!.fileName!, size: sizeOf.get(item!.id) ?? 0, path: "" }));
  const refusal = zipRefusal(entries);
  if (refusal) return new Response(refusal.replace("A pasta", "A seleção"), { status: 413, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  for (const item of seen) await recordDownload(actor, item!, { zip: true });
  return zipResponse("Arquivos", entries);
}
