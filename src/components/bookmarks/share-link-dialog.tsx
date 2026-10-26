"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CopyButton } from "@/components/console/copy-button";
import { FormField } from "@/components/console/form-field";
import { toast } from "@/components/shell/notifications";
import { createShareLink, listShareLinks, revokeShareLink } from "@/lib/drive/drive-actions";
import { DEFAULT_EXPIRY_DAYS, EXPIRY_CHOICES, shareStateLabels, type ShareKind, type ShareState } from "@/lib/drive/share-rules";
import { dateLabel } from "@/lib/format";

export type ShareTarget = { kind: ShareKind; bookmarkId?: string; folderId?: string; title: string };
type LinkRow = { id: string; kind: ShareKind; state: ShareState; createdAt: string; expiresAt: string | null; password: boolean; maxDownloads: number | null; downloads: number; uploads: number; by: string | null };

/**
 * "Compartilhar por link…" (a file or a folder) and "Pedir arquivos…" (a folder):
 * the options, the address once, and the links already made, to turn off.
 */
export function ShareLinkDialog({ target, onClose }: { target: ShareTarget | null; onClose: () => void }) {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [shown, setShown] = useState<ShareTarget | null>(null);
  if (target !== shown) {
    setShown(target);
    setUrl("");
    setError("");
    setLinks(null);
  }
  const load = useCallback(
    () => (target ? listShareLinks({ bookmarkId: target.bookmarkId, folderId: target.folderId }).then((rows) => rows ?? []) : Promise.resolve([])),
    [target],
  );
  useEffect(() => {
    let alive = true;
    load().then((rows) => alive && setLinks(rows as LinkRow[]));
    return () => {
      alive = false;
    };
  }, [load]);
  const request = target?.kind === "request";
  const create = (form: FormData) =>
    start(async () => {
      setError("");
      const result = await createShareLink({
        kind: target!.kind,
        bookmarkId: target!.bookmarkId ?? "",
        folderId: target!.folderId ?? "",
        expiresInDays: String(form.get("expiresInDays") ?? ""),
        password: String(form.get("password") ?? ""),
        maxDownloads: String(form.get("maxDownloads") ?? ""),
        email: String(form.get("email") ?? ""),
      });
      if (result.error || !result.url) return setError(result.error ?? "Não foi possível criar o link.");
      setUrl(result.url);
      toast.success(result.success ?? "Link criado.");
      setLinks((await load()) as LinkRow[]);
    });
  const revoke = (id: string) =>
    start(async () => {
      const result = await revokeShareLink(id);
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Link desligado.");
      setLinks((await load()) as LinkRow[]);
    });
  const active = (links ?? []).filter((l) => l.kind === target?.kind);
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{request ? `Pedir arquivos para “${target?.title}”` : `Compartilhar “${target?.title}” por link`}</DialogTitle>
          <DialogDescription>
            {request
              ? "Quem tiver o link envia arquivos para esta pasta, sem conta e sem ver o que já está nela."
              : target?.folderId
                ? "Quem tiver o link baixa os arquivos desta pasta e das pastas de dentro, sem conta."
                : "Quem tiver o link baixa este arquivo, sem conta."}
          </DialogDescription>
        </DialogHeader>
        {url ? (
          <div className="grid gap-3">
            <p className="m-0 text-sm text-foreground">Copie o endereço agora: por segurança, ele não aparece de novo.</p>
            <div className="flex gap-2">
              <Input readOnly value={url} aria-label="Endereço do link" onFocus={(event) => event.currentTarget.select()} />
              <CopyButton value={url} label="Link" variant="outline">
                Copiar
              </CopyButton>
            </div>
            <Button variant="outline" className="justify-self-start" onClick={() => setUrl("")}>
              Criar outro link
            </Button>
          </div>
        ) : (
          <form action={create} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Vale por" htmlFor="share-expiry">
                <NativeSelect id="share-expiry" name="expiresInDays" defaultValue={DEFAULT_EXPIRY_DAYS}>
                  {EXPIRY_CHOICES.map((choice) => (
                    <NativeSelectOption key={choice.label} value={choice.value}>
                      {choice.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              {!request && (
                <FormField label="Limite de downloads" htmlFor="share-max" hint="Vazio: sem limite.">
                  <Input id="share-max" name="maxDownloads" type="number" inputMode="numeric" min={1} max={10000} placeholder="Sem limite" />
                </FormField>
              )}
            </div>
            <FormField label="Senha" htmlFor="share-password-new" hint="Opcional. Mande a senha por outro canal.">
              <Input id="share-password-new" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={100} />
            </FormField>
            <FormField label="Enviar o link por e-mail" htmlFor="share-email" hint="Opcional: o Console manda o endereço para esta pessoa.">
              <Input id="share-email" name="email" type="email" maxLength={200} placeholder="nome@empresa.com.br" />
            </FormField>
            {error && <p className="m-0 text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending} className="justify-self-start">
              <LinkIcon />
              {pending ? "Criando…" : "Criar link"}
            </Button>
          </form>
        )}
        <section className="grid gap-2 border-t pt-4">
          <p className="m-0 text-sm font-medium text-foreground">Links criados</p>
          {links === null ? (
            <p className="m-0 text-xs text-muted-foreground">Carregando…</p>
          ) : !active.length ? (
            <p className="m-0 text-xs text-muted-foreground">Nenhum ainda.</p>
          ) : (
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {active.map((link) => (
                <li key={link.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-medium text-foreground">
                      {shareStateLabels[link.state]}
                      {link.password ? " · com senha" : ""}
                    </p>
                    <p className="m-0 text-muted-foreground">
                      {[
                        `criado em ${dateLabel(new Date(link.createdAt))}${link.by ? ` por ${link.by}` : ""}`,
                        link.expiresAt ? `vale até ${dateLabel(new Date(link.expiresAt))}` : "sem prazo",
                        request ? `${link.uploads} ${link.uploads === 1 ? "arquivo recebido" : "arquivos recebidos"}` : `${link.downloads}${link.maxDownloads ? ` de ${link.maxDownloads}` : ""} downloads`,
                      ].join(" · ")}
                    </p>
                  </div>
                  {link.state === "active" && (
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => revoke(link.id)}>
                      Desligar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
