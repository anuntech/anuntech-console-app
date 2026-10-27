import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  accountEmails,
  bookmarkFolderShares,
  bookmarkFolders,
  bookmarks,
  companies,
  fileTexts,
  consoleStaffMembers,
  memberships,
  user,
} from "@/db/schema";
import { canAccess, type Actor } from "../access/access";
import { contentQuery } from "../drive/text-search";
import { MARK_CLOSE, MARK_OPEN } from "../drive/text-excerpt";
import { isTag, type TagSlug, type TagSource } from "../drive/tag-rules";
import { gateOpen, gateViewerOf, type GateViewer } from "./folder-gate";
import { extensionPattern, isKindFilter, isSortOrder, type KindFilter, type SortOrder } from "./list-filters";
import { getAccountEmails } from "../account/account-identity";
import { hasConsoleStaffAccess } from "../access/console-members";
import { db } from "../db";
import { clampPage, DEFAULT_PAGE_SIZE, offsetOf, type PageQuery } from "../list-query";

/** What the viewer may see: staff sees every company; a member, their own. */
/** `gate`: the roles and projects, for folders with an area or a project on top (lib/bookmarks/folder-gate.ts). */
export type Scope = { admin: boolean; userId: string; companyIds: string[]; gate: GateViewer };
export const scopeOf = (actor: Actor): Scope => ({
  admin: actor.admin,
  userId: actor.user.id,
  companyIds: actor.grants.map((g) => g.company.id),
  gate: gateViewerOf(actor),
});

