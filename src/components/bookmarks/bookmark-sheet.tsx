"use client";
import { useState, type ReactNode } from "react";
import { FileIcon, LinkIcon, PresentationIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField } from "@/components/console/company-field";
import { AttachmentField } from "@/components/console/attachment-field";
import { FileChip, FileChips } from "@/components/console/file-chip";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { ConfirmDialog } from "@/components/console/server-form";
import { deleteBookmark, saveBookmark, updateBookmark } from "@/lib/bookmarks/bookmark-actions";
import { kindOf, type BookmarkKind } from "@/lib/bookmarks/board-rules";
import { BOOKMARK_FILE, limitLabel } from "@/lib/tickets/attachment-rules";
import type { BookmarkView, FolderView } from "@/lib/bookmarks/bookmarks";
import type { CompanyOption } from "./folder-dialogs";

export type BookmarkEditor =
  | { mode: "create"; companyId: string; folderId: string }
  | { mode: "edit"; item: BookmarkView };

const fileLimit = limitLabel(BOOKMARK_FILE.maxBytes);
const KINDS: { value: BookmarkKind; label: string; hint: string; icon: ReactNode }[] = [
  { value: "link", label: "Link", hint: "Um endereço na web", icon: <LinkIcon /> },
  { value: "file", label: "Arquivo", hint: `Qualquer tipo, até ${fileLimit}`, icon: <FileIcon /> },
  { value: "board", label: "Lousa", hint: "Um quadro para desenhar", icon: <PresentationIcon /> },
];

/** What stays as it is when editing: the file or the drawing. */
export function deleteNote(item: BookmarkView) {
  const kind = kindOf(item);
  return kind === "file" ? ", com o arquivo" : kind === "board" ? ", com o desenho" : kind === "meeting" ? ", com a nota" : "";
}

