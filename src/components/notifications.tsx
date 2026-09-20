"use client";
import { useEffect, useId } from "react";
import { toast } from "sonner";
import { Toaster } from "./ui/sonner";
import { CircleCheck, Info, TriangleAlert, CircleAlert } from "lucide-react";
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
  const Icon = {
    success: CircleCheck,
    error: CircleAlert,
    info: Info,
    warning: TriangleAlert,
  }[kind];
  return (
    <div
      id={id || fallbackId}
      className={`notice notice-${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      <Icon size={18} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
export function Notifications() {
  useEffect(() => {
    let first:
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null;
    let validationTimer: ReturnType<typeof setTimeout> | undefined;
    const invalid = (event: Event) => {
      const field = event.target;
      if (
        !(
          field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement ||
          field instanceof HTMLTextAreaElement
        ) ||
        !field.closest("[data-form-field]")
      )
        return;
      if (first) return;
      first = field;
      validationTimer = setTimeout(() => {
        if (first?.isConnected) first.focus();
        first = null;
      });
    };
    document.addEventListener("invalid", invalid, true);
    return () => {
      first = null;
      if (validationTimer) clearTimeout(validationTimer);
      document.removeEventListener("invalid", invalid, true);
    };
  }, []);
  return <Toaster />;
}