export type FolderView = {
  id: string;
  name: string;
  companyId: string | null;
  company: string | null;
  ownerId: string;
  owner: string;
  visibility: "company" | "people";
  /** The folder it sits in; null at the top. Optional so fixtures without it still type. */
  parentId?: string | null;
  /** Kept by the Console (contracts, deliveries): nobody deletes, moves or shares it. */
  system?: boolean;
  sharedWith: { id: string; name: string; image: string | null }[];
  count: number;
};
export type BookmarkView = {
  id: string;
  title: string;
  url: string | null;
  fileName: string | null;
  /** Bytes of the saved file; null for links. Optional so fixtures without it still type. */
  fileSize?: number | null;
  /** A whiteboard, drawn in the Console. Optional so fixtures without it still type. */
  board?: boolean;
  /** Whether a PNG of the whiteboard exists, for the card. */
  preview?: boolean;
  folderId: string | null;
  companyId: string | null;
  ownerId: string;
  createdAt: string;
  /** Last change (a whiteboard's last stroke); busts the preview's cache. */
  updatedAt?: string;
  /** In the trash since then; only in the Lixeira view. */
  deletedAt?: string;
  /** Where a search found its words inside the file, between MARK_OPEN and MARK_CLOSE (lib/drive/text-excerpt.ts). */
  excerpt?: string;
  /** Its tag (lib/drive/tag-rules.ts) and who set it; optional so fixtures without it still type. */
  tag?: TagSlug | null;
  tagSource?: TagSource | null;
};
/** `company`: "all", "internal" (Anuntech's own) or a company id; `tag`: one of the tags, or every item. */
export type BookmarkQuery = {
  folder: string;
  search: string;
  company: string;
  tag?: TagSlug | "";
  /** The "Tipo" filter, the order, and only what the viewer added (lib/bookmarks/list-filters.ts). */
  kind?: KindFilter | "";
  sort?: SortOrder;
  mine?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function bookmarkQuery(
  params: Record<string, string | string[] | undefined>,
  scope: Scope,
): BookmarkQuery {
  const scalar = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const folder = scalar("pasta");
  const company = scalar("empresa");
  const companyOk =
    (company === "internal" && scope.admin) ||
    (UUID.test(company) && (scope.admin || scope.companyIds.includes(company.toLowerCase())));
  return {
    // "lixeira": what was deleted in the last 30 days, to restore or delete for good.
    folder: folder === "root" || folder === "lixeira" || UUID.test(folder) ? folder : "all",
    search: scalar("q").trim().slice(0, 160),
    tag: isTag(scalar("etiqueta")) ? (scalar("etiqueta") as TagSlug) : "",
    kind: isKindFilter(scalar("tipo")) ? (scalar("tipo") as KindFilter) : "",
    sort: isSortOrder(scalar("ordem")) ? (scalar("ordem") as SortOrder) : "",
    mine: scalar("meus") === "1",
    company: companyOk ? (company === "internal" ? company : company.toLowerCase()) : "all",
  };
}

/** The company condition for a query, on any table with a company_id column. */
function companyCondition(
  column: typeof bookmarks.companyId | typeof bookmarkFolders.companyId,
  scope: Scope,
  company: string,
) {
  if (company === "internal") return isNull(column);
  if (company !== "all") return eq(column, company);
  return scope.admin
    ? undefined
    : scope.companyIds.length
      ? inArray(column, scope.companyIds)
      : sql`false`;
}

/** Folders the viewer may open, with counts and who they are shared with. */
export async function foldersFor(scope: Scope, company: string): Promise<FolderView[]> {
  const rows = await db
    .select({
      id: bookmarkFolders.id,
      name: bookmarkFolders.name,
      companyId: bookmarkFolders.companyId,
      company: companies.name,
      ownerId: bookmarkFolders.ownerId,
      owner: user.name,
      visibility: bookmarkFolders.visibility,
      parentId: bookmarkFolders.parentId,
      origin: bookmarkFolders.origin,
      area: bookmarkFolders.area,
      engagementId: bookmarkFolders.engagementId,
      sharedWithMe: bookmarkFolderShares.userId,
    })
    .from(bookmarkFolders)
    .innerJoin(user, eq(user.id, bookmarkFolders.ownerId))
    .leftJoin(companies, eq(companies.id, bookmarkFolders.companyId))
    .leftJoin(
      bookmarkFolderShares,
      and(
        eq(bookmarkFolderShares.folderId, bookmarkFolders.id),
        eq(bookmarkFolderShares.userId, scope.userId),
      ),
    )
    .where(
      and(
        companyCondition(bookmarkFolders.companyId, scope, company),
        scope.admin
          ? undefined
          : or(
              eq(bookmarkFolders.visibility, "company"),
              eq(bookmarkFolders.ownerId, scope.userId),
              isNotNull(bookmarkFolderShares.userId),
            ),
      ),
    )
    .orderBy(asc(bookmarkFolders.name))
    // A gate (contracts, a project) on top of who sees it: what is inside stays out with the folder.
    .then((found) => found.filter((row) => gateOpen(scope.gate, row)));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [counts, shares] = await Promise.all([
    db
      .select({ folderId: bookmarks.folderId, n: sql<number>`count(*)::int` })
      .from(bookmarks)
      .where(and(inArray(bookmarks.folderId, ids), isNull(bookmarks.deletedAt)))
      .groupBy(bookmarks.folderId),
    db
      .select({
        folderId: bookmarkFolderShares.folderId,
        id: user.id,
        name: user.name,
        image: user.image,
      })
      .from(bookmarkFolderShares)
      .innerJoin(user, eq(user.id, bookmarkFolderShares.userId))
      .where(inArray(bookmarkFolderShares.folderId, ids))
      .orderBy(asc(user.name)),
  ]);
  const countOf = new Map(counts.map((row) => [row.folderId, row.n]));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    companyId: row.companyId,
    company: row.company,
    ownerId: row.ownerId,
    owner: row.owner,
    visibility: row.visibility,
    parentId: row.parentId,
    ...(row.origin ? { system: true } : {}),
    sharedWith: shares
      .filter((share) => share.folderId === row.id)
      .map(({ id, name, image }) => ({ id, name, image })),
    count: countOf.get(row.id) ?? 0,
  }));
}