/** Create or edit: company, folder, title and a link, a small file or a new whiteboard. */
export function BookmarkSheet({
  editor,
  onClose,
  folders,
  companies,
}: {
  editor: BookmarkEditor | null;
  onClose: () => void;
  folders: FolderView[];
  companies: CompanyOption[];
}) {
  const [deleting, setDeleting] = useState(false);
  const [kind, setKind] = useState<BookmarkKind>("link");
  // The sheet keeps showing what it had while it slides out after closing.
  const [shown, setShown] = useState(editor);
  if (editor && editor !== shown) {
    setShown(editor);
    setKind("link");
  }
  const current = editor ?? shown;
  const item = current?.mode === "edit" ? current.item : null;
  const itemKind = item ? kindOf(item) : null;
  const initialCompany = item
    ? (item.companyId ?? "")
    : current?.mode === "create"
      ? current.companyId
      : "";
  const folderId = current?.mode === "create" ? current.folderId : (item?.folderId ?? "");
  return (
    <>
      <FormSheet
        open={editor !== null}
        onOpenChange={(open) => !open && onClose()}
        size="md"
        title={item ? "Editar bookmark" : kind === "board" ? "Nova lousa" : "Novo bookmark"}
        description={
          !item
            ? kind === "board"
              ? "Um quadro em branco para desenhar e anotar. Ele abre em seguida."
              : `Um link ou um arquivo de até ${fileLimit}.`
            : itemKind === "file" || itemKind === "meeting"
              ? "Mude o título ou a pasta; o arquivo fica como está."
              : itemKind === "board"
                ? "Mude o título ou a pasta; o desenho fica como está."
                : "Mude o título, o link ou a pasta."
        }
        action={item ? updateBookmark : saveBookmark}
        onSuccess={onClose}
        formKey={item?.id ?? `new-${folderId}-${initialCompany}`}
        submitLabel={item ? "Salvar" : kind === "board" ? "Criar lousa" : "Adicionar bookmark"}
        pendingLabel={item ? "Salvando…" : kind === "board" ? "Criando…" : "Adicionando…"}
        onDelete={item ? () => setDeleting(true) : undefined}
      >
        <BookmarkFields
          item={item}
          kind={kind}
          onKind={setKind}
          initialCompany={initialCompany}
          folderId={folderId}
          folders={folders}
          companies={companies}
        />
      </FormSheet>
      {item && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          action={deleteBookmark}
          fields={{ id: item.id }}
          title="Excluir bookmark?"
          description={`"${item.title}" sai da lista${deleteNote(item)}. Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          destructive
          onSuccess={onClose}
        />
      )}
    </>
  );
}

/** The fields, remounted with the form so the company starts fresh. */
function BookmarkFields({
  item,
  kind,
  onKind,
  initialCompany,
  folderId,
  folders,
  companies,
}: {
  item: BookmarkView | null;
  kind: BookmarkKind;
  onKind: (kind: BookmarkKind) => void;
  initialCompany: string;
  folderId: string;
  folders: FolderView[];
  companies: CompanyOption[];
}) {
  const [company, setCompany] = useState(initialCompany);
  const options = folders.filter((folder) => (folder.companyId ?? "") === company);
  const itemKind = item ? kindOf(item) : null;
  const linkField = (
    <FormField label="Link" htmlFor="bookmark-url">
      <Input
        id="bookmark-url"
        name="url"
        type="url"
        inputMode="url"
        required
        maxLength={2048}
        defaultValue={item?.url ?? ""}
        placeholder="https://"
      />
    </FormField>
  );
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      {!item &&
        (companies.length > 1 ? (
          <FormField label="Empresa" htmlFor="bookmark-company">
            <CompanyField
              id="bookmark-company"
              name="companyId"
              companies={companies}
              value={company}
              onChange={setCompany}
            />
          </FormField>
        ) : (
          <input type="hidden" name="companyId" value={companies[0]?.id ?? ""} />
        ))}
      <FormField label="Título" htmlFor="bookmark-title">
        <Input
          id="bookmark-title"
          name="title"
          required
          maxLength={160}
          autoFocus
          defaultValue={item?.title ?? ""}
          placeholder={kind === "board" && !item ? "Ex.: Fluxo do onboarding" : "Ex.: Identidade visual no Drive"}
        />
      </FormField>
      {item ? (
        itemKind === "file" || itemKind === "meeting" ? (
          <div>
            <p className="mb-1.5 text-sm leading-none font-medium">Arquivo</p>
            <FileChips>
              <li>
                <FileChip
                  file={{ name: item.fileName ?? item.title, size: item.fileSize }}
                  href={`/api/bookmarks/${item.id}`}
                />
              </li>
            </FileChips>
          </div>
        ) : itemKind === "board" ? (
          <p className="flex items-center gap-2 rounded-lg border bg-field px-3 py-2.5 text-sm text-muted-foreground">
            <PresentationIcon aria-hidden="true" className="size-4 shrink-0" />
            Lousa desenhada no Console.
          </p>
        ) : (
          linkField
        )
      ) : (
        <>
          {/* One of the three: the server takes a link, a file or starts a blank whiteboard. */}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-foreground">Tipo</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {KINDS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border bg-field px-3 py-2.5 text-sm transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={option.value}
                    className="sr-only"
                    checked={kind === option.value}
                    onChange={() => onKind(option.value)}
                  />
                  <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{option.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {kind === "link" ? (
            linkField
          ) : kind === "file" ? (
            <FormField label="Arquivo" htmlFor="bookmark-file">
              <AttachmentField id="bookmark-file" name="file" rules={BOOKMARK_FILE} />
            </FormField>
          ) : null}
        </>
      )}
      <FormField label="Pasta" htmlFor="bookmark-folder">
        <NativeSelect
          id="bookmark-folder"
          name="folderId"
          key={company}
          defaultValue={options.some((f) => f.id === folderId) ? folderId : ""}
        >
          <NativeSelectOption value="">Sem pasta</NativeSelectOption>
          {options.map((folder) => (
            <NativeSelectOption key={folder.id} value={folder.id}>
              {folder.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
    </>
  );
}
