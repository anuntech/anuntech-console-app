import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auditEvents, user } from "@/db/schema";
import { db } from "../db";
import type { Actor } from "../access/access";
import { bookmarkFor } from "../bookmarks/bookmarks";

/*
 * A file's activity (Arquivos): who added it, changed it, sent a new
 * version, shared it by link, downloaded it, and what came through a link,
 * from the audit log, newest first. Only for who may edit the item: who
 * downloaded what is not for every reader of the folder.
 */

const LABELS: Record<string, string> = {
  "bookmark.created": "Adicionou",
  "bookmark.received": "Enviado pelo pedido de arquivos",
  "bookmark.filed": "Guardado pelo Console",
  "bookmark.updated": "Editou",
  "bookmark.board_edited": "Desenhou na lousa",
  "bookmark.version_added": "Enviou uma nova versão",
  "bookmark.version_restored": "Restaurou uma versão",
  "bookmark.downloaded": "Baixou",
  "bookmark.trashed": "Moveu para a lixeira",
  "bookmark.restored": "Restaurou da lixeira",
  "share_link.created": "Criou um link externo",
  "share_link.revoked": "Desligou um link externo",
  "share_link.downloaded": "Baixado pelo link externo",
};
const ACTIONS = Object.keys(LABELS);

export type ActivityRow = { id: string; what: string; who: string | null; at: string; note?: string };

/** One download by a signed-in person, for the activity (a failure here never stops the download). */
export async function recordDownload(actor: Actor, item: { id: string; companyId: string | null }, details?: Record<string, unknown>) {
  await db
    .insert(auditEvents)
    .values({ actorId: actor.user.id, companyId: item.companyId, action: "bookmark.downloaded", entityId: item.id, details: details ?? null })
    .catch(() => undefined);
}

export async function bookmarkActivity(actor: Actor, bookmarkId: string): Promise<ActivityRow[] | null> {
  const item = await bookmarkFor(actor, bookmarkId);
  if (!item?.editable) return null;
  const rows = await db
    .select({ id: auditEvents.id, action: auditEvents.action, at: auditEvents.createdAt, details: auditEvents.details, who: user.name })
    .from(auditEvents)
    .leftJoin(user, eq(user.id, auditEvents.actorId))
    .where(and(eq(auditEvents.entityId, item.id), inArray(auditEvents.action, ACTIONS)))
    .orderBy(desc(auditEvents.createdAt))
    .limit(50);
  return rows.map((row) => {
    const details = (row.details ?? {}) as { sender?: string; version?: number; public?: boolean };
    // What came through a link was done by someone without an account; the link's maker is not "who".
    const visitor = details.public === true;
    return {
      id: String(row.id),
      what: LABELS[row.action],
      who: visitor ? (details.sender ? `${details.sender}, sem conta` : "Alguém sem conta") : (row.who ?? null),
      at: row.at.toISOString(),
      ...(details.version ? { note: `versão ${details.version}` } : {}),
    };
  });
}