/**
 * One page of the bookmarks the viewer may see: loose ones of their companies,
 * plus visible folders. `total` and `rootCount` feed the folder rail (the whole
 * company, before the folder and the search); `matching` is what the folder and
 * the search leave, for the header and the footer.
 */
export async function bookmarksFor(
  scope: Scope,
  folderIds: string[],
  query: BookmarkQuery,
  paging: PageQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE },
): Promise<{ items: BookmarkView[]; rootCount: number; total: number; matching: number; page: number; trashCount: number; tags: { tag: TagSlug; count: number }[] }> {
  // Everything the viewer may see, the trash included; the lists and counts below take the trash out.
  const reachable = and(
    companyCondition(bookmarks.companyId, scope, query.company),
    or(isNull(bookmarks.folderId), folderIds.length ? inArray(bookmarks.folderId, folderIds) : sql`false`),
  );
  const visible = and(reachable, isNull(bookmarks.deletedAt));
  const trash = query.folder === "lixeira";
  const narrowed = trash
    ? and(reachable, isNotNull(bookmarks.deletedAt))
    : query.folder === "root"
      ? and(visible, isNull(bookmarks.folderId))
      : query.folder !== "all"
        ? folderIds.includes(query.folder)
          ? and(visible, eq(bookmarks.folderId, query.folder))
          : sql`false`
        : visible;
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  // Words of three letters or more also look inside the files (lib/drive/file-index.ts).
  const typed = query.search.trim();
  const inContent =
    typed.length >= 3
      ? sql`exists (select 1 from ${fileTexts} where ${fileTexts.bookmarkId} = ${bookmarks.id} and ${fileTexts.search} @@ ${contentQuery(typed)})`
      : undefined;
  const tagged = query.tag && !trash ? eq(bookmarks.tag, query.tag) : undefined;
  const pattern = query.kind ? extensionPattern(query.kind) : null;
  const ofKind =
    query.kind === "arquivos"
      ? isNotNull(bookmarks.fileName)
      : query.kind === "links"
        ? isNotNull(bookmarks.url)
        : query.kind === "lousas"
          ? isNotNull(bookmarks.board)
          : pattern
            ? sql`lower(${bookmarks.fileName}) ~ ${pattern}`
            : undefined;
  const mine = query.mine ? eq(bookmarks.ownerId, scope.userId) : undefined;
  const matchingWhere =
    and(
      narrowed,
      tagged,
      ofKind,
      mine,
      search
        ? or(ilike(bookmarks.title, `%${search}%`), ilike(bookmarks.url, `%${search}%`), ilike(bookmarks.fileName, `%${search}%`), inContent)
        : undefined,
    ) ?? sql`true`;
  // Counted first, so a page past the end (after a delete or a narrower search)
  // falls back to the last one instead of showing an empty list.
  const [counts] = await db
    .select({
      root: sql<number>`count(*) filter (where ${bookmarks.folderId} is null and ${bookmarks.deletedAt} is null)::int`,
      total: sql<number>`count(*) filter (where ${bookmarks.deletedAt} is null)::int`,
      trash: sql<number>`count(*) filter (where ${bookmarks.deletedAt} is not null)::int`,
      matching: sql<number>`count(*) filter (where ${matchingWhere})::int`,
    })
    .from(bookmarks)
    .where(reachable);
  const matching = counts?.matching ?? 0;
  // The tags of what the folder shows (before the tag and the search), for the filter.
  const tags = trash
    ? []
    : await db
        .select({ tag: bookmarks.tag, count: sql<number>`count(*)::int` })
        .from(bookmarks)
        .where(and(narrowed, isNotNull(bookmarks.tag)))
        .groupBy(bookmarks.tag);
  const shown = clampPage(paging, matching);
  const items = matching
    ? await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          fileName: bookmarks.fileName,
          // The size R2 holds, or octet_length of an older file, without loading the bytes.
          fileSize: sql<number | null>`coalesce(${bookmarks.fileSize}, octet_length(${bookmarks.content}))::float8`,
          // Flags only: the scene and its PNG stay in the database until opened.
          board: sql<boolean>`(${bookmarks.board} is not null)`,
          preview: sql<boolean>`(${bookmarks.preview} is not null)`,
          folderId: bookmarks.folderId,
          companyId: bookmarks.companyId,
          ownerId: bookmarks.ownerId,
          createdAt: bookmarks.createdAt,
          updatedAt: bookmarks.updatedAt,
          deletedAt: bookmarks.deletedAt,
          tag: bookmarks.tag,
          tagSource: bookmarks.tagSource,
          // The passage of the file with the words, highlighted; the typed words and the accentless ones both count.
          excerpt: inContent
            ? sql<string | null>`(select ts_headline('portuguese', ${fileTexts.text}, ${contentQuery(typed)} || websearch_to_tsquery('portuguese', ${typed}), ${`MaxWords=24, MinWords=10, MaxFragments=1, StartSel=${MARK_OPEN}, StopSel=${MARK_CLOSE}`}) from ${fileTexts} where ${fileTexts.bookmarkId} = ${bookmarks.id} and ${fileTexts.search} @@ ${contentQuery(typed)})`
            : sql<null>`null`,
        })
        .from(bookmarks)
        .where(matchingWhere)
        // The id breaks ties between bookmarks saved in the same instant, so no
        // row repeats or goes missing across pages. The trash goes by when each was deleted.
        .orderBy(
          ...(trash
            ? [desc(bookmarks.deletedAt)]
            : query.sort === "antigos"
              ? [asc(bookmarks.createdAt)]
              : query.sort === "nome"
                ? [sql`lower(${bookmarks.title}) asc`]
                : query.sort === "tamanho"
                  ? [sql`coalesce(${bookmarks.fileSize}, octet_length(${bookmarks.content}), 0) desc`]
                  : [desc(bookmarks.createdAt)]),
          desc(bookmarks.id),
        )
        .limit(shown.pageSize)
        .offset(offsetOf(shown))
    : [];
  return {
    items: items.map(({ deletedAt, excerpt, tag, ...item }) => ({
      ...item,
      tag: isTag(tag) ? tag : null,
      ...(excerpt ? { excerpt } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      ...(deletedAt ? { deletedAt: deletedAt.toISOString() } : {}),
    })),
    trashCount: counts?.trash ?? 0,
    tags: tags.flatMap((t) => (isTag(t.tag) ? [{ tag: t.tag, count: t.count }] : [])).sort((a, b) => b.count - a.count),
    rootCount: counts?.root ?? 0,
    total: counts?.total ?? 0,
    matching,
    page: shown.page,
  };
}

