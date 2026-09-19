"use client";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { FormAction } from "@/lib/action-state";
function Submit({ label, danger }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={danger ? "button danger" : "button primary"}
      disabled={pending}
    >
      {pending ? "Salvando…" : label}
    </button>
  );
}
export function ActionForm({
  action,
  children,
  label = "Salvar",
  danger = false,
  className = "form",
  reset = false,
}: {
  action: FormAction;
  children: React.ReactNode;
  label?: string;
  danger?: boolean;
  className?: string;
  reset?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.href) router.push(state.href);
    else if (state.success) {
      if (reset) ref.current?.reset();
      router.refresh();
    }
  }, [state, router, reset]);
  return (
    <form action={formAction} className={className} ref={ref}>
      {children}
      {state.error && (
        <p role="alert" className="alert error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="alert success">
          {state.success}
        </p>
      )}
      <Submit label={label} danger={danger} />
    </form>
  );
}
