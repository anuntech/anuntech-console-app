import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { attachments, auditEvents, bookmarkFolderShares, bookmarkFolders, bookmarks, contracts, engagements, fileUploads, fileVersions, tasks } from "@/db/schema";
import { db } from "../db";
import { cleanFileName, storageKeyFor } from "./drive-rules";
import { deleteObject, putObject, storageConfigured } from "./r2";

/*
 * What the rest of the Console files into Arquivos by itself (phase 4d): the
 * PDF of every signed contract, in the company's "Contratos" (only who sees
 * the company's finance: a gate on the folder), and the files of every task
 * delivered (in Revisão or Concluída), in "Entregas › <project>" (only who
 * sees that project). They are copies, made once each (`origin`), so they
 * do not count in the company's space and stay if the source changes; the
 * folders are the Console's, so nobody deletes, moves or shares them. Run by
 * the routine every 15 minutes, which also files what came before.
 */

type FolderSpec = { companyId: string; origin: string; name: string; ownerId: string; parentId?: string | null; area?: "finance" | null; engagementId?: string | null };

/** The company's folder for `origin`, made the first time (one per company, by the unique index). */
async function systemFolder(spec: FolderSpec) {
  await db.execute(sql`
    insert into ${bookmarkFolders} (id, company_id, owner_id, name, visibility, parent_id, origin, area, engagement_id)
    values (${crypto.randomUUID()}, ${spec.companyId}, ${spec.ownerId}, ${spec.name}, 'company', ${spec.parentId ?? null}, ${spec.origin}, ${spec.area ?? null}, ${spec.engagementId ?? null})
    on conflict (company_id, origin) where origin is not null do nothing`);
  const [folder] = await db
    .select({ id: bookmarkFolders.id })
    .from(bookmarkFolders)
    .where(and(eq(bookmarkFolders.companyId, spec.companyId), eq(bookmarkFolders.origin, spec.origin)));
  return folder.id;
}

/** One copy into R2 and Arquivos; a second run for the same origin changes nothing. */
async function fileCopy(input: { origin: string; companyId: string; folderId: string; ownerId: string; title: string; fileName: string; mime: string; bytes: Uint8Array }) {
  const id = crypto.randomUUID();
  const key = storageKeyFor(input.companyId, id);
  await putObject(key, input.bytes, input.mime);
  const [made] = await db
    .insert(bookmarks)
    .values({
      id,
      origin: input.origin,
      companyId: input.companyId,
      folderId: input.folderId,
      ownerId: input.ownerId,
      title: input.title.slice(0, 160),
      fileName: cleanFileName(input.fileName),
      storageKey: key,
      fileSize: input.bytes.length,
      mime: input.mime,
    })
    .onConflictDoNothing({ target: bookmarks.origin, where: sql`${bookmarks.origin} is not null` })
    .returning({ id: bookmarks.id });
  // Another run got there first: its copy stays, this object goes.
  if (!made) {
    await deleteObject(key).catch(() => undefined);
    return false;
  }
  await db.insert(auditEvents).values({ actorId: input.ownerId, companyId: input.companyId, action: "bookmark.filed", entityId: id, details: { origin: input.origin, title: input.title } });
  return true;
}

const pdfName = (title: string) =>
  `${
    title
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 80) || "contrato"
  }-assinado.pdf`;

/** Signed contracts without their copy yet; returns how many were filed. */
async function fileContracts(limit: number) {
  const pending = await db
    .select({ id: contracts.id, companyId: contracts.companyId, title: contracts.title, authorId: contracts.authorId })
    .from(contracts)
    .where(
      and(
        eq(contracts.status, "signed"),
        isNotNull(contracts.signedPdf),
        sql`not exists (select 1 from ${bookmarks} where ${bookmarks.origin} = 'contract:' || ${contracts.id})`,
      ),
    )
    .limit(limit);
  let filed = 0;
  for (const contract of pending) {
    const [row] = await db.select({ pdf: contracts.signedPdf }).from(contracts).where(eq(contracts.id, contract.id));
    if (!row?.pdf) continue;
    const folderId = await systemFolder({ companyId: contract.companyId, origin: "contracts", name: "Contratos", ownerId: contract.authorId, area: "finance" });
    if (
      await fileCopy({
        origin: `contract:${contract.id}`,
        companyId: contract.companyId,
        folderId,
        ownerId: contract.authorId,
        title: `${contract.title} (assinado)`,
        fileName: pdfName(contract.title),
        mime: "application/pdf",
        bytes: new Uint8Array(row.pdf),
      })
    )
      filed++;
  }
  return filed;
}