/** Staff, or an active member of the company: who a company folder can be shared with. */
export async function personInScope(userId: string, companyId: string | null) {
  const [person] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  if (!person) return false;
  if (await hasConsoleStaffAccess(person.email)) return true;
  if (!companyId) return false;
  const emails = await getAccountEmails(userId, person.email);
  const [member] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.companyId, companyId),
        inArray(memberships.email, emails),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  return !!member;
}

/** Up to a few people matching a name, among the company's members and the team. */
export async function searchBookmarkPeople(
  scope: Scope,
  companyId: string | null,
  query: string,
  limit = 8,
) {
  const term = `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`;
  const columns = { id: user.id, name: user.name, image: user.image };
  const [members, staff] = await Promise.all([
    companyId
      ? db
          .select(columns)
          .from(memberships)
          .leftJoin(
            accountEmails,
            and(eq(accountEmails.email, memberships.email), isNotNull(accountEmails.verifiedAt)),
          )
          .innerJoin(
            user,
            or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)),
          )
          .where(
            and(
              eq(memberships.companyId, companyId),
              eq(memberships.active, true),
              ilike(user.name, term),
            ),
          )
          .limit(limit)
      : [],
    db
      .select(columns)
      .from(consoleStaffMembers)
      .leftJoin(
        accountEmails,
        and(
          eq(accountEmails.email, consoleStaffMembers.email),
          isNotNull(accountEmails.verifiedAt),
        ),
      )
      .innerJoin(
        user,
        or(eq(user.email, consoleStaffMembers.email), eq(user.id, accountEmails.userId)),
      )
      .where(and(eq(consoleStaffMembers.active, true), ilike(user.name, term)))
      .limit(limit),
  ]);
  const people = new Map<string, { id: string; name: string; image: string | null }>();
  for (const row of [...members, ...staff])
    if (row.id !== scope.userId && !people.has(row.id)) people.set(row.id, row);
  return [...people.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, limit);
}

