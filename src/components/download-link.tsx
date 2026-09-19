"use client";
import { useState } from "react";
import { toast } from "./notifications";
export function DownloadLink({
  href,
  children,
  className,
  filename = "documento.pdf",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  filename?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <a
      href={href}
      className={className}
      aria-busy={pending}
      onClick={async (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (pending) return;
        setPending(true);
        const id = toast.loading("Preparando download…");
        try {
          const res = await fetch(href, { signal: AbortSignal.timeout(30000) });
          if (
            !res.ok ||
            res.headers.get("content-type")?.includes("text/html")
          ) {
            toast.error(
              res.status === 401
                ? "Entre novamente na Console para baixar este arquivo."
                : "Não foi possível baixar o arquivo. Confira seu acesso e tente novamente.",
              { id, duration: 10000 },
            );
            return;
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          const disposition = res.headers.get("content-disposition") || "";
          const encodedName = disposition.match(
            /filename\*=UTF-8''([^;]+)/i,
          )?.[1];
          const plainName = disposition.match(/filename="([^"]+)"/i)?.[1];
          let suggested = plainName || filename;
          try {
            if (encodedName) suggested = decodeURIComponent(encodedName);
          } catch {
            /* Fall back to the supplied name. */
          }
          link.download = suggested.replace(/[\\/]/g, "_");
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          toast.success("Download preparado.", { id });
        } catch {
          toast.error("Não foi possível baixar o arquivo. Tente novamente.", {
            id,
            duration: 10000,
          });
        } finally {
          setPending(false);
        }
      }}
    >
      {children}
    </a>
  );
}
