"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, RotateCcwIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/shell/notifications";
import { replaceBookmarkFile, restoreVersion } from "@/lib/bookmarks/bookmark-actions";
import { dateTimeLabel, fileSizeLabel } from "@/lib/format";
import type { BookmarkView } from "@/lib/bookmarks/bookmarks";
import { uploadToR2, type UploadProgress } from "./r2-upload";

type Version = { id: string; version: number; fileName: string; fileSize: number; createdAt: string; by: string | null };

/**
 * A file's versions, inside its edit sheet: "Enviar nova versão" replaces the
 * file and keeps the one before; each earlier version downloads or comes back.
 */
export function FileVersions({ item }: { item: BookmarkView }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [editable, setEditable] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const fetchVersions = useCallback(
    () =>
      fetch(`/api/bookmarks/${item.id}/versoes`, { cache: "no-store" }).then((res) =>
        res.ok ? (res.json() as Promise<{ editable: boolean; versions: Version[] }>) : { editable: false, versions: [] },
      ),
    [item.id],
  );
  const load = useCallback(async () => {
    const data = await fetchVersions();
    setVersions(data.versions);
    setEditable(data.editable);
  }, [fetchVersions]);
  useEffect(() => {
    let alive = true;
    fetchVersions().then((data) => {
      if (!alive) return;
      setVersions(data.versions);
      setEditable(data.editable);
    });
    return () => {
      alive = false;
    };
  }, [fetchVersions]);
  const send = async (file: File) => {
    setBusy(true);
    try {
      const uploadId = await uploadToR2(file, { companyId: item.companyId ?? "", folderId: item.folderId ?? "" }, setProgress, new AbortController().signal);
      const form = new FormData();
      form.set("id", item.id);
      form.set("uploadId", uploadId);
      const result = await replaceBookmarkFile({}, form);
      if (result.error) throw new Error(result.error);
      toast.success(result.success ?? "Nova versão salva.");
      router.refresh();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a nova versão.");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };
  const restore = async (version: Version) => {
    setBusy(true);
    const form = new FormData();
    form.set("id", version.id);
    const result = await restoreVersion({}, form);
    if (result.error) toast.error(result.error);
    else toast.success(result.success ?? "Versão restaurada.");
    router.refresh();
    await load();
    setBusy(false);
  };
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-sm font-medium text-foreground">Versões</p>
        {editable && (
          <>
            <input
              ref={input}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void send(file);
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <UploadIcon />
              {progress ? `Enviando ${Math.floor((progress.sent / Math.max(1, progress.total)) * 100)}%` : "Enviar nova versão"}
            </Button>
          </>
        )}
      </div>
      {versions === null ? (
        <p className="m-0 text-xs text-muted-foreground">Carregando…</p>
      ) : versions.length === 0 ? (
        <p className="m-0 text-xs text-muted-foreground">Este é o único arquivo. Uma nova versão guarda o atual aqui.</p>
      ) : (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate font-medium text-foreground">
                  Versão {version.version} · {version.fileName}
                </p>
                <p className="m-0 text-muted-foreground">
                  {fileSizeLabel(version.fileSize || 1)} · {dateTimeLabel(version.createdAt)}
                  {version.by ? ` · ${version.by}` : ""}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-xs" asChild>
                <a href={`/api/bookmarks/${item.id}/versoes/${version.id}`} download={version.fileName} aria-label={`Baixar a versão ${version.version}`} title="Baixar">
                  <DownloadIcon />
                </a>
              </Button>
              {editable && (
                <Button type="button" variant="ghost" size="icon-xs" disabled={busy} onClick={() => void restore(version)} aria-label={`Restaurar a versão ${version.version}`} title="Restaurar esta versão">
                  <RotateCcwIcon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
