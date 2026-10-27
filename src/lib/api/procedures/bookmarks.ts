import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { bookmarkFolders, bookmarkStars, bookmarks as bookmarkTable, fileTexts, fileVersions, shareLinks, user } from "@/db/schema";
import { db } from "../../db";
import { accessibleCompanies, type Actor } from "../../access/access";
import { avatarView } from "../../account/avatar-view";
import { companyDisplayName } from "../../companies/display-name";
import { pageCountOf } from "../../list-query";
import { kindOf } from "../../bookmarks/board-rules";
import { isTag } from "../../drive/tag-rules";
import { bookmarkFor, bookmarkQuery, bookmarksFor, foldersFor, scopeOf, type BookmarkView } from "../../bookmarks/bookmarks";
import {
  createFolderAs,
  deleteBookmarkAs,
  deleteFolderAs,
  loadFolder,
  manages,
  moveBookmarkAs,
  moveFolderAs,
  purgeBookmarkAs,
  renameFolderAs,
  replaceBookmarkFileAs,
  restoreBookmarkAs,
  restoreVersionAs,
  saveBookmarkAs,
  searchPeopleAs,
  shareFolderAs,
  starBookmarkAs,
  updateBookmarkAs,
  usable,
} from "../../bookmarks/bookmark-core";
import { bookmarkActivity, recordDownload } from "../../drive/activity";
import { copyBookmarkAs } from "../../bookmarks/bookmark-copy";
import { indexSoon } from "../../drive/file-index";
import { createShareLinkAs, revokeShareLinkAs, shareLinksFor } from "../../drive/share-links";
import { downloadUrl, storageConfigured } from "../../drive/r2";
import { spacesFor } from "../../drive/uploads";
import { thumbnailAddresses } from "../../drive/thumb-url";
import { api } from "../server";
import { guard, missing } from "../access";
import { answer } from "../managed-company";

/** The app pages bookmarks like the web's default list. */
const PAGE_SIZE = 25;

/** The company of a folder; unknown ids (and Anuntech's own space) reach no one. */
export const folderCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: bookmarkFolders.companyId }).from(bookmarkFolders).where(eq(bookmarkFolders.id, id)))[0]
    ?.companyId;
/** The company of a bookmark, for the guard. */
const bookmarkCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: bookmarkTable.companyId }).from(bookmarkTable).where(eq(bookmarkTable.id, id)))[0]
    ?.companyId;

/** A folder the viewer cannot see is "not found", like a bookmark (bookmarkFor). */
async function visibleFolder(actor: Actor, id: string) {
  const folder = await loadFolder(id);
  if (!folder || !(await usable(actor, folder))) throw missing();
  return folder;
}
async function visibleBookmark(actor: Actor, id: string, trashed = false) {
  if (!(await bookmarkFor(actor, id, { trashed }))) throw missing();
}
/** The company of a version's file, for the guard. */
const versionCompany = async ({ versionId }: { versionId: string }) =>
  (await db.select({ companyId: fileVersions.companyId }).from(fileVersions).where(eq(fileVersions.id, versionId)))[0]?.companyId;
/** The company of what a link shares (a file or a folder). */
const shareTargetCompany = async (input: { bookmarkId: string; folderId: string }) =>
  input.bookmarkId ? bookmarkCompany({ id: input.bookmarkId }) : input.folderId ? folderCompany({ id: input.folderId }) : null;
const linkCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: shareLinks.companyId }).from(shareLinks).where(eq(shareLinks.id, id)))[0]?.companyId;

/** Where the person files bookmarks: their companies (the team: every active one; Anuntech's own space stays on the web). */
async function companiesFor(actor: Actor) {
  const rows = actor.admin
    ? (await accessibleCompanies(actor)).filter((c) => !c.archived)
    : actor.grants.map((g) => g.company);
  return rows.map((c) => ({ id: c.id, name: companyDisplayName(c.name, c.document) }));
}

/** A bookmark as the app shows it, in the list and alone; `thumbUrl`: its card picture, when ready. */
function itemView(item: BookmarkView, editable: boolean, thumbUrl?: string) {
  const kind = kindOf(item);
  const hasPreview = kind === "board" && !!item.preview;
  return {
    id: item.id,
    title: item.title,
    kind,
    url: item.url,
    fileName: item.fileName,
    fileSize: kind === "file" ? (item.fileSize ?? null) : null,
    filePath:
      kind === "file"
        ? `/api/bookmarks/${item.id}`
        : hasPreview
          ? `/api/bookmarks/${item.id}/preview?v=${encodeURIComponent(item.updatedAt ?? "")}`
          : null,
    hasPreview,
    folderId: item.folderId,
    companyId: item.companyId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    editable,
    tag: item.tag ?? null,
    tagSource: item.tagSource ?? null,
    ...(item.excerpt ? { excerpt: item.excerpt } : {}),
    ...(item.deletedAt ? { deletedAt: item.deletedAt } : {}),
    ...(item.starred ? { starred: true } : {}),
    ...(thumbUrl ? { thumbUrl } : {}),
    ...(item.page ? { page: item.page } : {}),
    ...(item.ownerName !== undefined ? { ownerName: item.ownerName } : {}),
  };
}

