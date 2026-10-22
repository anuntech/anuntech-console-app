import type { ReactNode } from "react";
import { CircleAlertIcon, InfoIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Inline feedback for the access screens: one tone for errors, one for news. */
export function AuthAlert({
  kind,
  id,
  children,
}: {
  kind: "error" | "info";
  id?: string;
  children: ReactNode;
}) {
  const Icon = kind === "error" ? CircleAlertIcon : InfoIcon;
  return (
    <div
      id={id}
      role={kind === "error" ? "alert" : "status"}
      aria-atomic="true"
      className={cn(
        // Fades in where it appears; the text is announced either way.
        "reveal-fade flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        kind === "error"
          ? "border-destructive-edge bg-destructive-soft text-destructive"
          : "border-border bg-secondary/60 text-foreground",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
