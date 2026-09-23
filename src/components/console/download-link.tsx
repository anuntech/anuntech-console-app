"use client";
import { useState, type ComponentProps } from "react";
import { cn } from "cn";
import { toast } from "@/components/notifications";

/**
 * Downloads a private file through fetch so the session cookie travels with
 * the request and failures become a toast instead of a broken tab. Modified
 * clicks fall back to the plain link.
 */
export function DownloadLink({
  href,
  filename,
  className,
  children,
  ...props
}: ComponentProps<"a"> & { href: string; filename: string }) {
  const [pending, setPending] = useState(false);
  return (
    <a
      href={href}
      className={cn(pending && "opacity-60", className)}
      aria-busy={pending || undefined}
      {...props}
      onClick={async (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        if (pending) return;
        setPending(true);
        try {
          const res = await fetch(href, { signal: AbortSignal.timeout(30000) });
          if (!res.ok || res.headers.get("content-type")?.includes("text/html")) {
            toast.error(
              res.status === 401
                ? "Entre novamente no Console para baixar este arquivo."
                : "Não foi possível baixar o arquivo. Confira seu acesso e tente novamente.",
            );
            return;
          }
          const url = URL.createObjectURL(await res.blob());
          const link = document.createElement("a");
          link.href = url;
          link.download = filename.replace(/[\\/]/g, "_");
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
          toast.error("Não foi possível baixar o arquivo. Tente novamente.");
        } finally {
          setPending(false);
        }
      }}
    >
      {children}
    </a>
  );
}
