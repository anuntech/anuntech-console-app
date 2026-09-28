"use client";
import { ErrorView, type ErrorBoundaryProps } from "@/components/console/error-view";

/** A screen of the app that failed to render; the dock stays around it. */
export default function ErrorPage(props: ErrorBoundaryProps) {
  return (
    <>
      <title>Página indisponível | Anuntech Console</title>
      <ErrorView {...props} layout="inline" home={{ href: "/painel", label: "Ir para a Visão geral" }} />
    </>
  );
}
