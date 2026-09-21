"use client";
import { useEffect, useId, useRef, useState } from "react";
import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import styles from "./attachment-picker.module.css";
export function AttachmentPicker({
  name = "files",
  multiple = true,
  required = false,
}: {
  name?: string;
  multiple?: boolean;
  required?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => {
      setFiles([]);
      setError("");
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  function sync(next: File[]) {
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    if (input.current) input.current.files = transfer.files;
    setFiles(next);
  }
  function add(incoming: File[]) {
    const next = multiple
      ? [...files, ...incoming].filter(
          (file, index, all) =>
            all.findIndex(
              (other) =>
                other.name === file.name &&
                other.size === file.size &&
                other.lastModified === file.lastModified,
            ) === index,
        )
      : incoming.slice(0, 1);
    if (
      next.length > (multiple ? 5 : 1) ||
      next.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024
    ) {
      setError(
        `Selecione ${multiple ? "até 5 arquivos" : "um arquivo"}, com até 20 MB no total.`,
      );
      sync(files);
      return;
    }
    if (
      next.some(
        (file) =>
          ![
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
          ].includes(file.type),
      )
    ) {
      setError("Selecione PDF, PNG, JPEG ou WebP.");
      sync(files);
      return;
    }
    setError("");
    sync(next);
  }
  return (
    <div className={styles.root}>
      <label
        className={styles.drop}
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={input}
          name={name}
          type="file"
          multiple={multiple}
          required={required}
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className={styles.input}
          aria-label={multiple ? "Adicionar anexos" : "Adicionar arquivo"}
          aria-describedby={`${id}-hint`}
          aria-invalid={!!error}
          onChange={(event) => add(Array.from(event.currentTarget.files || []))}
        />
        <span className={styles.icons} aria-hidden="true">
          <span><ImageIcon size={20} /></span>
          <span><FileText size={20} /></span>
          <span><UploadCloud size={20} /></span>
        </span>
        <strong>{dragging ? "Solte os arquivos aqui" : "Arraste seus arquivos para cá"}</strong>
        <small id={`${id}-hint`}>
          PDF, PNG, JPEG ou WebP · {multiple ? "Até 5 arquivos e " : "Até "}20
          MB
        </small>
        <span className={styles.browse}><UploadCloud size={16} aria-hidden="true" />{multiple ? "Selecionar arquivos" : "Selecionar arquivo"}</span>
      </label>
      {!!files.length && (
        <ul className={styles.files}>
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}`}>
              <FileText size={20} aria-hidden="true" />
              <span className={styles.fileName}>
                {file.name}
                <small>
                  {file.size < 1024 * 1024
                    ? `${Math.ceil(file.size / 1024)} KB`
                    : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                </small>
              </span>
              <button
                type="button"
                aria-label={`Remover ${file.name}`}
                className={styles.remove}
                onClick={() => {
                  sync(files.filter((_, i) => i !== index));
                  setError("");
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
