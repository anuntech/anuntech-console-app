import type { Metadata } from "next";
import { accessibleCompanies, getActor } from "@/lib/access/access";
import { bookmarkQuery, bookmarksFor, foldersFor, scopeOf } from "@/lib/bookmarks/bookmarks";
import { pageCountOf, pageQuery } from "@/lib/list-query";
import { listLayoutFor } from "@/lib/list-layout-server";
import { BookmarksView } from "@/components/bookmarks/bookmarks-view";
import { storageConfigured } from "@/lib/drive/r2";
import { spacesFor } from "@/lib/drive/uploads";
export const metadata: Metadata = {
  title: "Arquivos",
  description: "Arquivos, links e lousas de cada empresa, em pastas abertas ou compartilhadas.",
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
  const view = await listLayoutFor("bookmarks");
  const folders = await foldersFor(scope, query.company);
  if (
    query.folder !== "all" &&
    query.folder !== "root" &&
    query.folder !== "lixeira" &&
    !folders.some((folder) => folder.id === query.folder)
  )
    query.folder = "all";
  const [{ items, rootCount, total, matching, page, trashCount, tags }, companies] = await Promise.all([
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
  // The space meter: the team sees Anuntech's own and the company it filtered; a client, each of its companies.
  const spaces = await spacesFor(
    actor.admin
      ? [null, ...(query.company !== "all" && query.company !== "internal" ? [query.company] : [])]
      : actor.grants.map((g) => g.company.id),
  );
  return (
    <BookmarksView
      data={{
        folders,
        items,
        query,
        counts: { root: rootCount, total, trash: trashCount },
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
        largeFiles: storageConfigured(),
        spaces,
        tags,
      }}
    />
  );
}
