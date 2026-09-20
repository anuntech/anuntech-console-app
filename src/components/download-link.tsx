"use client";
import { useId, useState } from "react";
import styles from "./download-link.module.css";
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
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const feedbackId = useId();
  return (
    <span className={styles.control}>
      <a
        href={href}
        className={className}
        aria-busy={pending}
        aria-disabled={pending}
        aria-describedby={message ? feedbackId : undefined}
        onClick={async (e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          if (pending) return;
          setPending(true);
          setFailed(false);
          setMessage("Preparando download…");
          try {
            const res = await fetch(href, {
              signal: AbortSignal.timeout(30000),
            });
            if (
              !res.ok ||
              res.headers.get("content-type")?.includes("text/html")
            ) {
              setFailed(true);
              setMessage(
                res.status === 401
                  ? "Entre novamente no Console para baixar este arquivo."
                  : "Não foi possível baixar o arquivo. Confira seu acesso e tente novamente.",
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
            setMessage("Download preparado.");
          } catch {
            setFailed(true);
            setMessage("Não foi possível baixar o arquivo. Tente novamente.");
          } finally {
            setPending(false);
          }
        }}
      >
        {children}
      </a>
      <span
        id={feedbackId}
        className={`${styles.feedback} ${failed ? styles.error : ""}`}
        role={failed ? "alert" : "status"}
        aria-atomic="true"
      >
        {message}
      </span>
    </span>
  );
}
