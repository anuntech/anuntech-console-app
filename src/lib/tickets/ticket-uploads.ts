import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { ticketUploads } from "@/db/schema";
import { db } from "../db";
import { safeFileName } from "../bookmarks/bookmark-validation";
import { normalizeTicketFile } from "./ticket-files";

/*
 * A file sent ahead of the form that uses it (a ticket, a reply, a task, a
 * comment): staged in parts, checked and optimized when the last part
 * arrives, then taken by takeTicketUploads with its id. The web's
 * /api/chamados/uploads and the app's /api/v1/anexos both store here.
 */

/** Uploads not used within an hour are dropped. */
const LIFETIME_MS = 60 * 60 * 1000;
/** Files staged and not yet used, per person. */
const MAX_PENDING = 10;

/** A refusal whose message is meant for the person. */
export class UploadError extends Error {}

/** Starts an upload of `size` bytes; the parts come with appendTicketUpload. */
export async function stageTicketUpload(authorId: string, input: { name: string; size: number }) {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${authorId}))`);
    await tx.delete(ticketUploads).where(lt(ticketUploads.expiresAt, new Date()));
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(ticketUploads)
      .where(eq(ticketUploads.authorId, authorId));
    if (n >= MAX_PENDING) throw new UploadError("Há muitos envios pendentes. Tente novamente mais tarde.");
    await tx.insert(ticketUploads).values({
      id,
      authorId,
      name: safeFileName(input.name),
      expectedSize: input.size,
      content: Buffer.alloc(0),
      expiresAt: new Date(Date.now() + LIFETIME_MS),
    });
  });
  return id;
}

/**
 * Adds the part that starts at `offset`. With the last part the file is
 * checked (PDF, PNG, JPEG or WebP by its bytes) and pictures become WebP.
 */
export async function appendTicketUpload(authorId: string, input: { id: string; offset: number; part: Buffer }) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(ticketUploads)
      .where(and(eq(ticketUploads.id, input.id), eq(ticketUploads.authorId, authorId)))
      .for("update");
    if (
      !row ||
      row.ready ||
      row.expiresAt < new Date() ||
      row.receivedSize !== input.offset ||
      input.offset + input.part.length > row.expectedSize
    )
      throw new UploadError("Envio expirado ou incompleto. Tente novamente.");
    const content = Buffer.concat([row.content, input.part]),
      ready = content.length === row.expectedSize;
    const file = ready ? await normalizeTicketFile(content, row.name) : null;
    await tx
      .update(ticketUploads)
      .set({
        content: file?.content || content,
        receivedSize: input.offset + input.part.length,
        ready,
        mime: file?.mime,
        name: file?.name || row.name,
      })
      .where(eq(ticketUploads.id, input.id));
    return {
      received: input.offset + input.part.length,
      file: file ? { name: file.name, size: file.size, mime: file.mime } : null,
    };
  });
}

/** Drops one of the person's own uploads (a file removed before sending). */
export async function discardTicketUpload(authorId: string, id: string) {
  await db.delete(ticketUploads).where(and(eq(ticketUploads.id, id), eq(ticketUploads.authorId, authorId)));
}
