"use client";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { PaperclipIcon, UploadCloudIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { FileChip, FileChips } from "@/components/console/file-chip";
import { fileSizeLabel } from "@/lib/format";

/** What a field accepts. Entries in `accept` are MIME types or extensions (".md"). */
export type AttachmentRules = {
  /** Omit to accept any kind of file. */
  accept?: string[];
  /** How the accepted kinds read to people, e.g. "PDF, PNG, JPEG ou WebP". */
  acceptLabel?: string;
  /** Files at once; 1 turns the field into a single-file picker that replaces on a new pick. */
  max: number;
  /** Total bytes across the files. */
  maxBytes: number;
};

/** Tickets and tasks: documents and pictures, up to 5 files and 20 MB. */
export const DOCUMENT_ATTACHMENTS: AttachmentRules = {
  accept: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  acceptLabel: "PDF, PNG, JPEG ou WebP",
  max: 5,
  maxBytes: 20 * 1024 * 1024,
};

/** Limits read as round numbers: "20 MB", not "20,0 MB". */
const limitLabel = (bytes: number) => fileSizeLabel(bytes).replace(",0 MB", " MB");

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
};
const accepted = (file: File, accept?: string[]) =>
  !accept?.length || accept.includes(file.type) || accept.includes(extensionOf(file.name));

/** The hint under the field, from the rules. */
export function attachmentHint({ acceptLabel, max, maxBytes }: AttachmentRules) {
  const size = limitLabel(maxBytes);
  const kinds = acceptLabel ? `${acceptLabel} · ` : "";
  return max > 1 ? `${kinds}até ${max} arquivos, ${size} no total` : `${kinds}até ${size}`;
}

/**
 * The one file picker of the Console. The real <input type="file"> stays in
 * the form, so server actions and upload hooks read it as usual; what people
 * see is a drop area (forms and sheets) or an "Anexar" button (composers),
 * with the picked files as chips they can remove before sending.
 */
export function AttachmentField({
  id,
  name = "files",
  rules = DOCUMENT_ATTACHMENTS,
  variant = "dropzone",
  className,
  "aria-describedby": describedBy,
}: {
  id?: string;
  name?: string;
  rules?: AttachmentRules;
  variant?: "dropzone" | "compact";
  className?: string;
  "aria-describedby"?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const hintId = useId();
  const single = rules.max <= 1;
  const hint = attachmentHint(rules);
  useEffect(() => {
    const form = input.current?.form;
    const clear = () => {
      setFiles([]);
      setError("");
    };
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);
  function sync(next: File[]) {
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    if (input.current) input.current.files = transfer.files;
    setFiles(next);
  }
  function add(incoming: File[]) {
    if (!incoming.length) return sync(files);
    const next = (single ? incoming.slice(0, 1) : [...files, ...incoming]).filter(
      (file, index, all) =>
        all.findIndex((other) => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index,
    );
    if (next.some((file) => !accepted(file, rules.accept))) {
      setError(rules.acceptLabel ? `Envie ${rules.acceptLabel}.` : "Esse tipo de arquivo não é aceito.");
      return sync(files);
    }
    if (next.length > rules.max || next.reduce((sum, file) => sum + file.size, 0) > rules.maxBytes) {
      setError(single ? `Escolha um arquivo de até ${limitLabel(rules.maxBytes)}.` : `Até ${rules.max} arquivos, com ${limitLabel(rules.maxBytes)} no total.`);
      return sync(files);
    }
    setError("");
    sync(next);
  }
  const dropProps = {
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      add(Array.from(event.dataTransfer.files));
    },
  };
  const field = (
    <input
      ref={input}
      id={id}
      name={name}
      type="file"
      multiple={!single}
      accept={rules.accept?.join(",")}
      className="sr-only"
      tabIndex={variant === "compact" ? -1 : undefined}
      aria-label={single ? "Escolher arquivo" : "Adicionar anexos"}
      aria-describedby={[hintId, describedBy].filter(Boolean).join(" ")}
      aria-invalid={!!error || undefined}
      onChange={(event) => add(Array.from(event.currentTarget.files || []))}
    />
  );
  const list = files.length > 0 && (
    <FileChips>
      {files.map((file, index) => (
        <li key={`${file.name}-${file.lastModified}`}>
          <FileChip
            file={{ name: file.name, size: file.size, mime: file.type }}
            onRemove={() => {
              sync(files.filter((_, i) => i !== index));
              setError("");
            }}
          />
        </li>
      ))}
    </FileChips>
  );
  const feedback = error && (
    <p role="alert" className="text-xs text-destructive">
      {error}
    </p>
  );
  if (variant === "compact")
    return (
      <div className={cn("flex min-w-0 flex-col gap-2", className)} data-dragging={dragging || undefined} {...dropProps}>
        {field}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <PaperclipIcon />
            Anexar
          </Button>
          <span id={hintId} className="sr-only">
            {hint}
          </span>
          {list}
        </div>
        {feedback}
      </div>
    );
  const prompt = dragging
    ? single
      ? "Solte o arquivo aqui"
      : "Solte os arquivos aqui"
    : single
      ? files.length
        ? "Arraste outro arquivo ou clique para trocar"
        : "Arraste um arquivo ou clique para selecionar"
      : "Arraste arquivos ou clique para selecionar";
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <label
        data-dragging={dragging || undefined}
        className="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-field px-4 py-6 text-center transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-primary/50 hover:bg-accent/40 data-[dragging]:border-primary data-[dragging]:bg-accent"
        {...dropProps}
      >
        {field}
        <UploadCloudIcon className="mb-1 size-5 text-muted-foreground transition-colors group-hover:text-primary" />
        <span className="text-sm font-medium text-foreground">{prompt}</span>
        <span id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </span>
      </label>
      {list}
      {feedback}
    </div>
  );
}