/** The card pictures of the files a list shows that have one (the item's `thumb`), signed after the list's own access check. */
const thumbsOf = (items: BookmarkView[]) => thumbnailAddresses(items.filter((item) => item.thumb && !item.deletedAt).map((item) => item.id));

const person = (p: { id: string; name: string; image: string | null }) => ({
  id: p.id,
  name: p.name,
  avatar: avatarView(p.image, p.id),
});

export const bookmarks = {
  list: api.bookmarks.list
    // foldersFor and bookmarksFor keep each person to their companies and to the folders shared with them.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const scope = scopeOf(actor);
      const query = bookmarkQuery(
        { pasta: input.folder, q: input.search, empresa: input.company, etiqueta: input.tag, tipo: input.kind, ordem: input.sort, meus: input.mine ? "1" : "" },
        scope,
      );
      const folders = await foldersFor(scope, query.company);
      // A folder that went away (or was never visible) shows everything, as on the web.
      if (
        query.folder !== "all" &&
        query.folder !== "root" &&
        query.folder !== "lixeira" &&
        query.folder !== "estrela" &&
        query.folder !== "recentes" &&
        !folders.some((f) => f.id === query.folder)
      )
        query.folder = "all";
      const [{ items, rootCount, matching, page, tags, trashCount, starredCount }, companies] = await Promise.all([
        bookmarksFor(
          scope,
          folders.map((f) => f.id),
          query,
          { page: input.page, pageSize: PAGE_SIZE },
        ),
        companiesFor(actor),
      ]);
      // The space meter, as the web page: the team sees Anuntech's own and the company it filtered; a client, each of its companies.
      const spaces =
        input.page === 1
          ? await spacesFor(
              actor.admin
                ? [null, ...(query.company !== "all" && query.company !== "internal" ? [query.company] : [])]
                : actor.grants.map((g) => g.company.id),
            )
          : undefined;
      const thumbs = await thumbsOf(items);
      const names = new Map(companies.map((c) => [c.id, c.name]));
      // The Console's own folders (contracts, deliveries) give their owner nothing.
      const folderOwner = new Map(folders.map((f) => [f.id, f.system ? null : f.ownerId]));
      return {
        folders: folders.map((f) => ({
          id: f.id,
          name: f.name,
          companyId: f.companyId,
          company: f.companyId ? (names.get(f.companyId) ?? f.company) : f.company,
          count: f.count,
          visibility: f.visibility,
          ownerId: f.ownerId,
          owner: f.owner,
          sharedWith: f.sharedWith.map(person),
          manages: actor.admin || (f.ownerId === actor.user.id && !f.system),
          parentId: f.parentId ?? null,
          ...(f.system ? { system: true } : {}),
          adds: f.adds ?? "viewers",
        })),
        tags,
        trashCount,
        starredCount,
        items: items.map((item) =>
          itemView(
            item,
            // The same rule as editableBookmark: the team, who saved it, or the folder's owner.
            actor.admin ||
              item.ownerId === actor.user.id ||
              (!!item.folderId && folderOwner.get(item.folderId) === actor.user.id),
            thumbs.get(item.id),
          ),
        ),
        folder: query.folder,
        rootCount,
        total: matching,
        page,
        pageCount: pageCountOf(matching, PAGE_SIZE),
        companies,
        ...(spaces ? { largeFiles: storageConfigured(), spaces } : {}),
      };
    }),
  get: api.bookmarks.get
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      // bookmarkFor: the company, and a folder open to the company, theirs or shared with them.
      const record = await bookmarkFor(context.actor, input.id);
      if (!record) throw missing();
      const [extra] = await db
        .select({
          // The size R2 holds, or octet_length of an older file, without loading the bytes, as the list.
          fileSize: sql<number | null>`coalesce(${bookmarkTable.fileSize}, octet_length(${bookmarkTable.content}))::float8`,
          preview: sql<boolean>`(${bookmarkTable.preview} is not null)`,
          createdAt: bookmarkTable.createdAt,
          tag: bookmarkTable.tag,
          tagSource: bookmarkTable.tagSource,
          ownerName: user.name,
          // The same readings as the list's (bookmarksFor): the viewer's star, the card's picture and page.
          starred: sql<boolean>`exists (select 1 from ${bookmarkStars} where ${bookmarkStars.bookmarkId} = ${bookmarkTable.id} and ${bookmarkStars.userId} = ${context.actor.user.id})`,
          thumb: sql<boolean>`coalesce((select ${fileTexts.thumbStatus} = 'done' and ${fileTexts.sourceKey} = ${bookmarkTable.storageKey} from ${fileTexts} where ${fileTexts.bookmarkId} = ${bookmarkTable.id}), false)`,
          page: sql<string | null>`(select left(${fileTexts.text}, 420) from ${fileTexts} where ${fileTexts.bookmarkId} = ${bookmarkTable.id} and ${fileTexts.status} = 'done')`,
        })
        .from(bookmarkTable)
        .leftJoin(user, eq(user.id, bookmarkTable.ownerId))
        .where(eq(bookmarkTable.id, input.id));
      if (!extra) throw missing();
      const item: BookmarkView = {
        ...record,
        board: record.board != null,
        fileSize: extra.fileSize,
        preview: extra.preview,
        createdAt: extra.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        tag: isTag(extra.tag) ? extra.tag : null,
        tagSource: extra.tagSource,
        ownerName: extra.ownerName,
        ...(extra.starred ? { starred: true } : {}),
        ...(extra.thumb ? { thumb: true } : {}),
        ...(extra.page ? { page: extra.page } : {}),
      };
      return itemView(item, record.editable, (await thumbsOf([item])).get(item.id));
    }),
  create: api.bookmarks.create
    // Inside a folder, the folder's company; otherwise the one chosen. Anuntech's own space stays on the web.
    .use(
      guard({
        area: "overview",
        company: async (input: { companyId: string; folderId: string }) =>
          input.folderId ? folderCompany({ id: input.folderId }) : input.companyId || null,
      }),
    )
    .handler(async ({ input, context }) => {
      if (input.folderId) await visibleFolder(context.actor, input.folderId);
      const result = await saveBookmarkAs(context.actor, input, null);
      const { message } = answer(result);
      return { message, id: result.id! };
    }),
  download: api.bookmarks.download
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      // The same check as /api/bookmarks/[id]: bookmarkFor, and only a file bookmark.
      const item = await bookmarkFor(context.actor, input.id);
      if (!item?.fileName) throw missing();
      const [stored] = await db
        .select({
          key: bookmarkTable.storageKey,
          fileSize: sql<number | null>`coalesce(${bookmarkTable.fileSize}, octet_length(${bookmarkTable.content}))::float8`,
        })
        .from(bookmarkTable)
        .where(eq(bookmarkTable.id, item.id));
      if (!stored) throw missing();
      if (!input.inline) await recordDownload(context.actor, item);
      // A file in R2 is read from there through a five-minute address; an older one through filePath, with the session.
      const url = stored.key && storageConfigured() ? await downloadUrl(stored.key, item.fileName, input.inline) : null;
      return { url, fileName: item.fileName, fileSize: stored.fileSize };
    }),
  update: api.bookmarks.update
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id);
      if (input.folderId) await visibleFolder(context.actor, input.folderId);
      return answer(await updateBookmarkAs(context.actor, input));
    }),
  star: api.bookmarks.star
    // Anyone who sees the item, as the web's menu; a star is only the viewer's.
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id);
      const result = await starBookmarkAs(context.actor, input);
      const { message } = answer(result);
      return { message, starred: !!result.starred };
    }),
  move: api.bookmarks.move
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id);
      if (input.folderId) await visibleFolder(context.actor, input.folderId);
      return answer(await moveBookmarkAs(context.actor, input));
    }),
  remove: api.bookmarks.remove
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id);
      return answer(await deleteBookmarkAs(context.actor, input));
    }),
  createFolder: api.bookmarks.createFolder
    // Inside a folder, the folder's company (createFolderAs takes it from there).
    .use(guard({ area: "overview", company: (input: { companyId: string; parentId: string }) => (input.parentId ? folderCompany({ id: input.parentId }) : input.companyId) }))
    .handler(async ({ input, context }) => {
      const result = await createFolderAs(context.actor, input);
      const { message } = answer(result);
      return { message, id: result.id! };
    }),
  renameFolder: api.bookmarks.renameFolder
    .use(guard({ area: "overview", company: folderCompany }))
    .handler(async ({ input, context }) => {
      await visibleFolder(context.actor, input.id);
      return answer(await renameFolderAs(context.actor, input));
    }),
  shareFolder: api.bookmarks.shareFolder
    .use(guard({ area: "overview", company: folderCompany }))
    .handler(async ({ input, context }) => {
      await visibleFolder(context.actor, input.id);
      return answer(await shareFolderAs(context.actor, input));
    }),
  deleteFolder: api.bookmarks.deleteFolder
    .use(guard({ area: "overview", company: folderCompany }))
    .handler(async ({ input, context }) => {
      await visibleFolder(context.actor, input.id);
      return answer(await deleteFolderAs(context.actor, input));
    }),
  searchPeople: api.bookmarks.searchPeople
    .use(guard({ area: "overview", company: ({ folderId }: { folderId: string }) => folderCompany({ id: folderId }) }))
    .handler(async ({ input, context }) => {
      const folder = await visibleFolder(context.actor, input.folderId);
      // Only the owner shares; anyone else gets no one, as the web's picker.
      if (!manages(context.actor, folder)) return { people: [] };
      return { people: (await searchPeopleAs(context.actor, input.folderId, input.query)).map(person) };
    }),
  moveFolder: api.bookmarks.moveFolder
    .use(guard({ area: "overview", company: folderCompany }))
    .handler(async ({ input, context }) => {
      await visibleFolder(context.actor, input.id);
      return answer(await moveFolderAs(context.actor, input));
    }),
  restore: api.bookmarks.restore
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id, true);
      return answer(await restoreBookmarkAs(context.actor, input));
    }),
  purge: api.bookmarks.purge
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id, true);
      return answer(await purgeBookmarkAs(context.actor, input));
    }),
  copy: api.bookmarks.copy
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id);
      if (input.folderId) await visibleFolder(context.actor, input.folderId);
      const result = answer(await copyBookmarkAs(context.actor, input));
      indexSoon();
      return result;
    }),
  versions: api.bookmarks.versions
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      const item = await bookmarkFor(context.actor, input.id);
      if (!item?.fileName) throw missing();
      const rows = await db
        .select({ id: fileVersions.id, version: fileVersions.version, fileName: fileVersions.fileName, fileSize: fileVersions.fileSize, createdAt: fileVersions.createdAt, by: user.name })
        .from(fileVersions)
        .leftJoin(user, eq(user.id, fileVersions.actorId))
        .where(eq(fileVersions.bookmarkId, item.id))
        .orderBy(desc(fileVersions.version));
      return { editable: item.editable, versions: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), by: r.by ?? null })) };
    }),
  downloadVersion: api.bookmarks.downloadVersion
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      const item = await bookmarkFor(context.actor, input.id);
      if (!item || !storageConfigured()) throw missing();
      const [version] = await db
        .select({ key: fileVersions.storageKey, fileName: fileVersions.fileName, version: fileVersions.version })
        .from(fileVersions)
        .where(and(eq(fileVersions.id, input.versionId), eq(fileVersions.bookmarkId, item.id)));
      if (!version) throw missing();
      await recordDownload(context.actor, item, { version: version.version });
      return { url: await downloadUrl(version.key, version.fileName), fileName: version.fileName };
    }),
  restoreVersion: api.bookmarks.restoreVersion
    .use(guard({ area: "overview", company: versionCompany }))
    .handler(async ({ input, context }) => {
      const result = answer(await restoreVersionAs(context.actor, { id: input.versionId }));
      indexSoon();
      return result;
    }),
  replaceFile: api.bookmarks.replaceFile
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id);
      const result = answer(await replaceBookmarkFileAs(context.actor, input));
      indexSoon();
      return result;
    }),
  activity: api.bookmarks.activity
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      const rows = await bookmarkActivity(context.actor, input.id);
      if (!rows) throw missing();
      return { activity: rows };
    }),
  shareLinks: api.bookmarks.shareLinks
    .use(guard({ area: "overview", company: shareTargetCompany }))
    .handler(async ({ input, context }) => {
      const links = await shareLinksFor(context.actor, { bookmarkId: input.bookmarkId, folderId: input.folderId });
      if (!links) throw missing();
      return { links };
    }),
  createShareLink: api.bookmarks.createShareLink
    .use(guard({ area: "overview", company: shareTargetCompany }))
    .handler(async ({ input, context }) => {
      const result = await createShareLinkAs(context.actor, { ...input, expiresInDays: String(input.expiresInDays), maxDownloads: String(input.maxDownloads) });
      // A refusal answers like every action here (answer throws it to the app).
      if (result.error || !result.url) answer({ error: result.error ?? "Não foi possível criar o link." });
      return { message: result.success ?? "Link criado.", url: result.url! };
    }),
  revokeShareLink: api.bookmarks.revokeShareLink
    .use(guard({ area: "overview", company: linkCompany }))
    .handler(async ({ input, context }) => answer(await revokeShareLinkAs(context.actor, input.id))),
};
