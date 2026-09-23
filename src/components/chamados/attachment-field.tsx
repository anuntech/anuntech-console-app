"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { fileSizeLabel } from "@/lib/format";

const ACCEPT = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_TOTAL = 20 * 1024 * 1024;

/**
 * Picks files for a ticket. The real <input type="file"> stays in the form
 * (server actions and the upload hook read it); the visible part is either a
 * drop area (new ticket) or a plain "Anexar" button (reply composer).
 */
export function AttachmentField({
  name = "files",
  max = 5,
  variant = "dropzone",
  className,
}: {
  name?: string;
  max?: number;
  variant?: "dropzone" | "compact";
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const hintId = useId();
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
    const next = [...files, ...incoming].filter(
      (file, index, all) =>
        all.findIndex(
          (other) =>
            other.name === file.name &&
            other.size === file.size &&
            other.lastModified === file.lastModified,
        ) === index,
    );
    if (next.some((file) => !ACCEPT.includes(file.type))) {
      setError("Envie PDF, PNG, JPEG ou WebP.");
      sync(files);
      return;
    }
    if (
      next.length > max ||
      next.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL
    ) {
      setError(`Até ${max} arquivos, com 20 MB no total.`);
      sync(files);
      return;
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
      name={name}
      type="file"
      multiple={max > 1}
      accept={ACCEPT.join(",")}
      className="sr-only"
      tabIndex={variant === "compact" ? -1 : undefined}
      aria-label="Adicionar anexos"
      aria-describedby={hintId}
      aria-invalid={!!error || undefined}
      onChange={(event) => add(Array.from(event.currentTarget.files || []))}
    />
  );
  const list = files.length > 0 && (
    <ul className="flex flex-wrap gap-2">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${file.lastModified}`}
          className="flex max-w-full items-center gap-1.5 rounded-md border bg-card py-1 pr-1 pl-2.5 text-xs"
        >
          {file.type.startsWith("image/") ? (
            <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="max-w-[14rem] truncate font-medium text-foreground">
            {file.name}
          </span>
          <span className="text-muted-foreground">{fileSizeLabel(file.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remover ${file.name}`}
            onClick={() => {
              sync(files.filter((_, i) => i !== index));
              setError("");
            }}
          >
            <XIcon />
          </Button>
        </li>
      ))}
    </ul>
  );
  const feedback = error && (
    <p role="alert" className="text-xs text-destructive">
      {error}
    </p>
  );
  if (variant === "compact")
    return (
      <div
        className={cn("flex min-w-0 flex-col gap-2", className)}
        data-dragging={dragging || undefined}
        {...dropProps}
      >
        {field}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => input.current?.click()}
          >
            <PaperclipIcon />
            Anexar
          </Button>
          <span id={hintId} className="sr-only">
            PDF, PNG, JPEG ou WebP. Até {max} arquivos, 20 MB no total.
          </span>
          {list}
        </div>
        {feedback}
      </div>
    );
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <label
        data-dragging={dragging || undefined}
        className="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-field px-4 py-6 text-center transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-primary/50 hover:bg-accent/40 data-[dragging]:border-primary data-[dragging]:bg-accent"
        {...dropProps}
      >
        {field}
        <UploadCloudIcon className="mb-1 size-5 text-muted-foreground transition-colors group-hover:text-primary" />
        <span className="text-sm font-medium text-foreground">
          {dragging
            ? "Solte os arquivos aqui"
            : "Arraste arquivos ou clique para selecionar"}
        </span>
        <span id={hintId} className="text-xs text-muted-foreground">
          PDF, PNG, JPEG ou WebP · até {max} arquivos, 20 MB no total
        </span>
      </label>
      {list}
      {feedback}
    </div>
  );
}
