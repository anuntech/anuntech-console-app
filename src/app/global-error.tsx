"use client";
import { useEffect } from "react";
import "./shadcn.css";
import "./globals.css";
import { ErrorView, type ErrorBoundaryProps } from "@/components/console/error-view";
import { parseTheme } from "@/lib/account/appearance";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support";

/**
 * The root layout itself failed: this replaces the whole document, so it
 * brings its own <html>, styles and theme (from the same cookie the layout
 * reads). Without the layout there is no support chat either, so help goes
 * to WhatsApp.
 */
export default function GlobalError(props: ErrorBoundaryProps) {
  useEffect(() => {
    const saved = document.cookie.match(/(?:^|; )console-theme=([^;]*)/)?.[1];
    document.documentElement.dataset.theme = parseTheme(saved ? decodeURIComponent(saved) : undefined);
  }, []);
  return (
    <html lang="pt-BR" data-theme="light">
      <body>
        <title>Console indisponível | Anuntech Console</title>
        <ErrorView
          {...props}
          help={
            <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
              Falar com a equipe no WhatsApp
            </a>
          }
        />
      </body>
    </html>
  );
}
