"use client";
import { useRef } from "react";
import { optimizeImage } from "@/lib/client-image";
import {
  DOCUMENT_ATTACHMENTS,
  attachmentLimitError,
  type AttachmentRules,
} from "@/lib/attachment-rules";

const CHUNK = 1024 * 1024;

/**
 * Server actions are capped at 2 MB, so attachments are streamed in chunks
 * to /api/chamados/uploads before the form posts; the action then receives
 * one `uploadId` per file instead of the bytes. Anything staged by a failed
 * attempt is discarded first so nothing piles up on the server. The limits
 * come from the same rules as the field, so both say the same thing.
 */
export function useStagedUploads(
  rules: AttachmentRules = DOCUMENT_ATTACHMENTS,
  field = "files",
) {
  const staged = useRef<string[]>([]);
  async function discard() {
    const ids = staged.current;
    staged.current = [];
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/chamados/uploads?id=${id}`, { method: "DELETE" }).catch(
          () => {},
        ),
      ),
    );
  }
  return async function prepare(form: FormData) {
    const files = form
      .getAll(field)
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (
      files.length > rules.max ||
      files.reduce((sum, f) => sum + f.size, 0) > rules.maxBytes
    )
      throw new Error(attachmentLimitError(rules));
    await discard();
    form.delete(field);
    try {
      for (const original of files) {
        const file = await optimizeImage(original);
        const start = await fetch("/api/chamados/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size }),
        });
        const result = await start.json();
        if (!start.ok || !result.id)
          throw new Error(result.error || "Não foi possível iniciar o envio.");
        staged.current.push(result.id);
        for (let offset = 0; offset < file.size; offset += CHUNK) {
          const response = await fetch(
            `/api/chamados/uploads?id=${result.id}&offset=${offset}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/octet-stream" },
              body: file.slice(offset, offset + CHUNK),
            },
          );
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(
              error.error || "Falha ao enviar o anexo. Tente novamente.",
            );
          }
        }
        form.append("uploadId", result.id);
      }
      staged.current = [];
      return form;
    } catch (error) {
      await discard();
      throw error;
    }
  };
}
