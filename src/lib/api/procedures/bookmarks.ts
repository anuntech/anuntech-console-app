import "server-only";
import { eq, sql } from "drizzle-orm";
import { bookmarkFolders, bookmarks as bookmarkTable } from "@/db/schema";
import { db } from "../../db";
import { accessibleCompanies, type Actor } from "../../access/access";
import { avatarView } from "../../account/avatar-view";
import { companyDisplayName } from "../../companies/display-name";
import { pageCountOf } from "../../list-query";
import { kindOf } from "../../bookmarks/board-rules";
import { bookmarkFor, bookmarkQuery, bookmarksFor, foldersFor, scopeOf, type BookmarkView } from "../../bookmarks/bookmarks";
import {
  createFolderAs,
  deleteBookmarkAs,
  deleteFolderAs,
  loadFolder,
  manages,
  moveBookmarkAs,
  renameFolderAs,
  saveBookmarkAs,
  searchPeopleAs,
  shareFolderAs,
  updateBookmarkAs,
  usable,
} from "../../bookmarks/bookmark-core";
import { api } from "../server";
import { guard, missing } from "../access";
import { answer } from "../managed-company";

/** The app pages bookmarks like the web's default list. */
const PAGE_SIZE = 25;

/** The company of a folder; unknown ids (and Anuntech's own space) reach no one. */
const folderCompany = async ({ id }: { id: string }) =>
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
async function visibleBookmark(actor: Actor, id: string) {
  if (!(await bookmarkFor(actor, id))) throw missing();
}

/** Where the person files bookmarks: their companies (the team: every active one; Anuntech's own space stays on the web). */
async function companiesFor(actor: Actor) {
  const rows = actor.admin
    ? (await accessibleCompanies(actor)).filter((c) => !c.archived)
    : actor.grants.map((g) => g.company);
  return rows.map((c) => ({ id: c.id, name: companyDisplayName(c.name, c.document) }));
}

/** A bookmark as the app shows it, in the list and alone. */
function itemView(item: BookmarkView, editable: boolean) {
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
  };
}

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
      const query = bookmarkQuery({ pasta: input.folder, q: input.search, empresa: input.company }, scope);
      const folders = await foldersFor(scope, query.company);
      // A folder that went away (or was never visible) shows everything, as on the web.
      if (query.folder !== "all" && query.folder !== "root" && !folders.some((f) => f.id === query.folder))
        query.folder = "all";
      const [{ items, rootCount, matching, page }, companies] = await Promise.all([
        bookmarksFor(
          scope,
          folders.map((f) => f.id),
          query,
          { page: input.page, pageSize: PAGE_SIZE },
        ),
        companiesFor(actor),
      ]);
      const names = new Map(companies.map((c) => [c.id, c.name]));
      const folderOwner = new Map(folders.map((f) => [f.id, f.ownerId]));
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
          manages: actor.admin || f.ownerId === actor.user.id,
        })),
        items: items.map((item) =>
          itemView(
            item,
            // The same rule as editableBookmark: the team, who saved it, or the folder's owner.
            actor.admin ||
              item.ownerId === actor.user.id ||
              (!!item.folderId && folderOwner.get(item.folderId) === actor.user.id),
          ),
        ),
        folder: query.folder,
        rootCount,
        total: matching,
        page,
        pageCount: pageCountOf(matching, PAGE_SIZE),
        companies,
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
          // octet_length reads the stored size without loading the bytes, as the list.
          fileSize: sql<number | null>`octet_length(${bookmarkTable.content})`,
          preview: sql<boolean>`(${bookmarkTable.preview} is not null)`,
          createdAt: bookmarkTable.createdAt,
        })
        .from(bookmarkTable)
        .where(eq(bookmarkTable.id, input.id));
      if (!extra) throw missing();
      return itemView(
        {
          ...record,
          board: record.board != null,
          fileSize: extra.fileSize,
          preview: extra.preview,
          createdAt: extra.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        },
        record.editable,
      );
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
  update: api.bookmarks.update
    .use(guard({ area: "overview", company: bookmarkCompany }))
    .handler(async ({ input, context }) => {
      await visibleBookmark(context.actor, input.id);
      if (input.folderId) await visibleFolder(context.actor, input.folderId);
      return answer(await updateBookmarkAs(context.actor, input));
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
    .use(guard({ area: "overview", company: (input: { companyId: string }) => input.companyId }))
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
};