/** Files of delivered tasks (Revisão, Concluída) without their copy yet; returns how many were filed. */
async function fileDeliveries(limit: number) {
  const pending = await db
    .select({
      id: attachments.id,
      name: attachments.name,
      mime: attachments.mime,
      authorId: attachments.authorId,
      task: tasks.title,
      companyId: tasks.companyId,
      engagementId: engagements.id,
      project: engagements.name,
    })
    .from(attachments)
    .innerJoin(tasks, eq(tasks.id, attachments.taskId))
    .innerJoin(engagements, eq(engagements.id, tasks.engagementId))
    .where(and(inArray(tasks.status, ["review", "done"]), sql`not exists (select 1 from ${bookmarks} where ${bookmarks.origin} = 'attachment:' || ${attachments.id})`))
    .limit(limit);
  let filed = 0;
  for (const file of pending) {
    const [row] = await db.select({ content: attachments.content }).from(attachments).where(eq(attachments.id, file.id));
    if (!row?.content) continue;
    const top = await systemFolder({ companyId: file.companyId, origin: "deliveries", name: "Entregas", ownerId: file.authorId });
    const folderId = await systemFolder({
      companyId: file.companyId,
      origin: `deliveries:${file.engagementId}`,
      name: file.project,
      ownerId: file.authorId,
      parentId: top,
      engagementId: file.engagementId,
    });
    if (
      await fileCopy({
        origin: `attachment:${file.id}`,
        companyId: file.companyId,
        folderId,
        ownerId: file.authorId,
        title: file.task,
        fileName: file.name,
        mime: file.mime,
        bytes: new Uint8Array(row.content),
      })
    )
      filed++;
  }
  return filed;
}

/** The routine's part: what the Console files by itself, a batch at a time. Without R2, nothing (copies live there). */
export async function fileConsoleDocuments({ limit = 50 } = {}) {
  if (!storageConfigured()) return { contracts: 0, deliveries: 0 };
  return { contracts: await fileContracts(limit), deliveries: await fileDeliveries(limit) };
}

/**
 * A project going away takes its deliveries' copies and folders with it
 * (inside the deletion's transaction: without the project, the folder's gate
 * would mean nothing). Returns the R2 keys, for the caller to remove after
 * it commits.
 */
export async function removeProjectFiles(tx: Pick<typeof db, "select" | "delete" | "update">, engagementId: string) {
  const ids = (await tx.select({ id: bookmarkFolders.id }).from(bookmarkFolders).where(eq(bookmarkFolders.engagementId, engagementId))).map((f) => f.id);
  if (!ids.length) return [] as string[];
  const items = await tx.select({ id: bookmarks.id, key: bookmarks.storageKey }).from(bookmarks).where(inArray(bookmarks.folderId, ids));
  // Versions and texts go with their items (on delete cascade); their objects are listed first.
  const versions = items.length ? await tx.select({ key: fileVersions.storageKey }).from(fileVersions).where(inArray(fileVersions.bookmarkId, items.map((i) => i.id))) : [];
  if (items.length) await tx.delete(bookmarks).where(inArray(bookmarks.id, items.map((i) => i.id)));
  await tx.update(fileUploads).set({ folderId: null }).where(inArray(fileUploads.folderId, ids));
  await tx.delete(bookmarkFolderShares).where(inArray(bookmarkFolderShares.folderId, ids));
  await tx.update(bookmarkFolders).set({ parentId: null }).where(inArray(bookmarkFolders.parentId, ids));
  await tx.delete(bookmarkFolders).where(inArray(bookmarkFolders.id, ids));
  return [...items.map((i) => i.key), ...versions.map((v) => v.key)].filter((key): key is string => !!key);
}
