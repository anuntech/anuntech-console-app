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
  consoleStaffMembers,
  memberships,
  user,
} from "@/db/schema";
import type { Actor } from "./access";
import { getAccountEmails } from "./account-identity";
import { hasConsoleStaffAccess } from "./console-members";
import { db } from "./db";
import { clampPage, DEFAULT_PAGE_SIZE, offsetOf, type PageQuery } from "./list-query";

/** What the viewer may see: staff sees every company; a member, their own. */
export type Scope = { admin: boolean; userId: string; companyIds: string[] };
export const scopeOf = (actor: Actor): Scope => ({
  admin: actor.admin,
  userId: actor.user.id,
  companyIds: actor.grants.map((g) => g.company.id),
});

export type FolderView = {
  id: string;
  name: string;
  companyId: string | null;
  company: string | null;
  ownerId: string;
  owner: string;
  visibility: "company" | "people";
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
  folderId: string | null;
  companyId: string | null;
  ownerId: string;
  createdAt: string;
};
/** `company`: "all", "internal" (Anuntech's own) or a company id. */
export type BookmarkQuery = { folder: string; search: string; company: string };

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
    folder: folder === "root" || UUID.test(folder) ? folder : "all",
    search: scalar("q").trim().slice(0, 160),
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
    .orderBy(asc(bookmarkFolders.name));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [counts, shares] = await Promise.all([
    db
      .select({ folderId: bookmarks.folderId, n: sql<number>`count(*)::int` })
      .from(bookmarks)
      .where(inArray(bookmarks.folderId, ids))
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
): Promise<{ items: BookmarkView[]; rootCount: number; total: number; matching: number; page: number }> {
  const visible = and(
    companyCondition(bookmarks.companyId, scope, query.company),
    or(isNull(bookmarks.folderId), folderIds.length ? inArray(bookmarks.folderId, folderIds) : sql`false`),
  );
  const narrowed =
    query.folder === "root"
      ? and(visible, isNull(bookmarks.folderId))
      : query.folder !== "all"
        ? folderIds.includes(query.folder)
          ? and(visible, eq(bookmarks.folderId, query.folder))
          : sql`false`
        : visible;
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const matchingWhere =
    and(
      narrowed,
      search
        ? or(ilike(bookmarks.title, `%${search}%`), ilike(bookmarks.url, `%${search}%`))
        : undefined,
    ) ?? sql`true`;
  // Counted first, so a page past the end (after a delete or a narrower search)
  // falls back to the last one instead of showing an empty list.
  const [counts] = await db
    .select({
      root: sql<number>`count(*) filter (where ${bookmarks.folderId} is null)::int`,
      total: sql<number>`count(*)::int`,
      matching: sql<number>`count(*) filter (where ${matchingWhere})::int`,
    })
    .from(bookmarks)
    .where(visible);
  const matching = counts?.matching ?? 0;
  const shown = clampPage(paging, matching);
  const items = matching
    ? await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          fileName: bookmarks.fileName,
          // octet_length reads the stored size without loading the bytes.
          fileSize: sql<number | null>`octet_length(${bookmarks.content})`,
          folderId: bookmarks.folderId,
          companyId: bookmarks.companyId,
          ownerId: bookmarks.ownerId,
          createdAt: bookmarks.createdAt,
        })
        .from(bookmarks)
        .where(matchingWhere)
        // The id breaks ties between bookmarks saved in the same instant, so no
        // row repeats or goes missing across pages.
        .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
        .limit(shown.pageSize)
        .offset(offsetOf(shown))
    : [];
  return {
    items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
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
