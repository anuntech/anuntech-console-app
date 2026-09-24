import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
  bookmarkFolderShares,
  bookmarkFolders,
  bookmarks,
  consoleStaffMembers,
  memberships,
  accountEmails,
  user,
} from "@/db/schema";
import type { Actor } from "./access";
import { db } from "./db";
import { isNotNull } from "drizzle-orm";

export type FolderView = {
  id: string;
  name: string;
  ownerId: string;
  owner: string;
  /** People the folder is shared with (owner's folders only). */
  sharedWith: { id: string; name: string; image: string | null }[];
  count: number;
};
export type BookmarkView = {
  id: string;
  title: string;
  url: string | null;
  fileName: string | null;
  folderId: string | null;
  ownerId: string;
  createdAt: string;
};
export type BookmarkQuery = { folder: string; search: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function bookmarkQuery(params: Record<string, string | string[] | undefined>): BookmarkQuery {
  const scalar = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const folder = scalar("pasta");
  return {
    folder: folder === "root" || UUID.test(folder) ? folder : "all",
    search: scalar("q").trim().slice(0, 160),
  };
}

/** Folders the person owns or was given, with counts. */
export async function foldersFor(userId: string): Promise<FolderView[]> {
  const rows = await db
    .select({
      id: bookmarkFolders.id,
      name: bookmarkFolders.name,
      ownerId: bookmarkFolders.ownerId,
      owner: user.name,
    })
    .from(bookmarkFolders)
    .innerJoin(user, eq(user.id, bookmarkFolders.ownerId))
    .leftJoin(
      bookmarkFolderShares,
      and(
        eq(bookmarkFolderShares.folderId, bookmarkFolders.id),
        eq(bookmarkFolderShares.userId, userId),
      ),
    )
    .where(or(eq(bookmarkFolders.ownerId, userId), eq(bookmarkFolderShares.userId, userId)))
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
    ...row,
    sharedWith: shares
      .filter((share) => share.folderId === row.id)
      .map(({ id, name, image }) => ({ id, name, image })),
    count: countOf.get(row.id) ?? 0,
  }));
}

/** Everything the person can see, narrowed by folder and search. */
export async function bookmarksFor(
  userId: string,
  folderIds: string[],
  query: BookmarkQuery,
): Promise<{ items: BookmarkView[]; rootCount: number; total: number }> {
  const visible = or(
    and(eq(bookmarks.ownerId, userId), isNull(bookmarks.folderId)),
    folderIds.length ? inArray(bookmarks.folderId, folderIds) : sql`false`,
  );
  const scope =
    query.folder === "root"
      ? and(eq(bookmarks.ownerId, userId), isNull(bookmarks.folderId))
      : query.folder !== "all"
        ? folderIds.includes(query.folder)
          ? eq(bookmarks.folderId, query.folder)
          : sql`false`
        : visible;
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const [items, [counts]] = await Promise.all([
    db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        fileName: bookmarks.fileName,
        folderId: bookmarks.folderId,
        ownerId: bookmarks.ownerId,
        createdAt: bookmarks.createdAt,
      })
      .from(bookmarks)
      .where(
        and(
          scope,
          search
            ? or(ilike(bookmarks.title, `%${search}%`), ilike(bookmarks.url, `%${search}%`))
            : undefined,
        ),
      )
      .orderBy(desc(bookmarks.createdAt))
      .limit(500),
    db
      .select({
        root: sql<number>`count(*) filter (where ${bookmarks.folderId} is null)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(bookmarks)
      .where(visible),
  ]);
  return {
    items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    rootCount: counts?.root ?? 0,
    total: counts?.total ?? 0,
  };
}

/** Who a folder can be shared with: colleagues in the same companies and the Anuntech team. */
export async function bookmarkPeople(actor: Actor) {
  const columns = { id: user.id, name: user.name, image: user.image };
  const companyIds = actor.grants.map((g) => g.company.id);
  const [members, staff] = await Promise.all([
    actor.admin || companyIds.length
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
              eq(memberships.active, true),
              actor.admin ? undefined : inArray(memberships.companyId, companyIds),
            ),
          )
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
      .where(eq(consoleStaffMembers.active, true)),
  ]);
  const people = new Map<string, { id: string; name: string; image: string | null }>();
  for (const row of [...staff, ...members])
    if (row.id !== actor.user.id && !people.has(row.id)) people.set(row.id, row);
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
