"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ForwardIcon,
  InboxIcon,
  MailIcon,
  OctagonAlertIcon,
  ReplyAllIcon,
  ReplyIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmAction, ServerForm, SubmitButton } from "@/components/console/server-form";
import { FileChip, FileChips } from "@/components/console/file-chip";
import { deleteForever, markUnread, moveEmail, toggleStar } from "@/lib/mail/mail-actions";
import { formatAddressList, fullDateLabel, type Address, type ComposeMode, type MoveTarget } from "@/lib/mail/mail-rules";
import type { FormAction } from "@/lib/action-state";
import type { MessageView } from "@/lib/mail/mailbox";
import { MessageBody } from "./message-body";

type Place = { caixa: string; pasta: string; q: string; pagina: number; single: boolean };

const placeFields = (place: Place, id: string) => ({
  caixa: place.caixa,
  pasta: place.pasta,
  q: place.q,
  pagina: String(place.pagina),
  single: place.single ? "1" : "",
  id,
});

/** One toolbar button that posts an action for the open message. */
function MessageAction({
  action,
  fields,
  label,
  icon,
  pressed,
  className,
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  icon: ReactNode;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <ServerForm action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant="ghost" size="icon-sm" aria-label={label} title={label} aria-pressed={pressed} className={className}>
        {icon}
      </SubmitButton>
    </ServerForm>
  );
}

function People({ label, list }: { label: string; list: Address[] }) {
  if (!list.length) return null;
  return (
    <p className="min-w-0 truncate text-sm text-muted-foreground" title={formatAddressList(list)}>
      <span className="text-foreground">{label}:</span> {formatAddressList(list)}
    </p>
  );
}

/**
 * The reading pane: headers, the actions, the attachments and the body.
 * The list's place (folder, search, page) travels with every action, so a
 * message that leaves the folder goes back to the same list.
 */
export function MessageReader({
  message,
  place,
  folderRole,
  backHref,
  backLabel,
  onCompose,
}: {
  message: MessageView;
  place: Place;
  folderRole: string | null;
  backHref: string;
  backLabel: string;
  onCompose: (mode: Exclude<ComposeMode, "new">) => void;
}) {
  const fields = placeFields(place, message.id);
  const sender = message.from[0];
  const inTrash = folderRole === "trash";
  const inJunk = folderRole === "junk";
  const move = (destino: MoveTarget, label: string, icon: ReactNode) => (
    <MessageAction action={moveEmail} fields={{ ...fields, destino }} label={label} icon={icon} />
  );
  return (
    <article className="flex min-h-0 flex-1 flex-col" aria-label={message.subject || "Mensagem sem assunto"}>
      <header className="flex flex-col gap-3 border-b px-4 py-4 sm:px-5">
        <Link href={backHref} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:hidden">
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>
        <h2 className="text-title-sm break-words text-foreground">{message.subject || "(sem assunto)"}</h2>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <p className="min-w-0 truncate text-sm">
              <span className="font-medium text-foreground">{sender?.name || sender?.email || "(sem remetente)"}</span>
              {sender?.name && <span className="text-muted-foreground"> &lt;{sender.email}&gt;</span>}
            </p>
            <People label="Para" list={message.to} />
            <People label="Cc" list={message.cc} />
            <People label="Cco" list={message.bcc} />
          </div>
          <time dateTime={message.sentAt ?? message.receivedAt} className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {fullDateLabel(message.sentAt ?? message.receivedAt)}
          </time>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Ações da mensagem">
          <Button type="button" variant="outline" size="sm" onClick={() => onCompose("reply")}>
            <ReplyIcon />
            Responder
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Responder a todos" title="Responder a todos" onClick={() => onCompose("replyAll")}>
            <ReplyAllIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Encaminhar" title="Encaminhar" onClick={() => onCompose("forward")}>
            <ForwardIcon />
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <MessageAction action={markUnread} fields={fields} label="Marcar como não lida" icon={<MailIcon />} />
          <MessageAction
            action={toggleStar}
            fields={{ ...fields, estrela: message.flagged ? "" : "1" }}
            label={message.flagged ? "Tirar a estrela" : "Marcar com estrela"}
            pressed={message.flagged}
            icon={<StarIcon className={cn(message.flagged && "fill-current text-warning")} />}
          />
          {folderRole !== "archive" && !inTrash && move("archive", "Arquivar", <ArchiveIcon />)}
          {inJunk || inTrash ? move("inbox", "Mover para a Entrada", <InboxIcon />) : move("junk", "Marcar como spam", <OctagonAlertIcon />)}
          {inTrash ? (
            <ConfirmAction
              action={deleteForever}
              fields={fields}
              title="Excluir de vez?"
              description="A mensagem sai da Lixeira e não pode ser recuperada."
              confirmLabel="Excluir de vez"
              destructive
            >
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2Icon />
                Excluir de vez
              </Button>
            </ConfirmAction>
          ) : (
            move("trash", "Mover para a Lixeira", <Trash2Icon />)
          )}
        </div>
        {message.attachments.length > 0 && (
          <FileChips>
            {message.attachments.map((file) => (
              <li key={file.blobId}>
                <FileChip
                  file={{ name: file.name, size: file.size, mime: file.type }}
                  href={`/api/email/anexo?caixa=${encodeURIComponent(place.caixa)}&blob=${encodeURIComponent(file.blobId)}&nome=${encodeURIComponent(file.name)}`}
                />
              </li>
            ))}
          </FileChips>
        )}
        {message.truncated && (
          <p className="text-xs text-muted-foreground">A mensagem é longa demais para mostrar inteira aqui.</p>
        )}
      </header>
      <MessageBody html={message.html} text={message.text} remoteImages={message.remoteImages} subject={message.subject} />
    </article>
  );
}
