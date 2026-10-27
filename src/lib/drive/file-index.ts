import "server-only";
import { after } from "next/server";
import { eq, sql } from "drizzle-orm";
import { bookmarks, fileTexts } from "@/db/schema";
import { db } from "../db";
import { getObject, storageConfigured } from "./r2";
import { extractFileText, type Extracted } from "./text-extract";
import { tagFile } from "./file-tags";
import { TEXT_SOURCE_MAX_BYTES, textKindOf } from "./text-rules";

/*
 * Arquivos' content search (phase 4): the text of each file, read once after
 * it is saved (and again when a new version replaces it), by `indexSoon`
 * right after the request and by the routine every 15 minutes for whatever
 * is left (older files, a failed read). Only Console code reads the files;
 * the text stays in the database, next to who may see the item.
 */

const MAX_ATTEMPTS = 3;
/** The file a row was read from: the R2 key, or the item itself for an older file kept in the database. */
const sourceOf = sql<string>`coalesce(${bookmarks.storageKey}, 'db:' || ${bookmarks.id})`;


async function save(bookmarkId: string, source: string, outcome: Extracted | { status: "failed"; reason: string }) {
  const values = {
    bookmarkId,
    sourceKey: source,
    status: outcome.status,
    text: outcome.status === "done" ? outcome.text : null,
    reason: outcome.status === "done" ? null : outcome.reason,
    attempts: outcome.status === "failed" ? 1 : 0,
    extractedAt: new Date(),
  };
  await db
    .insert(fileTexts)
    .values(values)
    .onConflictDoUpdate({
      target: fileTexts.bookmarkId,
      set: {
        ...values,
        // A failure on the same file counts; a new file starts over.
        attempts: outcome.status === "failed" ? sql`case when ${fileTexts.sourceKey} = ${source} then ${fileTexts.attempts} + 1 else 1 end` : 0,
      },
    });
}

type Pending = { id: string; title: string; file_name: string; storage_key: string | null; size: number | null; source: string };

/** The files still without text (the newest first), or only `bookmarkId` if it is one of them. */
async function pendingFiles(limit: number, bookmarkId?: string) {
  const result = await db.execute<Pending>(sql`
    select ${bookmarks.id} as id, ${bookmarks.title} as title, ${bookmarks.fileName} as file_name, ${bookmarks.storageKey} as storage_key,
      coalesce(${bookmarks.fileSize}, octet_length(${bookmarks.content}))::float8 as size, ${sourceOf} as source
    from ${bookmarks}
    left join ${fileTexts} on ${fileTexts.bookmarkId} = ${bookmarks.id}
    where ${bookmarks.deletedAt} is null and ${bookmarks.fileName} is not null
      and (${bookmarks.storageKey} is not null or ${bookmarks.content} is not null)
      ${bookmarkId ? sql`and ${bookmarks.id} = ${bookmarkId}` : sql``}
      and (${fileTexts.bookmarkId} is null or ${fileTexts.sourceKey} <> ${sourceOf}
        or (${fileTexts.status} = 'failed' and ${fileTexts.attempts} < ${MAX_ATTEMPTS} and ${fileTexts.extractedAt} < now() - interval '30 minutes'))
    order by ${bookmarks.updatedAt} desc
    limit ${limit}`);
  return result.rows;
}

async function extract(file: Pending): Promise<Extracted | { status: "failed"; reason: string }> {
  if (!textKindOf(file.file_name)) return { status: "skipped", reason: "Tipo de arquivo sem texto para a busca." };
  if ((file.size ?? 0) > TEXT_SOURCE_MAX_BYTES) return { status: "skipped", reason: "Arquivo grande demais para ler o texto." };
  try {
    const bytes = file.storage_key
      ? storageConfigured()
        ? await getObject(file.storage_key)
        : null
      : ((await db.select({ content: bookmarks.content }).from(bookmarks).where(eq(bookmarks.id, file.id)))[0]?.content ?? null);
    if (!bytes) return { status: "failed", reason: "Arquivo não encontrado no armazenamento." };
    return await extractFileText(new Uint8Array(bytes), file.file_name);
  } catch (error) {
    // Never the text or the file in the log: only which item and why.
    console.error("[arquivos] text failed", file.id, error instanceof Error ? error.message.slice(0, 200) : "erro");
    return { status: "failed", reason: "Não foi possível ler o texto deste arquivo." };
  }
}

/** Reads one file, keeps its text and suggests its tag (lib/drive/file-tags.ts), now that the text is known. */
async function readOne(file: Pending) {
  const outcome = await extract(file);
  await save(file.id, file.source, outcome);
  if (outcome.status !== "failed") await tagFile({ id: file.id, title: file.title, fileName: file.file_name }, outcome.status === "done" ? outcome.text : null);
}

/** Reads the files still without text (the newest first) until `limit` or the time runs out; returns how many were read. */
export async function indexPendingFiles({ limit = 20, budgetMs = 60_000 } = {}) {
  const started = Date.now();
  let read = 0;
  for (const file of await pendingFiles(limit)) {
    if (Date.now() - started > budgetMs) break;
    read++;
    await readOne(file);
  }
  return read;
}

/**
 * The text of one file, read now if it was not yet (the assistant asking
 * about a file just saved). The caller checked that the person sees it.
 */
export async function fileTextOf(bookmarkId: string) {
  const [file] = await pendingFiles(1, bookmarkId);
  if (file) await readOne(file);
  const [row] = await db.select({ status: fileTexts.status, text: fileTexts.text, reason: fileTexts.reason }).from(fileTexts).where(eq(fileTexts.bookmarkId, bookmarkId));
  return row ?? null;
}

/** After the response: the file just saved gets its text in seconds, without making the person wait. */
export function indexSoon() {
  after(() => indexPendingFiles({ limit: 10, budgetMs: 45_000 }).catch((error) => console.error("[arquivos] index failed", error instanceof Error ? error.message : error)));
}
