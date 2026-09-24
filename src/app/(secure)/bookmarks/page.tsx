import type { Metadata } from "next";
import { getActor } from "@/lib/access";
import {
  bookmarkPeople,
  bookmarkQuery,
  bookmarksFor,
  foldersFor,
} from "@/lib/bookmarks";
import { BookmarksView } from "@/components/bookmarks/bookmarks-view";
export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Links e arquivos guardados, em pastas suas ou compartilhadas.",
};

export default async function Bookmarks({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const query = bookmarkQuery(await searchParams);
  const folders = await foldersFor(actor.user.id);
  if (
    query.folder !== "all" &&
    query.folder !== "root" &&
    !folders.some((folder) => folder.id === query.folder)
  )
    query.folder = "all";
  const [{ items, rootCount, total }, people] = await Promise.all([
    bookmarksFor(
      actor.user.id,
      folders.map((folder) => folder.id),
      query,
    ),
    bookmarkPeople(actor),
  ]);
  return (
    <BookmarksView
      data={{
        folders,
        items,
        query,
        counts: { root: rootCount, total },
        people,
        viewerId: actor.user.id,
      }}
    />
  );
}