export type BookmarkRecord = {
  id: string;
  title: string;
  companyId: string | null;
  folderId: string | null;
  ownerId: string;
  url: string | null;
  fileName: string | null;
  /** The whiteboard scene, as stored; null for links and files. */
  board: unknown;
  updatedAt: Date;
  folderName: string | null;
  /** Staff, the person who saved it, or the owner of its folder may change it. */
  editable: boolean;
};

/**
 * One bookmark, if the viewer may see it: in a company they can access (or
 * Anuntech's own space, for staff) and, inside a folder, one open to the
 * company, theirs, or shared with them. Null reads as "does not exist".
 * The same rule as `/api/bookmarks/[id]`, which downloads the file.
 */
export async function bookmarkFor(actor: Actor, bookmarkId: string, { trashed = false } = {}): Promise<BookmarkRecord | null> {
  const [item] = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      companyId: bookmarks.companyId,
      folderId: bookmarks.folderId,
      ownerId: bookmarks.ownerId,
      url: bookmarks.url,
      fileName: bookmarks.fileName,
      board: bookmarks.board,
      updatedAt: bookmarks.updatedAt,
      folderName: bookmarkFolders.name,
      folderVisibility: bookmarkFolders.visibility,
      folderOwner: bookmarkFolders.ownerId,
      folderOrigin: bookmarkFolders.origin,
      folderArea: bookmarkFolders.area,
      folderEngagement: bookmarkFolders.engagementId,
      sharedWithMe: bookmarkFolderShares.userId,
    })
    .from(bookmarks)
    .leftJoin(bookmarkFolders, eq(bookmarkFolders.id, bookmarks.folderId))
    .leftJoin(
      bookmarkFolderShares,
      and(
        eq(bookmarkFolderShares.folderId, bookmarks.folderId),
        eq(bookmarkFolderShares.userId, actor.user.id),
      ),
    )
    // An item in the trash does not open, download or change; only the trash's own actions reach it.
    .where(and(eq(bookmarks.id, bookmarkId), trashed ? isNotNull(bookmarks.deletedAt) : isNull(bookmarks.deletedAt)));
  if (!item) return null;
  const inCompany = item.companyId ? canAccess(actor, item.companyId, "overview") : actor.admin;
  const folderOpen =
    !item.folderVisibility ||
    item.folderVisibility === "company" ||
    item.folderOwner === actor.user.id ||
    !!item.sharedWithMe;
  // A gate on top (contracts, a project), as the list has it.
  const gated = gateOpen(gateViewerOf(actor), { companyId: item.companyId, area: item.folderArea, engagementId: item.folderEngagement });
  if (!actor.admin && !(inCompany && folderOpen && gated)) return null;
  // The owner of a folder the Console keeps does not edit what is in it for that.
  const folderOwner = item.folderOrigin ? null : item.folderOwner;
  return {
    id: item.id,
    title: item.title,
    companyId: item.companyId,
    folderId: item.folderId,
    ownerId: item.ownerId,
    url: item.url,
    fileName: item.fileName,
    board: item.board,
    updatedAt: item.updatedAt,
    folderName: item.folderName,
    editable: actor.admin || item.ownerId === actor.user.id || folderOwner === actor.user.id,
  };
}
