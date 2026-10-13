import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import type { BoardScene } from "@/lib/bookmarks/board-rules";
import { BoardEditor } from "@/components/bookmarks/board-editor";
export const metadata: Metadata = {
  title: "Lousa",
  description: "Um quadro para desenhar e anotar, guardado nos bookmarks da empresa.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A whiteboard bookmark, for whoever can see it; the rest draw only when they may edit it. */
export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const item = await bookmarkFor(actor, id);
  if (!item?.board) notFound();
  return (
    <BoardEditor
      data={{
        id: item.id,
        title: item.title,
        scene: item.board as BoardScene,
        editable: item.editable,
        folder: item.folderId && item.folderName ? { id: item.folderId, name: item.folderName } : null,
        updatedAt: item.updatedAt.toISOString(),
        now: new Date().toISOString(),
      }}
    />
  );
}
