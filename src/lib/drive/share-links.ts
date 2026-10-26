import "server-only";
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, bookmarkFolders, bookmarks, fileUploads, shareLinks, user } from "@/db/schema";
import { db } from "../db";
import { actorForSession, type Actor } from "../access/access";
import { bookmarkFor } from "../bookmarks/bookmarks";
import { companyAllowed, loadFolder, manages } from "../bookmarks/bookmark-core";
import { descendantIds, folderPath } from "../bookmarks/folder-tree";
import { sendClientMail } from "../notifications/client-mail";
import { reserveHourly } from "../http/hourly-limit";
import {
  DEFAULT_COMPANY_QUOTA_BYTES,
  MAX_FILE_BYTES,
  PART_URL_BATCH,
  UPLOAD_TTL_HOURS,
  bytesLabel,
  cleanFileName,
  partCountFor,
  partLengthFor,
  partSizeFor,
  storageKeyFor,
  uploadRefusal,
} from "./drive-rules";
import { abortMultipart, completeMultipart, deleteObject, objectSize, partUrl, startMultipart } from "./r2";
import { SHARE_LIMITS, passwordRefusal, requestRefusal, shareState, type ShareKind } from "./share-rules";
import { spaceQuota, spaceUsage } from "./uploads";

/*
 * Links that work without an account (Arquivos, phase 3). The token lives
 * only in the address (the database keeps its SHA-256); a password is kept
 * with scrypt and, once typed, unlocks the link in that browser by a cookie
 * signed with the Console's secret. Every visitor action is limited per hour
 * and recorded in the audit log, under the person who made the link.
 */

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export type ShareLink = typeof shareLinks.$inferSelect;
type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Result<never> => ({ ok: false, error, status });

const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const hashSecret = hashToken;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await scrypt(password, salt, 32)).toString("hex")}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const given = await scrypt(password, Buffer.from(salt, "hex"), 32);
  const expected = Buffer.from(hash, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The cookie that keeps a password-protected link open in a browser: its end
 * is inside the signed value (a copied cookie stops too), and it changes if
 * the password does.
 */
export const UNLOCK_HOURS = 12;
export const unlockCookieName = (link: Pick<ShareLink, "id">) => `console-link-${link.id.slice(0, 8)}`;
const unlockSignature = (link: Pick<ShareLink, "id" | "passwordHash">, until: number) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`share:${link.id}:${link.passwordHash ?? ""}:${until}`).digest("base64url");
export const unlockValue = (link: Pick<ShareLink, "id" | "passwordHash">, now = Date.now()) => {
  const until = Math.floor(now / 1000) + UNLOCK_HOURS * 3600;
  return `${until}.${unlockSignature(link, until)}`;
};
export function unlocked(link: ShareLink, cookie: string | undefined, now = Date.now()) {
  if (!link.passwordHash) return true;
  const [until, signature] = (cookie ?? "").split(".");
  if (!/^\d+$/.test(until ?? "") || !signature || Number(until) * 1000 <= now) return false;
  const expected = Buffer.from(unlockSignature(link, Number(until)));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The link of an address. A link works only while whoever made it could still
 * make it: removed from the company, without the right to edit, or with the
 * account deleted, the link reads as turned off (and opens again if the right
 * comes back).
 */
export async function linkByToken(token: string) {
  if (!TOKEN.test(token)) return null;
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, hashToken(token)));
  if (!link) return null;
  if (link.revokedAt || (await creatorStillShares(link))) return link;
  return { ...link, revokedAt: new Date() };
}

async function creatorStillShares(link: ShareLink) {
  const [creator] = await db.select().from(user).where(eq(user.id, link.createdBy));
  if (!creator) return false;
  const actor = (await actorForSession({ user: creator } as Parameters<typeof actorForSession>[0], { assisted: false })) as Actor;
  return !!(await shareTarget(actor, link.kind, link.bookmarkId ?? "", link.folderId ?? ""));
}

