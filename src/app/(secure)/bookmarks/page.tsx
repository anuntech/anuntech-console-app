import type { Metadata } from "next";
import { cookies } from "next/headers";
import { accessibleCompanies, getActor } from "@/lib/access/access";
import { bookmarkQuery, bookmarksFor, foldersFor, scopeOf } from "@/lib/bookmarks/bookmarks";
import { pageCountOf, pageQuery } from "@/lib/list-query";
import { BOOKMARK_VIEW_COOKIE, parseBookmarkView } from "@/lib/bookmarks/bookmark-view";
import { BookmarksView } from "@/components/bookmarks/bookmarks-view";
export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Links e arquivos de cada empresa, em pastas abertas ou compartilhadas.",
};

export default async function Bookmarks({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const scope = scopeOf(actor);
  const params = await searchParams;
  const query = bookmarkQuery(params, scope);
  const paging = pageQuery(params);
  // Read on the server so the chosen layout renders at once, without a flash of the other one.
  const view = parseBookmarkView((await cookies()).get(BOOKMARK_VIEW_COOKIE)?.value);
  const folders = await foldersFor(scope, query.company);
  if (
    query.folder !== "all" &&
    query.folder !== "root" &&
    !folders.some((folder) => folder.id === query.folder)
  )
    query.folder = "all";
  const [{ items, rootCount, total, matching, page }, companies] = await Promise.all([
    bookmarksFor(
      scope,
      folders.map((folder) => folder.id),
      query,
      paging,
    ),
    actor.admin
      ? accessibleCompanies(actor).then((rows) => [
          { id: "", name: "Anuntech" },
          ...rows.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, document: c.document })),
        ])
      : actor.grants.map((g) => ({ id: g.company.id, name: g.company.name, document: g.company.document })),
  ]);
  return (
    <BookmarksView
      data={{
        folders,
        items,
        query,
        counts: { root: rootCount, total },
        paging: {
          page,
          pageSize: paging.pageSize,
          total: matching,
          pageCount: pageCountOf(matching, paging.pageSize),
        },
        now: new Date().toISOString(),
        view,
        companies,
        viewer: { id: actor.user.id, admin: actor.admin },
      }}
    />
  );
}
