"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert, SubmitButton } from "@/components/console/server-form";
import { approveMeetingApp } from "@/lib/meetings/meeting-actions";

/**
 * The approve button of /conectar/<challenge>. Not a ServerForm: the answer's
 * `href` is the app's URL scheme (anuntech-reunioes://), which the browser
 * opens with a plain navigation, not the router.
 */
export function ConnectApproval({ challenge }: { challenge: string }) {
  const [state, action] = useActionState(approveMeetingApp, {});
  useEffect(() => {
    if (state.href) window.location.href = state.href;
  }, [state.href]);
  if (state.href)
    return (
      <div className="flex flex-col items-center gap-4">
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckIcon aria-hidden="true" className="size-4" />
          {state.success}
        </p>
        <Button asChild variant="outline">
          {/* The browser may ask before opening an app; this is the way back if it did not. */}
          <a href={state.href}>Abrir o app de novo</a>
        </Button>
      </div>
    );
  return (
    <form action={action} className="flex w-full flex-col items-center gap-4">
      <input type="hidden" name="challenge" value={challenge} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <SubmitButton pendingLabel="Conectando…">Conectar este Mac</SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/painel">Agora não</Link>
        </Button>
      </div>
      {state.error && <FormAlert className="w-full text-left">{state.error}</FormAlert>}
    </form>
  );
}
