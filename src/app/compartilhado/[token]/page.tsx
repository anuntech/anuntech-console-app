import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DownloadIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/console/status-page";
import { ShareFrame } from "@/components/arquivos/share-frame";
import { ShareUnlock } from "@/components/arquivos/share-unlock";
import { linkByToken, linkFiles, linkOwner, unlockCookieName, unlocked } from "@/lib/drive/share-links";
import { shareClosedText, shareState } from "@/lib/drive/share-rules";
import { fileSizeLabel } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = { title: "Arquivos compartilhados", robots: { index: false, follow: false, noarchive: true } };

/** A download link (Arquivos): the files it opens, for anyone with the address (and the password, when it has one). */
export default async function SharedFiles({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await linkByToken(token);
  if (!link || link.kind !== "download") notFound();
  const state = shareState(link);
  if (state !== "active")
    return <StatusPage art="busca" eyebrow="Link de arquivos" title="Este link não abre mais" description={shareClosedText[state]} />;
  const owner = await linkOwner(link);
  if (!unlocked(link, (await cookies()).get(unlockCookieName(link))?.value))
    return (
      // Before the password, not even the name of what was shared.
      <ShareFrame eyebrow={`${owner} compartilhou com você`} title="Arquivos protegidos por senha">
        <ShareUnlock token={token} />
      </ShareFrame>
    );
  const files = await linkFiles(link);
  const left = link.maxDownloads !== null ? link.maxDownloads - link.downloads : null;
  return (
    <ShareFrame
      eyebrow={`${owner} compartilhou com você`}
      title={link.title}
      description={[
        files.length === 1 ? "1 arquivo" : `${files.length} arquivos`,
        link.expiresAt ? `disponível até ${link.expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : null,
        left !== null ? `${left === 1 ? "resta 1 download" : `restam ${left} downloads`}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      {files.length ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-sm font-medium text-foreground">{file.title}</p>
                <p className="m-0 truncate text-xs text-muted-foreground">
                  {[file.path, file.fileName, file.fileSize ? fileSizeLabel(file.fileSize) : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <a href={`/compartilhado/${token}/arquivo/${file.id}`} download={file.fileName ?? undefined}>
                  <DownloadIcon />
                  Baixar
                </a>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">Ainda não há arquivos aqui.</p>
      )}
    </ShareFrame>
  );
}
