import type { Metadata } from "next";
import { accessibleCompanies, getActor } from "@/lib/access";
import { bookmarkQuery, bookmarksFor, foldersFor, scopeOf } from "@/lib/bookmarks";
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
  const query = bookmarkQuery(await searchParams, scope);
  const folders = await foldersFor(scope, query.company);
  if (
    query.folder !== "all" &&
    query.folder !== "root" &&
    !folders.some((folder) => folder.id === query.folder)
  )
    query.folder = "all";
  const [{ items, rootCount, total }, companies] = await Promise.all([
    bookmarksFor(
      scope,
      folders.map((folder) => folder.id),
      query,
    ),
    actor.admin
      ? accessibleCompanies(actor).then((rows) => [
          { id: "", name: "Anuntech" },
          ...rows.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name })),
        ])
      : actor.grants.map((g) => ({ id: g.company.id, name: g.company.name })),
  ]);
  return (
    <BookmarksView
      data={{
        folders,
        items,
        query,
        counts: { root: rootCount, total },
        companies,
        viewer: { id: actor.user.id, admin: actor.admin },
      }}
    />
  );
}
