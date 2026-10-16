import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { DownloadIcon, FolderIcon } from "lucide-react";
import { bookmarks, companies } from "@/db/schema";
import { db } from "@/lib/db";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { parseNote, splitNote, transcriptLines } from "@/lib/bookmarks/note-markdown";
import { meetingInfo } from "@/lib/meetings/meeting-rules";
import { durationLabel } from "@/lib/meetings/meeting-format";
import { dateTimeLabel } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionTitle } from "@/components/console/page-header";
import { DownloadLink } from "@/components/console/download-link";
import { NoteBody, TranscriptBody } from "@/components/bookmarks/meeting-note";
export const metadata: Metadata = {
  title: "Nota de reunião",
  description: "Resumo, decisões, próximos passos e a transcrição de uma reunião gravada no Mac.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A meeting note from the Mac app, for whoever can see the bookmark (the same rule as its download). */
export default async function MeetingNotePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const item = await bookmarkFor(actor, id);
  const meeting = item ? meetingInfo(item.meeting) : null;
  if (!item || !meeting || !item.fileName) notFound();
  const [[file], [company]] = await Promise.all([
    db.select({ content: bookmarks.content }).from(bookmarks).where(eq(bookmarks.id, item.id)),
    item.companyId
      ? db.select({ name: companies.name }).from(companies).where(eq(companies.id, item.companyId))
      : Promise.resolve([{ name: "Anuntech" }]),
  ]);
  const markdown = file?.content ? file.content.toString("utf8") : "";
  const { notes, transcript } = splitNote(markdown);
  const blocks = parseNote(notes);
  // The header already says the title, date and length: the note starts at its first section.
  const firstSection = blocks.findIndex((block) => block.type === "heading" && block.level > 1);
  const body = firstSection > 0 ? blocks.slice(firstSection) : blocks;
  const lines = transcript ? transcriptLines(transcript) : [];
  const folderHref = item.folderId ? `/bookmarks?pasta=${item.folderId}` : "/bookmarks";
  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Bookmarks", href: "/bookmarks" },
          ...(item.folderId && item.folderName ? [{ label: item.folderName, href: folderHref }] : []),
          { label: "Nota de reunião" },
        ]}
        title={item.title}
        description={[dateTimeLabel(new Date(meeting.startedAt)), durationLabel(meeting.durationSeconds), company?.name]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {item.folderId && item.folderName && (
              <Button asChild variant="ghost">
                <Link href={folderHref}>
                  <FolderIcon />
                  {item.folderName}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <DownloadLink href={`/api/bookmarks/${item.id}`} filename={item.fileName}>
                <DownloadIcon />
                Baixar .md
              </DownloadLink>
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent>
            {body.length ? (
              <NoteBody blocks={body} />
            ) : (
              <p className="text-sm text-muted-foreground">Esta nota não tem resumo.</p>
            )}
          </CardContent>
        </Card>
        {lines.length > 0 && (
          <Card>
            <details className="group">
              <summary className="cursor-pointer list-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-4 px-6">
                  <SectionTitle
                    title="Transcrição"
                    description={`${lines.length} ${lines.length === 1 ? "trecho" : "trechos"}, na ordem em que foram ditos.`}
                  />
                  <span className="shrink-0 text-sm font-medium text-primary group-open:hidden">Mostrar</span>
                  <span className="hidden shrink-0 text-sm font-medium text-primary group-open:inline">Ocultar</span>
                </div>
              </summary>
              <CardContent className="pt-6">
                <TranscriptBody lines={lines} />
              </CardContent>
            </details>
          </Card>
        )}
      </div>
    </>
  );
}
