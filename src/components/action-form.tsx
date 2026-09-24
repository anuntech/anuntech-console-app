"use client";
import {
  useActionState,
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useCreationBusy } from "./creation-modal";
import { focusFirstInvalid } from "./field";

import { useRouter } from "next/navigation";
import type { ActionState, FormAction } from "@/lib/action-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./legacy-ui/alert-dialog";
import styles from "./legacy-ui/modal.module.css";

export type ActionConfirmation = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
};
export type ActionFormProps = {
  action: FormAction;
  prepare?: (form: FormData) => Promise<FormData>;
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
  prepare,
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
  const setCreationBusy = useCreationBusy();
  const [state, formAction, actionPending] = useActionState(action, {});
  const [dismissedFor, setDismissedFor] = useState<typeof state | null>(null);
  // "Salvo ✓" follows the last successful response until the user edits or resubmits.
  const completed = !!state.success && dismissedFor !== state;
  const [preparing, setPreparing] = useState(false);
  const pending = actionPending || preparing;
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
    if (state.success || state.href) onSuccess?.();
    if (state.href) router.push(state.href);
    else if (state.success) {
      if (reset) ref.current?.reset();
      router.refresh();
    }
  }, [state, router, reset, onSuccess]);
  useEffect(() => {
    onPendingChange?.(pending);
    setCreationBusy?.(pending);
  }, [pending, onPendingChange, setCreationBusy]);

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
    event.preventDefault();
    setValidationError("");
    setDismissedFor(state);
    invalidReturnFocus.current = null;
    submissionLock.current = true;
    onPendingChange?.(true);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(
      event.currentTarget,
      submitter instanceof HTMLButtonElement ||
        submitter instanceof HTMLInputElement
        ? submitter
        : undefined,
    );
    if (!prepare) startTransition(() => formAction(form));
    else {
      setPreparing(true);
      startTransition(async () => {
        try {
          const prepared = await prepare(form);
          startTransition(() => formAction(prepared));
        } catch (error) {
          submissionLock.current = false;
          setValidationError(
            error instanceof Error
              ? error.message
              : "Não foi possível enviar. Seus dados foram mantidos; tente novamente.",
          );
          onPendingChange?.(false);
          requestAnimationFrame(() => errorRef.current?.focus());
        } finally {
          setPreparing(false);
        }
      });
    }
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
        onChange={() => setDismissedFor(state)}
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
            aria-label={pending ? "Salvando" : completed ? "Salvo" : submitAriaLabel}
            aria-live="polite"
            aria-haspopup={confirmation ? "dialog" : undefined}
          >
            {pending ? "Salvando…" : completed ? "Salvo ✓" : label}
          </button>
        </div>
      </form>
      <p
        className="sr-only"
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
            <p className="sr-only" role="status" aria-live="polite">
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
