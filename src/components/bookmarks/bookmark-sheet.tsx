"use client";
import { useRef, useState, type ReactNode } from "react";
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
import { BOOKMARK_FILE, LARGE_BOOKMARK_FILE, limitLabel } from "@/lib/tickets/attachment-rules";
import { uploadToR2, type UploadProgress } from "./r2-upload";
import { FileVersions } from "./file-versions";
import type { BookmarkView, FolderView } from "@/lib/bookmarks/bookmarks";
import type { CompanyOption } from "./folder-dialogs";
import { fileSizeLabel } from "@/lib/format";
import { TAGS } from "@/lib/drive/tag-rules";

export type BookmarkEditor =
  | { mode: "create"; companyId: string; folderId: string }
  | { mode: "edit"; item: BookmarkView };

const kindsFor = (largeFiles: boolean): { value: BookmarkKind; label: string; hint: string; icon: ReactNode }[] => [
  { value: "link", label: "Link", hint: "Um endereço na web", icon: <LinkIcon /> },
  {
    value: "file",
    label: "Arquivo",
    hint: `Qualquer tipo, até ${limitLabel((largeFiles ? LARGE_BOOKMARK_FILE : BOOKMARK_FILE).maxBytes)}`,
    icon: <FileIcon />,
  },
  { value: "board", label: "Lousa", hint: "Um quadro para desenhar", icon: <PresentationIcon /> },
];

/** What stays as it is when editing: the file or the drawing. */
export function deleteNote(item: BookmarkView) {
  const kind = kindOf(item);
  return kind === "file" ? ", com o arquivo" : kind === "board" ? ", com o desenho" : "";
}

/** Create or edit: company, folder, title and a link, a small file or a new whiteboard. */
export function BookmarkSheet({
  editor,
  onClose,
  folders,
  companies,
  largeFiles = false,
}: {
  editor: BookmarkEditor | null;
  onClose: () => void;
  folders: FolderView[];
  companies: CompanyOption[];
  /** R2 is configured: a file goes straight to the bucket, up to 100 GB (lib/drive). */
  largeFiles?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const uploading = useRef<AbortController | null>(null);
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
  // Before the form posts: the file goes to R2 in parts and the form names the finished upload instead of carrying the bytes.
  const prepare =
    largeFiles && !item && kind === "file"
      ? async (form: FormData) => {
          const file = form.get("file");
          if (!(file instanceof File) || !file.size) return form;
          const controller = new AbortController();
          uploading.current = controller;
          setProgress({ sent: 0, total: file.size });
          try {
            const uploadId = await uploadToR2(
              file,
              { companyId: String(form.get("companyId") ?? ""), folderId: String(form.get("folderId") ?? "") },
              setProgress,
              controller.signal,
            );
            form.delete("file");
            form.set("uploadId", uploadId);
            return form;
          } finally {
            uploading.current = null;
            setProgress(null);
          }
        }
      : undefined;
  const close = () => {
    uploading.current?.abort();
    onClose();
  };
  return (
    <>
      <FormSheet
        open={editor !== null}
        onOpenChange={(open) => !open && close()}
        size="md"
        title={item ? "Editar bookmark" : kind === "board" ? "Nova lousa" : "Novo bookmark"}
        // Only what the fields do not say: a new board opens right away; a file or a drawing is not edited here.
        description={
          !item
            ? kind === "board"
              ? "A lousa abre em seguida."
              : undefined
            : itemKind === "file"
              ? "O arquivo fica como está."
              : itemKind === "board"
                ? "O desenho fica como está."
                : undefined
        }
        action={item ? updateBookmark : saveBookmark}
        prepare={prepare}
        onSuccess={onClose}
        formKey={item?.id ?? `new-${folderId}-${initialCompany}`}
        submitLabel={item ? "Salvar" : kind === "board" ? "Criar lousa" : "Adicionar bookmark"}
        pendingLabel={
          item
            ? "Salvando…"
            : kind === "board"
              ? "Criando…"
              : progress
                ? `Enviando ${Math.floor((progress.sent / Math.max(1, progress.total)) * 100)}%`
                : "Adicionando…"
        }
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
          largeFiles={largeFiles}
          progress={progress}
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
  largeFiles,
  progress,
}: {
  item: BookmarkView | null;
  kind: BookmarkKind;
  onKind: (kind: BookmarkKind) => void;
  initialCompany: string;
  folderId: string;
  folders: FolderView[];
  companies: CompanyOption[];
  largeFiles: boolean;
  progress: UploadProgress | null;
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
        itemKind === "file" ? (
          <>
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
            {largeFiles && <FileVersions item={item} />}
          </>
        ) : itemKind === "board" ? null : (
          linkField
        )
      ) : (
        <>
          {/* One of the three: the server takes a link, a file or starts a blank whiteboard. */}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-foreground">Tipo</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {kindsFor(largeFiles).map((option) => (
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
              <AttachmentField id="bookmark-file" name="file" rules={largeFiles ? LARGE_BOOKMARK_FILE : BOOKMARK_FILE} />
              {progress && (
                <div className="mt-2" role="status" aria-live="polite">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(progress.sent / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {fileSizeLabel(progress.sent)} de {fileSizeLabel(progress.total)} enviados. Não feche esta janela.
                  </p>
                </div>
              )}
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
      {item && (
        <FormField
          label="Etiqueta"
          htmlFor="bookmark-tag"
          hint={item.tagSource === "auto" && item.tag ? "Sugerida pelo Console a partir do nome e do conteúdo. Troque se não servir." : "Para filtrar a lista por tipo de documento."}
        >
          <NativeSelect id="bookmark-tag" name="tag" defaultValue={item.tag ?? ""}>
            <NativeSelectOption value="">Sem etiqueta</NativeSelectOption>
            {TAGS.map((tag) => (
              <NativeSelectOption key={tag.slug} value={tag.slug}>
                {tag.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      )}
    </>
  );
}
