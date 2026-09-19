"use client";
import { useEffect, useId } from "react";
import { toast } from "sonner";
import { Toaster } from "./ui/sonner";
export { toast };
export function Notification({
  message,
  kind = "info",
  id,
}: {
  message: string;
  kind?: "success" | "error" | "info" | "warning";
  id?: string;
}) {
  const fallbackId = useId();
  useEffect(() => {
    toast[kind](message, {
      id: id || fallbackId,
      duration: kind === "error" ? 10000 : 7000,
    });
  }, [message, kind, id, fallbackId]);
  return (
    <noscript>
      <p role={kind === "error" ? "alert" : "status"}>{message}</p>
    </noscript>
  );
}
export function Notifications() {
  useEffect(() => {
    let first:
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null;
    let validationTimer: ReturnType<typeof setTimeout> | undefined;
    const invalid = (event: Event) => {
      const field = event.target;
      if (!(
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      ))
        return;
      event.preventDefault();
      field.setAttribute("aria-invalid", "true");
      if (first) return;
      first = field;
      validationTimer = setTimeout(() => {
        if (!first) return;
        const label =
          first.labels?.[0]?.querySelector("span")?.textContent ||
          first.getAttribute("aria-label") ||
          "Este campo";
        const reason = first.validity.valueMissing
          ? "é obrigatório."
          : first.validity.typeMismatch && first.type === "email"
            ? "deve conter um e-mail válido."
            : first.validity.patternMismatch
              ? "está em um formato inválido."
              : "precisa ser conferido.";
        toast.error(`${label} ${reason}`, {
          id: "form-validation",
          duration: 10000,
        });
        first.focus();
        first = null;
      });
    };
    const input = (event: Event) => {
      if (event.target instanceof HTMLElement)
        event.target.removeAttribute("aria-invalid");
    };
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", input, true);
    return () => {
      first = null;
      if (validationTimer) clearTimeout(validationTimer);
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("input", input, true);
    };
  }, []);
  return <Toaster />;
}