/** The files a download link opens: the item, or the folder's and its subfolders', with the path below it. */
export async function linkFiles(link: ShareLink) {
  if (link.bookmarkId) {
    const rows = await db
      .select({ id: bookmarks.id, title: bookmarks.title, fileName: bookmarks.fileName, fileSize: bookmarks.fileSize })
      .from(bookmarks)
      .where(and(eq(bookmarks.id, link.bookmarkId), isNull(bookmarks.deletedAt)));
    return rows.filter((r) => r.fileName).map((r) => ({ ...r, path: "" }));
  }
  if (!link.folderId) return [];
  const tree = await db
    .select({ id: bookmarkFolders.id, parentId: bookmarkFolders.parentId, companyId: bookmarkFolders.companyId, name: bookmarkFolders.name })
    .from(bookmarkFolders)
    .where(link.companyId ? eq(bookmarkFolders.companyId, link.companyId) : isNull(bookmarkFolders.companyId));
  const ids = [link.folderId, ...descendantIds(tree, link.folderId)];
  const rows = await db
    .select({ id: bookmarks.id, title: bookmarks.title, fileName: bookmarks.fileName, fileSize: bookmarks.fileSize, folderId: bookmarks.folderId })
    .from(bookmarks)
    .where(and(inArray(bookmarks.folderId, ids), isNull(bookmarks.deletedAt), sql`${bookmarks.fileName} is not null`))
    .orderBy(bookmarks.title);
  const top = folderPath(tree, link.folderId).length;
  return rows.map(({ folderId, ...r }) => ({
    ...r,
    path: folderId === link.folderId ? "" : folderPath(tree, folderId!).slice(top).map((f) => f.name).join(" › "),
  }));
}

const createInput = z.object({
  kind: z.enum(["download", "request"]),
  bookmarkId: z.union([z.string().uuid(), z.literal("")]).default(""),
  folderId: z.union([z.string().uuid(), z.literal("")]).default(""),
  expiresInDays: z.union([z.literal(""), z.coerce.number().int().min(1).max(365)]).default(""),
  password: z.string().max(200).default(""),
  maxDownloads: z.union([z.literal(""), z.coerce.number().int().min(1, "Use pelo menos 1 download.").max(10_000)]).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Informe um e-mail válido.").max(200)]).default(""),
});

/** What a link points at, if the person may share it: an item they can edit, or a folder they manage. */
async function shareTarget(actor: Actor, kind: ShareKind, bookmarkId: string, folderId: string) {
  if (kind === "download" && bookmarkId) {
    const item = await bookmarkFor(actor, bookmarkId);
    if (!item?.editable || !item.fileName) return null;
    return { companyId: item.companyId, folderId: null, bookmarkId: item.id, title: item.title };
  }
  if (!folderId) return null;
  const folder = await loadFolder(folderId);
  // The owner of a folder in a company they left manages nothing there any more.
  if (!folder || !companyAllowed(actor, folder.companyId) || !manages(actor, folder)) return null;
  return { companyId: folder.companyId, folderId: folder.id, bookmarkId: null, title: folder.name };
}

