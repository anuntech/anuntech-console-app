"use client";
import { useState, type ReactNode } from "react";
import { FileIcon, LinkIcon } from "lucide-react";
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
import { deleteBookmark, saveBookmark, updateBookmark } from "@/lib/bookmark-actions";
import { BOOKMARK_FILE, limitLabel } from "@/lib/attachment-rules";
import type { BookmarkView, FolderView } from "@/lib/bookmarks";
import type { CompanyOption } from "./folder-dialogs";

export type BookmarkEditor =
  | { mode: "create"; companyId: string; folderId: string }
  | { mode: "edit"; item: BookmarkView };

type Kind = "link" | "file";
const fileLimit = limitLabel(BOOKMARK_FILE.maxBytes);
const KINDS: { value: Kind; label: string; hint: string; icon: ReactNode }[] = [
  { value: "link", label: "Link", hint: "Um endereço na web", icon: <LinkIcon /> },
  { value: "file", label: "Arquivo", hint: `Qualquer tipo, até ${fileLimit}`, icon: <FileIcon /> },
];

/** Create or edit: company, folder, title and a link (or a small file when creating). */
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
  // The sheet keeps showing what it had while it slides out after closing.
  const [shown, setShown] = useState(editor);
  if (editor && editor !== shown) setShown(editor);
  const current = editor ?? shown;
  const item = current?.mode === "edit" ? current.item : null;
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
        title={item ? "Editar bookmark" : "Novo bookmark"}
        description={
          !item
            ? `Um link ou um arquivo de até ${fileLimit}.`
            : item.fileName
              ? "Mude o título ou a pasta; o arquivo fica como está."
              : "Mude o título, o link ou a pasta."
        }
        action={item ? updateBookmark : saveBookmark}
        onSuccess={onClose}
        formKey={item?.id ?? `new-${folderId}-${initialCompany}`}
        submitLabel={item ? "Salvar" : "Adicionar bookmark"}
        pendingLabel={item ? "Salvando…" : "Adicionando…"}
        onDelete={item ? () => setDeleting(true) : undefined}
      >
        <BookmarkFields
          item={item}
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
          description={`"${item.title}" sai da lista${item.fileName ? ", com o arquivo" : ""}. Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          destructive
          onSuccess={onClose}
        />
      )}
    </>
  );
}

/** The fields, remounted with the form so the company and the kind start fresh. */
function BookmarkFields({
  item,
  initialCompany,
  folderId,
  folders,
  companies,
}: {
  item: BookmarkView | null;
  initialCompany: string;
  folderId: string;
  folders: FolderView[];
  companies: CompanyOption[];
}) {
  const [company, setCompany] = useState(initialCompany);
  const [kind, setKind] = useState<Kind>("link");
  const options = folders.filter((folder) => (folder.companyId ?? "") === company);
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
          placeholder="Ex.: Identidade visual no Drive"
        />
      </FormField>
      {item ? (
        item.fileName ? (
          <div>
            <p className="mb-1.5 text-sm leading-none font-medium">Arquivo</p>
            <FileChips>
              <li>
                <FileChip
                  file={{ name: item.fileName, size: item.fileSize }}
                  href={`/api/bookmarks/${item.id}`}
                />
              </li>
            </FileChips>
          </div>
        ) : (
          linkField
        )
      ) : (
        <>
          {/* One or the other: the server takes a link or a file, never both. */}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-foreground">Tipo</legend>
            <div className="grid gap-2 sm:grid-cols-2">
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
                    onChange={() => setKind(option.value)}
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
          ) : (
            <FormField label="Arquivo" htmlFor="bookmark-file">
              <AttachmentField id="bookmark-file" name="file" rules={BOOKMARK_FILE} />
            </FormField>
          )}
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
