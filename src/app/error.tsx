"use client";
import { ErrorView, type ErrorBoundaryProps } from "@/components/console/error-view";

/** A screen outside the app (sign-in, access checks) that failed to render. */
export default function ErrorPage(props: ErrorBoundaryProps) {
  return (
    <>
      <title>Página indisponível | Anuntech Console</title>
      <ErrorView {...props} />
    </>
  );
}