export async function createShareLinkAs(actor: Actor, raw: unknown): Promise<{ error?: string; url?: string; success?: string }> {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const refused = passwordRefusal(input.password);
  if (refused) return { error: refused };
  const target = await shareTarget(actor, input.kind, input.bookmarkId, input.folderId);
  if (!target) return { error: "Você não pode compartilhar isso por link." };
  if (input.email && !(await reserveHourly("share-email", actor.user.id, SHARE_LIMITS.email)))
    return { error: "Muitos e-mails de link nesta hora. Copie o link e envie por outro canal." };
  const token = randomBytes(32).toString("base64url");
  const [link] = await db
    .insert(shareLinks)
    .values({
      kind: input.kind,
      tokenHash: hashToken(token),
      ...target,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      expiresAt: input.expiresInDays === "" ? null : new Date(Date.now() + input.expiresInDays * 86_400_000),
      maxDownloads: input.kind === "download" && input.maxDownloads !== "" ? input.maxDownloads : null,
      createdBy: actor.user.id,
    })
    .returning();
  const url = `${consoleUrl()}/${input.kind === "download" ? "compartilhado" : "enviar"}/${token}`;
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    companyId: link.companyId,
    action: "share_link.created",
    entityId: link.bookmarkId ?? link.folderId ?? link.id,
    details: { linkId: link.id, kind: link.kind, title: link.title, expiresAt: link.expiresAt?.toISOString() ?? null, password: !!link.passwordHash, maxDownloads: link.maxDownloads, email: input.email || null },
  });
  let mailed = "";
  if (input.email) {
    // A name or title that looks like an address stays out: the Console's e-mail never carries a link it did not make.
    const plain = (text: string) => (/https?:|www\.|[\w-]\.[a-z]{2,}(?:[\/:?#]|\b)/i.test(text) ? null : text);
    const who = plain(actor.user.name ?? "") || "Uma pessoa";
    const what = plain(link.title);
    const lines =
      input.kind === "download"
        ? [`${who} compartilhou com você ${what ? `“${what}”` : "arquivos"} pelo Console da Anuntech.`, `Para baixar: ${url}`]
        : [`${who} pediu que você envie arquivos${what ? ` para “${what}”` : ""} pelo Console da Anuntech.`, `Para enviar: ${url}`];
    if (link.expiresAt) lines.push(`O link vale até ${link.expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`);
    if (link.passwordHash) lines.push("Ele tem senha: peça a senha a quem enviou.");
    try {
      await sendClientMail({ to: input.email, subject: input.kind === "download" ? (what ? `Arquivos compartilhados: ${what}` : "Arquivos compartilhados com você") : what ? `Envie arquivos: ${what}` : "Pedido de arquivos", text: [...lines, "Equipe Anuntech"].join("\n\n"), tag: "share-link", key: link.id });
      mailed = ` O link foi por e-mail para ${input.email}.`;
    } catch {
      mailed = " O e-mail não saiu: copie o link e envie por outro canal.";
    }
  }
  return { url, success: `Link criado.${mailed}` };
}

export async function shareLinksFor(actor: Actor, raw: { bookmarkId?: string; folderId?: string }) {
  // Listing needs the same right as sharing: an item they edit, or a folder they manage.
  const target = await shareTarget(actor, "download", raw.bookmarkId ?? "", raw.folderId ?? "");
  if (!target) return null;
  const rows = await db
    .select({ link: shareLinks, by: user.name })
    .from(shareLinks)
    .leftJoin(user, eq(user.id, shareLinks.createdBy))
    .where(target.bookmarkId ? eq(shareLinks.bookmarkId, target.bookmarkId) : eq(shareLinks.folderId, target.folderId!))
    .orderBy(desc(shareLinks.createdAt))
    .limit(50);
  return rows.map(({ link, by }) => ({
    id: link.id,
    kind: link.kind,
    state: shareState(link),
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    password: !!link.passwordHash,
    maxDownloads: link.maxDownloads,
    downloads: link.downloads,
    uploads: link.uploads,
    by: by ?? null,
  }));
}

export async function revokeShareLinkAs(actor: Actor, linkId: string) {
  if (!z.string().uuid().safeParse(linkId).success) return { error: "Link não encontrado." };
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.id, linkId));
  if (!link) return { error: "Link não encontrado." };
  // The same people who could make it: who edits the item, who manages the folder, the team.
  const target = await shareTarget(actor, link.kind, link.bookmarkId ?? "", link.folderId ?? "");
  if (!target && !(actor.admin || link.createdBy === actor.user.id)) return { error: "Você não pode desligar este link." };
  await db.update(shareLinks).set({ revokedAt: new Date() }).where(and(eq(shareLinks.id, link.id), isNull(shareLinks.revokedAt)));
  await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: link.companyId, action: "share_link.revoked", entityId: link.bookmarkId ?? link.folderId ?? link.id, details: { linkId: link.id } });
  return { success: "Link desligado. Quem tiver o endereço não abre mais." };
}

/** One download through a link: counted only while the link still allows it; null when it no longer does. */
export async function countDownload(link: ShareLink, bookmarkId: string, ip: string) {
  if (!(await reserveHourly("share-download", `${link.id}:${ip}`, SHARE_LIMITS.download))) return "limit" as const;
  const [counted] = await db
    .update(shareLinks)
    .set({ downloads: sql`${shareLinks.downloads} + 1`, lastUsedAt: new Date() })
    .where(
      and(
        eq(shareLinks.id, link.id),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, new Date())),
        or(isNull(shareLinks.maxDownloads), sql`${shareLinks.downloads} < ${shareLinks.maxDownloads}`),
      ),
    )
    .returning({ id: shareLinks.id });
  if (!counted) return null;
  await db.insert(auditEvents).values({ actorId: link.createdBy, companyId: link.companyId, action: "share_link.downloaded", entityId: bookmarkId, details: { linkId: link.id, public: true } });
  return "ok" as const;
}

