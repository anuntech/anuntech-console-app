"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  InboxIcon,
  MailOpenIcon,
  OctagonAlertIcon,
  PaperclipIcon,
  PencilLineIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader, EmptyState } from "@/components/console/page-header";
import { SearchField } from "@/components/console/search-field";
import { useFillViewport } from "@/components/console/fill-viewport";
import {
  composeDraft,
  formatAddressList,
  listDateLabel,
  MAIL_PAGE_SIZE,
  mailHref,
  senderLabel,
  type ComposeMode,
  type MailQuery,
} from "@/lib/mail/mail-rules";
import type { FolderView, MessageRow, MessageView } from "@/lib/mail/mailbox";
import { ComposeSheet, type ComposeState } from "./compose-sheet";
import { MessageReader } from "./message-reader";

export type MailData = {
  mailboxes: string[];
  caixa: string;
  folders: FolderView[];
  folderId: string;
  rows: MessageRow[];
  total: number;
  query: MailQuery;
  message: MessageView | null;
  now: string;
};

const FOLDER_ICONS: Record<string, LucideIcon> = {
  inbox: InboxIcon,
  drafts: FileTextIcon,
  sent: SendIcon,
  archive: ArchiveIcon,
  junk: OctagonAlertIcon,
  trash: Trash2Icon,
};

/** How often an open, visible tab looks for new messages. */
const REFRESH_MS = 60_000;

/**
 * The webmail: folders on the left, the list in the middle and the message
 * on the right on a computer; on a phone (and below 1024 px) one thing at a
 * time, the list or the message. The panes reach down to just above the dock
 * and scroll inside, so the page does not.
 */
