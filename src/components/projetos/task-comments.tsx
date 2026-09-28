"use client";
import { useEffect, useRef, useState } from "react";
import { MessageSquareIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { EmptyState } from "@/components/console/page-header";
import { PersonAvatar, type PersonLike } from "@/components/console/person-avatar";
import { AttachmentField } from "@/components/console/attachment-field";
import { FileChip, FileChips } from "@/components/console/file-chip";
import { useStagedUploads } from "@/components/console/staged-uploads";
import { toast } from "@/components/notifications";
import { addTaskComment, deleteTaskComment, updateTaskComment } from "@/lib/task-actions";
import { relativeLabel } from "@/lib/format";

export type BoardComment = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: PersonLike & { id: string };
  files: { id: string; name: string; size: number; mime: string }[];
};

const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** A comment's text, edited in place: ⌘/Ctrl+Enter saves, Escape cancels. */
function CommentEditor({ comment, onDone }: { comment: BoardComment; onDone: () => void }) {
  return (
    <ServerForm action={updateTaskComment} quiet onSuccess={onDone} className="mt-1.5 block" data-escape-local="">
      <input type="hidden" name="id" value={comment.id} />
      <FormError className="mb-2" />
      <Textarea
        name="body"
        defaultValue={comment.body}
        maxLength={5000}
        rows={3}
        autoFocus
        aria-label="Editar comentário"
        className="min-h-20"
        onFocus={(event) => {
          const field = event.currentTarget;
          field.setSelectionRange(field.value.length, field.value.length);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onDone();
          } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton size="sm" pendingLabel="Salvando…">
          Salvar
        </SubmitButton>
      </div>
    </ServerForm>
  );
}

/**
 * A task's conversation, oldest first, with the composer pinned below: text,
 * files or both. Whoever wrote a comment edits it; they or the team can take
 * it back (its files go with it).
 */
export function TaskComments({
  taskId,
  comments,
  viewer,
  now,
}: {
  taskId: string;
  comments: BoardComment[];
  viewer: { id: string; admin: boolean };
  now: string;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const uploads = useStagedUploads();
  // Newest at the bottom, like a conversation: land there, and follow new ones.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [comments.length]);
  return (
    <>
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {comments.length ? (
          <ol className="m-0 grid list-none gap-5 p-0">
            {comments.map((comment) => {
              const mine = comment.author.id === viewer.id;
              const isEditing = editing === comment.id;
              return (
                <li key={comment.id} className="group flex gap-3">
                  <PersonAvatar person={comment.author} size={28} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {mine ? "Você" : comment.author.name}
                      </span>
                      <time
                        dateTime={comment.createdAt}
                        title={when(comment.createdAt)}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {relativeLabel(comment.createdAt, now)}
                      </time>
                      {comment.editedAt && (
                        <span title={`Editado em ${when(comment.editedAt)}`} className="shrink-0 text-xs text-muted-foreground">
                          · editado
                        </span>
                      )}
                      {(mine || viewer.admin) && !isEditing && (
                        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                          {mine && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Editar comentário"
                              className="text-muted-foreground"
                              onClick={() => setEditing(comment.id)}
                            >
                              <PencilIcon />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Excluir comentário"
                            className="text-muted-foreground"
                            onClick={() => setDeleting(comment.id)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <CommentEditor comment={comment} onDone={() => setEditing(null)} />
                    ) : (
                      comment.body && (
                        <p className="m-0 mt-1 text-sm leading-6 break-words whitespace-pre-wrap text-foreground">
                          {comment.body}
                        </p>
                      )
                    )}
                    {comment.files.length > 0 && (
                      <FileChips className="mt-2">
                        {comment.files.map((file) => (
                          <li key={file.id}>
                            <FileChip file={file} href={`/api/anexos/${file.id}`} />
                          </li>
                        ))}
                      </FileChips>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState
            icon={<MessageSquareIcon />}
            title="Nenhum comentário ainda"
            description="O que for combinado sobre esta tarefa fica registrado aqui."
            className="h-full"
          />
        )}
      </div>
      <ServerForm
        action={addTaskComment}
        prepare={uploads}
        reset
        quiet
        className="block border-t px-6 py-4"
        onSubmit={(event) => {
          const form = event.currentTarget;
          const body = (form.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
          const files = (form.elements.namedItem("files") as HTMLInputElement | null)?.files?.length;
          if (!body && !files) {
            event.preventDefault();
            toast.error("Escreva o comentário ou anexe um arquivo.");
          }
        }}
      >
        <input type="hidden" name="taskId" value={taskId} />
        <FormError className="mb-3" />
        <Textarea
          name="body"
          maxLength={5000}
          rows={3}
          aria-label="Comentário"
          placeholder="Escreva um comentário…"
          className="min-h-20"
          onKeyDown={(event) => {
            // ⌘/Ctrl + Enter sends; Enter alone breaks the line.
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <AttachmentField variant="compact" className="flex-1" />
          <SubmitButton pendingLabel="Publicando…">Comentar</SubmitButton>
        </div>
      </ServerForm>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        action={deleteTaskComment}
        fields={{ id: deleting ?? "" }}
        title="Excluir comentário?"
        description="O comentário sai da tarefa para todo mundo. Isso não pode ser desfeito."
        confirmLabel="Excluir"
        destructive
      />
    </>
  );
}