/* ---------- request links: files from someone without an account ---------- */

const REQUEST_CAP = DEFAULT_COMPANY_QUOTA_BYTES;

const visitorStart = z.object({
  fileName: z.string().trim().min(1).max(1000),
  size: z.number().int().positive("Selecione um arquivo com conteúdo.").max(MAX_FILE_BYTES, `Escolha um arquivo de até ${bytesLabel(MAX_FILE_BYTES)}.`),
  mime: z.string().max(200).default(""),
  senderName: z.string().trim().max(120).default(""),
});

export async function startVisitorUpload(link: ShareLink, raw: unknown, ip: string): Promise<Result<{ id: string; secret: string; partSize: number; partCount: number }>> {
  if (link.kind !== "request" || !link.folderId || shareState(link) !== "active") return fail("Este link não recebe mais arquivos.", 410);
  if (!(await reserveHourly("share-upload", `${link.id}:${ip}`, SHARE_LIMITS.upload))) return fail("Muitos envios nesta hora. Tente de novo mais tarde.", 429);
  const parsed = visitorStart.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const input = parsed.data;
  const blocked = requestRefusal(cleanFileName(input.fileName));
  if (blocked) return fail(blocked);
  // The company's space; Anuntech's own, with no quota, takes at most 5 GB through one link.
  const quota = await spaceQuota(link.companyId);
  const linkUsed = async (tx: Pick<typeof db, "select"> = db) =>
    Number((await tx.select({ n: sql<string>`coalesce(sum(${fileUploads.size}), 0)` }).from(fileUploads).where(and(eq(fileUploads.shareLinkId, link.id), inArray(fileUploads.status, ["uploading", "completed", "used"]))))[0].n);
  const full = quota === null ? `Este link recebe até ${bytesLabel(REQUEST_CAP)}. Fale com quem pediu.` : "O espaço de quem pediu acabou. Fale com quem enviou o link.";
  const refused = async (tx?: Pick<typeof db, "select">) =>
    uploadRefusal({ size: input.size, used: quota === null ? await linkUsed(tx) : await spaceUsage(link.companyId, tx), quota: quota ?? REQUEST_CAP });
  if (await refused()) return fail(full, 413);
  const id = crypto.randomUUID();
  const secret = randomBytes(24).toString("base64url");
  const key = storageKeyFor(link.companyId, id);
  const partSize = partSizeFor(input.size);
  const mime = input.mime || "application/octet-stream";
  let multipartId: string;
  try {
    multipartId = await startMultipart(key, mime);
  } catch {
    return fail("Não foi possível começar o envio agora. Tente de novo em alguns minutos.", 502);
  }
  // Checked again under the space's lock (the same one as the signed-in uploads), so uploads at once cannot all take the last gigabytes.
  const taken = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`arquivos:${link.companyId ?? "anuntech"}`}))`);
    if (await refused(tx)) return false;
    await tx.insert(fileUploads).values({
      id,
      actorId: link.createdBy,
      companyId: link.companyId,
      folderId: link.folderId,
      fileName: cleanFileName(input.fileName),
      mime,
      size: input.size,
      partSize,
      storageKey: key,
      multipartId,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_HOURS * 3600_000),
      shareLinkId: link.id,
      visitorSecretHash: hashSecret(secret),
      senderName: input.senderName || null,
    });
    return true;
  });
  if (!taken) {
    await abortMultipart(key, multipartId).catch(() => undefined);
    return fail(full, 413);
  }
  return { ok: true, value: { id, secret, partSize, partCount: partCountFor(input.size, partSize) } };
}

async function visitorUpload(link: ShareLink, uploadId: string, secret: unknown) {
  if (!z.string().uuid().safeParse(uploadId).success || typeof secret !== "string") return null;
  const [row] = await db.select().from(fileUploads).where(and(eq(fileUploads.id, uploadId), eq(fileUploads.shareLinkId, link.id)));
  if (!row?.visitorSecretHash) return null;
  const given = Buffer.from(hashSecret(secret));
  const stored = Buffer.from(row.visitorSecretHash);
  return given.length === stored.length && timingSafeEqual(given, stored) ? row : null;
}

export async function signVisitorParts(link: ShareLink, uploadId: string, raw: { secret?: unknown; parts?: unknown }): Promise<Result<{ partNumber: number; url: string }[]>> {
  if (shareState(link) !== "active") return fail("Este link não recebe mais arquivos.", 410);
  const row = await visitorUpload(link, uploadId, raw.secret);
  if (!row || row.status !== "uploading" || row.expiresAt <= new Date()) return fail("Não encontrado.", 404);
  const parsed = z.array(z.number().int().min(1).max(partCountFor(row.size, row.partSize))).min(1).max(PART_URL_BATCH).safeParse(raw.parts);
  if (!parsed.success) return fail("Partes inválidas.");
  return { ok: true, value: await Promise.all(parsed.data.map(async (partNumber) => ({ partNumber, url: await partUrl(row.storageKey, row.multipartId, partNumber, partLengthFor(row.size, row.partSize, partNumber)) }))) };
}

/** Every part sent: R2 joins them, the size is checked, and the file lands in the link's folder as an item. */
export async function finishVisitorUpload(link: ShareLink, uploadId: string, raw: { secret?: unknown; parts?: unknown }): Promise<Result<{ title: string }>> {
  if (shareState(link) !== "active") return fail("Este link não recebe mais arquivos.", 410);
  const row = await visitorUpload(link, uploadId, raw.secret);
  if (!row || row.status !== "uploading" || row.expiresAt <= new Date()) return fail("Não encontrado.", 404);
  const count = partCountFor(row.size, row.partSize);
  const parsed = z.array(z.object({ partNumber: z.number().int().min(1).max(count), etag: z.string().min(1).max(200) })).length(count, "O envio não terminou: faltam partes.").safeParse(raw.parts);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const parts = [...parsed.data].sort((a, b) => a.partNumber - b.partNumber);
  if (parts.some((p, i) => p.partNumber !== i + 1)) return fail("O envio não terminou: faltam partes.");
  try {
    await completeMultipart(row.storageKey, row.multipartId, parts);
    if ((await objectSize(row.storageKey)) !== row.size) {
      await deleteObject(row.storageKey).catch(() => undefined);
      await db.update(fileUploads).set({ status: "aborted" }).where(eq(fileUploads.id, row.id));
      return fail("O arquivo chegou com um tamanho diferente do informado. Envie de novo.");
    }
  } catch {
    // Whether R2 joined the parts or not, nothing stays behind.
    await abortMultipart(row.storageKey, row.multipartId).catch(() => undefined);
    await deleteObject(row.storageKey).catch(() => undefined);
    await db.update(fileUploads).set({ status: "aborted" }).where(eq(fileUploads.id, row.id));
    return fail("Não foi possível concluir o envio agora. Envie de novo.", 502);
  }
  const title = (row.fileName.replace(/\.[^.]+$/, "") || row.fileName).slice(0, 160);
  const item = await db.transaction(async (tx) => {
    const [taken] = await tx.update(fileUploads).set({ status: "used" }).where(and(eq(fileUploads.id, row.id), eq(fileUploads.status, "uploading"))).returning({ id: fileUploads.id });
    if (!taken) return null;
    const [created] = await tx
      .insert(bookmarks)
      .values({ ownerId: link.createdBy, companyId: link.companyId, folderId: link.folderId, title, fileName: row.fileName, storageKey: row.storageKey, fileSize: row.size, mime: row.mime })
      .returning({ id: bookmarks.id });
    await tx.update(shareLinks).set({ uploads: sql`${shareLinks.uploads} + 1`, lastUsedAt: new Date() }).where(eq(shareLinks.id, link.id));
    await tx.insert(auditEvents).values({ actorId: link.createdBy, companyId: link.companyId, action: "bookmark.received", entityId: created.id, details: { linkId: link.id, title, sender: row.senderName, public: true } });
    return created;
  });
  if (!item) return fail("Este arquivo já foi recebido.");
  return { ok: true, value: { title } };
}

/** Who made the link, for the public pages ("Kauan pediu estes arquivos"). */
export async function linkOwner(link: ShareLink) {
  const [owner] = await db.select({ name: user.name }).from(user).where(eq(user.id, link.createdBy));
  return owner?.name || "A equipe";
}
