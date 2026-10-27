import "server-only";
import { inArray } from "drizzle-orm";
import { Zip, ZipPassThrough } from "fflate";
import { bookmarks } from "@/db/schema";
import { db } from "../db";
import { objectStream, storageConfigured } from "./r2";
import { zipFileName, zipNames, type ZipEntry } from "./zip-rules";

/*
 * A folder's .zip, built while it is sent (Arquivos): each file is read from
 * R2 only when the browser asks for more, so a slow connection slows the
 * reading too and nothing piles up in memory. No compression (zip-rules.ts).
 */

type Source = ReadableStream<Uint8Array> | Uint8Array;

async function sourceOf(entry: ZipEntry, keys: Map<string, string | null>): Promise<Source | null> {
  const key = keys.get(entry.id);
  if (key) return storageConfigured() ? objectStream(key) : null;
  // A file from before R2, kept in the database.
  const [row] = await db.select({ content: bookmarks.content }).from(bookmarks).where(inArray(bookmarks.id, [entry.id]));
  return row?.content ? new Uint8Array(row.content) : null;
}

function zipStream(entries: ZipEntry[], keys: Map<string, string | null>): ReadableStream<Uint8Array> {
  const named = zipNames(entries);
  const queue: Uint8Array[] = [];
  let finished = false;
  let failure: Error | null = null;
  const zip = new Zip((error, chunk, final) => {
    if (error) failure = error;
    else {
      queue.push(chunk);
      if (final) finished = true;
    }
  });
  let next = 0;
  let ended = false;
  let current: { file: ZipPassThrough; reader: ReadableStreamDefaultReader<Uint8Array> } | null = null;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (!queue.length && !finished) {
          if (failure) throw failure;
          if (current) {
            const { value, done } = await current.reader.read();
            if (done) {
              current.file.push(new Uint8Array(0), true);
              current = null;
            } else current.file.push(value);
            continue;
          }
          if (next >= named.length) {
            if (!ended) {
              ended = true;
              zip.end();
            }
            continue;
          }
          const entry = named[next++];
          // A file gone from storage since the list was read is left out, not written empty.
          const source = await sourceOf(entry, keys);
          if (!source) continue;
          const file = new ZipPassThrough(entry.zipPath);
          zip.add(file);
          if (source instanceof Uint8Array) file.push(source, true);
          else current = { file, reader: source.getReader() };
        }
        while (queue.length) controller.enqueue(queue.shift()!);
        if (finished) controller.close();
      } catch (error) {
        console.error("[arquivos] zip failed", error instanceof Error ? error.message : "erro");
        controller.error(error);
      }
    },
    async cancel() {
      await current?.reader.cancel().catch(() => undefined);
    },
  });
}

/** The response that downloads `entries` as `<folder>.zip`. */
export async function zipResponse(folderName: string, entries: ZipEntry[]) {
  const keys = new Map(
    (await db.select({ id: bookmarks.id, key: bookmarks.storageKey }).from(bookmarks).where(inArray(bookmarks.id, entries.map((e) => e.id)))).map((r) => [r.id, r.key]),
  );
  return new Response(zipStream(entries, keys), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName(folderName))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