export function MailView({ data }: { data: MailData }) {
  const router = useRouter();
  const single = data.mailboxes.length === 1;
  const place = { caixa: data.caixa, pasta: data.folderId, q: data.query.q, pagina: data.query.pagina };
  const href = useCallback(
    (patch: Partial<MailQuery>) => mailHref({ caixa: data.caixa, pasta: data.folderId, q: data.query.q, pagina: data.query.pagina, msg: "", ...patch }, { single }),
    [data.caixa, data.folderId, data.query.q, data.query.pagina, single],
  );
  const folder = data.folders.find((f) => f.id === data.folderId);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const composing = useRef(false);
  useEffect(() => {
    composing.current = composeOpen;
  }, [composeOpen]);

  // New messages: while the tab is visible, the page asks again every minute.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !composing.current) router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  const ref = useRef<HTMLDivElement>(null);
  const fit = useFillViewport(ref, { min: 420 });
  const reading = !!data.query.msg;
  const opened = (mode: Exclude<ComposeMode, "new">) => {
    const message = data.message!;
    setCompose({
      key: `${mode}:${message.id}:${Date.now()}`,
      draft: composeDraft(mode, { ...message, text: message.quote }, data.caixa),
      forwarded: mode === "forward" ? message.attachments : [],
    });
    setComposeOpen(true);
  };
  const newMessage = () => {
    setCompose({
      key: `new:${Date.now()}`,
      draft: { mode: "new", to: "", cc: "", subject: "", body: "", inReplyTo: [], references: [] },
      forwarded: [],
    });
    setComposeOpen(true);
  };
  const sentFolder = folder?.role === "sent" || folder?.role === "drafts";
  const from = (data.query.pagina - 1) * MAIL_PAGE_SIZE;
  const inbox = data.folders.find((f) => f.role === "inbox");

  return (
    <>
      <PageHeader
        title="E-mail"
        count={inbox?.unread || undefined}
        meta={[single ? data.caixa : null]}
        actions={
          <>
            {!single && (
              <NativeSelect
                aria-label="Caixa de e-mail"
                value={data.caixa}
                onChange={(event) => router.push(mailHref({ caixa: event.target.value }))}
                className="w-auto max-w-[16rem]"
              >
                {data.mailboxes.map((address) => (
                  <NativeSelectOption key={address} value={address}>
                    {address}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
            <Button type="button" onClick={newMessage}>
              <PencilLineIcon />
              Escrever
            </Button>
          </>
        }
      />
      <div
        ref={ref}
        data-fill-viewport=""
        style={fit ? { height: fit.height, marginBottom: fit.clearance || undefined } : { height: "max(420px, calc(100dvh - 172px))" }}
        className="reveal-fade grid min-h-0 grid-cols-1 overflow-hidden rounded-xl border bg-card shadow-card lg:grid-cols-[13rem_minmax(18rem,22rem)_minmax(0,1fr)]"
      >
        <nav aria-label="Pastas" className="hidden min-h-0 flex-col gap-0.5 overflow-y-auto border-r p-2 lg:flex">
          {data.folders.map((f) => {
            const Icon = FOLDER_ICONS[f.role ?? ""] ?? FolderIcon;
            const active = f.id === data.folderId;
            return (
              <Link
                key={f.id}
                href={href({ pasta: f.id, q: "", pagina: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                {f.unread > 0 && (
                  <span className="text-caption font-medium tabular-nums">
                    {f.unread}
                    <span className="sr-only"> não lidas</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <section
          aria-label={`Mensagens: ${folder?.name ?? "pasta"}`}
          className={cn("flex min-h-0 min-w-0 flex-col lg:border-r", reading && "max-lg:hidden")}
        >
          <div className="flex shrink-0 flex-col gap-2 border-b p-3">
            <NativeSelect
              aria-label="Pasta"
              value={data.folderId}
              onChange={(event) => router.push(href({ pasta: event.target.value, q: "", pagina: 1 }))}
              className="lg:hidden"
              size="sm"
            >
              {data.folders.map((f) => (
                <NativeSelectOption key={f.id} value={f.id}>
                  {f.unread ? `${f.name} (${f.unread})` : f.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <SearchField
              value={data.query.q}
              onChange={(q) => router.replace(href({ q, pagina: 1 }), { scroll: false })}
              placeholder="Buscar nesta pasta"
              className="max-w-none"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {data.rows.length === 0 ? (
              data.query.q ? (
                <EmptyState
                  size="compact"
                  art="busca"
                  title="Nada encontrado com essa busca"
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href={href({ q: "", pagina: 1 })}>Limpar busca</Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState size="compact" icon={<MailOpenIcon />} title="Nenhuma mensagem nesta pasta" />
              )
            ) : (
              <ul className="divide-y">
                {data.rows.map((row) => {
                  const active = row.id === data.query.msg;
                  return (
                    <li key={row.id}>
                      <Link
                        href={href({ msg: row.id })}
                        prefetch={false}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex flex-col gap-0.5 px-4 py-3 transition-colors",
                          active ? "bg-accent" : "hover:bg-secondary/60",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {!row.seen && <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                          <span className={cn("min-w-0 flex-1 truncate text-sm", row.seen ? "text-foreground" : "font-semibold text-foreground")}>
                            {sentFolder ? `Para: ${formatAddressList(row.to) || "(sem destinatário)"}` : senderLabel(row.from)}
                          </span>
                          {row.flagged && <StarIcon className="size-3.5 shrink-0 fill-current text-warning" aria-label="Com estrela" />}
                          {row.hasAttachment && <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Com anexo" />}
                          <time dateTime={row.receivedAt} className="shrink-0 text-caption text-muted-foreground tabular-nums">
                            {listDateLabel(row.receivedAt, new Date(data.now))}
                          </time>
                        </span>
                        <span className={cn("truncate text-sm", row.seen ? "text-foreground" : "font-semibold text-foreground")}>
                          {row.subject || "(sem assunto)"}
                        </span>
                        <span className="line-clamp-2 text-sm text-muted-foreground">{row.preview}</span>
                        {!row.seen && <span className="sr-only">Não lida.</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {data.total > MAIL_PAGE_SIZE && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 text-caption text-muted-foreground tabular-nums">
              <span>
                {from + 1}–{Math.min(from + MAIL_PAGE_SIZE, data.total)} de {data.total}
              </span>
              <span className="flex items-center gap-1">
                <Button asChild={data.query.pagina > 1} variant="ghost" size="icon-sm" disabled={data.query.pagina <= 1} aria-label="Página anterior">
                  {data.query.pagina > 1 ? (
                    <Link href={href({ pagina: data.query.pagina - 1 })}>
                      <ChevronLeftIcon />
                    </Link>
                  ) : (
                    <ChevronLeftIcon />
                  )}
                </Button>
                <Button
                  asChild={from + MAIL_PAGE_SIZE < data.total}
                  variant="ghost"
                  size="icon-sm"
                  disabled={from + MAIL_PAGE_SIZE >= data.total}
                  aria-label="Próxima página"
                >
                  {from + MAIL_PAGE_SIZE < data.total ? (
                    <Link href={href({ pagina: data.query.pagina + 1 })}>
                      <ChevronRightIcon />
                    </Link>
                  ) : (
                    <ChevronRightIcon />
                  )}
                </Button>
              </span>
            </div>
          )}
        </section>

        <section aria-label="Leitura" className={cn("flex min-h-0 min-w-0 flex-col", !reading && "max-lg:hidden")}>
          {data.message ? (
            <MessageReader
              message={data.message}
              place={{ ...place, single }}
              folderRole={folder?.role ?? null}
              backHref={href({})}
              backLabel={`Voltar para ${folder?.name ?? "a pasta"}`}
              onCompose={opened}
            />
          ) : reading ? (
            <EmptyState
              size="compact"
              art="busca"
              title="Essa mensagem não está mais aqui"
              description="Ela pode ter sido movida ou excluída."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href={href({})}>Voltar para {folder?.name ?? "a pasta"}</Link>
                </Button>
              }
              className="my-auto"
            />
          ) : (
            <EmptyState size="compact" icon={<MailOpenIcon />} title="Escolha uma mensagem para ler" className="my-auto" />
          )}
        </section>
      </div>
      <ComposeSheet caixa={data.caixa} open={composeOpen} state={compose} onOpenChange={setComposeOpen} />
    </>
  );
}
