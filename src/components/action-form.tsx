"use client";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { focusFirstInvalid } from "./field";
import { toast } from "./notifications";
import { useRouter } from "next/navigation";
import type { ActionState, FormAction } from "@/lib/action-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import styles from "./ui/modal.module.css";

export type ActionConfirmation = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
};
export type ActionFormProps = {
  action: FormAction;
  children: React.ReactNode;
  label?: string;
  submitAriaLabel?: string;
  danger?: boolean;
  className?: string;
  reset?: boolean;
  confirm?: ActionConfirmation | false;
  /** Used by FormModal to keep dismissal and feedback in sync. */
  onPendingChange?: (pending: boolean) => void;
  onSuccess?: () => void;
  cancel?: React.ReactNode;
};

export function ActionForm({
  action,
  children,
  label = "Salvar",
  submitAriaLabel,
  danger = false,
  className = "form",
  reset = false,
  confirm,
  onPendingChange,
  onSuccess,
  cancel,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [confirmationFor, setConfirmationFor] = useState<ActionState | null>(
    null,
  );
  const [validationError, setValidationError] = useState("");
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const submittedBy = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  const stateWhenOpened = useRef<ActionState | null>(null);
  const invalidReturnFocus = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const bypassConfirmation = useRef(false);
  const submissionLock = useRef(false);
  const errorId = useId();
  const handledResponse = useRef<ActionState | null>(null);
  const error = validationError || state.error;
  const confirmation =
    confirm === false
      ? null
      : confirm ||
        (danger
          ? {
              title: `${label}?`,
              description:
                "Confirme que deseja realizar esta ação. Confira os dados antes de continuar.",
              confirmLabel: label,
            }
          : null);
  // A new server response closes the confirmation while leaving any error in the form.
  const confirmationOpen = !!confirmation && confirmationFor === state;

  useEffect(() => {
    if (handledResponse.current === state) return;
    handledResponse.current = state;
    submissionLock.current = false;
    if (state.error) {
      errorRef.current?.focus();
    }
    if (state.success)
      toast.success(state.success);
    if (state.success || state.href) onSuccess?.();
    if (state.href) router.push(state.href);
    else if (state.success) {
      if (reset) ref.current?.reset();
      router.refresh();
    }
  }, [state, router, reset, onSuccess]);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submissionLock.current || pending) {
      event.preventDefault();
      return;
    }
    if (confirmation && !bypassConfirmation.current) {
      event.preventDefault();
      setValidationError("");
      invalidReturnFocus.current = null;
      stateWhenOpened.current = state;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      submittedBy.current =
        submitter instanceof HTMLButtonElement ||
        submitter instanceof HTMLInputElement
          ? submitter
          : submitRef.current;
      setConfirmationFor(state);
      return;
    }
    setValidationError("");
    invalidReturnFocus.current = null;
    submissionLock.current = true;
    onPendingChange?.(true);
  }
  function confirmSubmission() {
    if (pending || submissionLock.current) return;
    bypassConfirmation.current = true;
    try {
      const form = ref.current;
      const submitter = submittedBy.current;
      form?.requestSubmit(
        submitter?.form === form ? submitter : submitRef.current || undefined,
      );
    } finally {
      bypassConfirmation.current = false;
    }
  }

  return (
    <>
      <form
        action={formAction}
        className={className}
        ref={ref}
        onSubmit={handleSubmit}
        onInvalidCapture={(event) => {
          if (!confirmationOpen) {
            focusFirstInvalid(event.currentTarget);
            return;
          }
          // Revalidation may fail if data changed while the confirmation was open.
          // Close first so the user can reach and repair the underlying field.
          event.preventDefault();
          if (
            !invalidReturnFocus.current &&
            event.target instanceof HTMLElement
          )
            invalidReturnFocus.current = event.target;
          setValidationError(
            "Revise os campos informados antes de confirmar novamente.",
          );
          setConfirmationFor(null);
        }}
        aria-busy={pending || undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {children}
        <div
          id={errorId}
          className={styles.alert}
          data-form-feedback=""
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
        <div className={styles.actions} data-form-actions="">
          {cancel}
          <button
            type="submit"
            ref={submitRef}
            className={danger ? "button danger" : "button primary"}
            aria-disabled={pending || undefined}
            aria-label={submitAriaLabel}
            aria-haspopup={confirmation ? "dialog" : undefined}
          >
            {pending ? "Salvando…" : label}
          </button>
        </div>
      </form>
      <p
        className={styles.status}
        data-form-feedback=""
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {pending ? "Enviando. Aguarde a confirmação." : ""}
      </p>
      {confirmation && (
        <AlertDialog
          open={confirmationOpen}
          onOpenChange={(open, details) => {
            if (!open && (pending || submissionLock.current)) {
              details.cancel();
              return;
            }
            if (!open) setConfirmationFor(null);
          }}
        >
          <AlertDialogContent
            initialFocus={cancelRef}
            finalFocus={() =>
              invalidReturnFocus.current ||
              (state.error && stateWhenOpened.current !== state
                ? errorRef.current
                : submittedBy.current || submitRef.current)
            }
          >
            <div className={styles.header}>
              <AlertDialogTitle className={styles.title}>
                {confirmation.title}
              </AlertDialogTitle>
              <AlertDialogDescription className={styles.description}>
                {confirmation.description}
              </AlertDialogDescription>
            </div>
            <p className={styles.pending} role="status" aria-live="polite">
              {pending
                ? "Processando a solicitação. Aguarde para fechar esta janela."
                : ""}
            </p>
            <div className={styles.footer}>
              <AlertDialogCancel
                ref={cancelRef}
                className="button"
                disabled={pending}
              >
                {confirmation.cancelLabel || "Cancelar"}
              </AlertDialogCancel>
              <button
                type="button"
                className={danger ? "button danger" : "button primary"}
                onClick={confirmSubmission}
                aria-disabled={pending || undefined}
              >
                {pending ? "Processando…" : confirmation.confirmLabel || label}
              </button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
