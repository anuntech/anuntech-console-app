"use client";
import { useRef } from "react";
import { ActionForm, type ActionFormProps } from "./action-form";
import { optimizeImage } from "@/lib/client-image";
export function TicketActionForm({
  fileField = "files",
  ...props
}: ActionFormProps & { fileField?: string }) {
  const previous = useRef<string[]>([]);
  async function prepare(form: FormData) {
    const files = form
      .getAll(fileField)
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );
    if (
      files.length > 5 ||
      files.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024
    )
      throw new Error("Selecione até 5 anexos, com no máximo 20 MB no total.");
    for (const id of previous.current)
      await fetch(`/api/chamados/uploads?id=${id}`, { method: "DELETE" }).catch(
        () => {},
      );
    previous.current = [];
    form.delete(fileField);
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
        previous.current.push(result.id);
        for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
          const response = await fetch(
            `/api/chamados/uploads?id=${result.id}&offset=${offset}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/octet-stream" },
              body: file.slice(offset, offset + 1024 * 1024),
            },
          );
          if (!response.ok) {
            const error = await response.json();
            throw new Error(
              error.error || "Falha ao enviar o anexo. Tente novamente.",
            );
          }
        }
        form.append("uploadId", result.id);
      }
      return form;
    } catch (error) {
      for (const id of previous.current)
        await fetch(`/api/chamados/uploads?id=${id}`, {
          method: "DELETE",
        }).catch(() => {});
      previous.current = [];
      throw error;
    }
  }
  return <ActionForm {...props} prepare={prepare} />;
}
