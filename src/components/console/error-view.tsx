"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/console/status-page";
import { SupportButton } from "@/components/support-trigger";

export type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  /** Re-fetches and re-renders the segment (Next 16.3+); `reset` only re-renders. */
  retry?: () => void;
  reset?: () => void;
};

/**
 * What every error boundary shows: the screen failed on our side, try again,
 * and if it keeps failing, give the team the code so they find the log.
 */
export function ErrorView({
  error,
  retry,
  reset,
  layout = "page",
  home = { href: "/painel", label: "Ir para o Console" },
  help,
}: ErrorBoundaryProps & {
  layout?: "page" | "inline";
  /** Where to go instead; `null` for people without access to the Console. */
  home?: { href: string; label: string } | null;
  /** How to reach the team; defaults to the support chat. */
  help?: ReactNode;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const again = retry ?? reset;
  return (
    <StatusPage
      layout={layout}
      icon={<TriangleAlertIcon />}
      eyebrow="Erro inesperado"
      title="Esta página não carregou"
      description="Algo falhou do nosso lado ao montar esta tela. Tente de novo em instantes. Se continuar, fale com a equipe da Anuntech e informe o código abaixo."
      reference={error.digest}
      actions={
        <>
          {again && (
            <Button type="button" onClick={() => again()}>
              <RotateCcwIcon />
              Tentar de novo
            </Button>
          )}
          {home && (
            <Button variant="outline" asChild>
              <Link href={home.href}>{home.label}</Link>
            </Button>
          )}
        </>
      }
      footnote={
        help ?? (
          <SupportButton className="font-medium text-primary underline-offset-2 hover:underline">
            Falar com a equipe
          </SupportButton>
        )
      }
    />
  );
}
