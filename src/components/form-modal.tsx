"use client";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { ActionForm, type ActionFormProps } from "./action-form";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import styles from "./ui/modal.module.css";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

type FormModalProps = Omit<
  ActionFormProps,
  "onPendingChange" | "onSuccess" | "cancel"
> & {
  trigger: string;
  triggerAriaLabel?: string;
  title: string;
  description: string;
  triggerClassName?: string;
};
/** Short edits stay in context; server HTML/no-JS retains an ordinary functional form. */
export function FormModal({
  trigger,
  triggerAriaLabel,
  title,
  description,
  triggerClassName = "button",
  ...formProps
}: FormModalProps) {
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const setBusy = useCallback((busy: boolean) => {
    pendingRef.current = busy;
    setPending(busy);
  }, []);
  const complete = useCallback(() => {
    pendingRef.current = false;
    setPending(false);
    setOpen(false);
  }, []);
  if (!hydrated)
    return (
      <details>
        <summary aria-label={triggerAriaLabel}>{trigger}</summary>
        <p>{description}</p>
        <ActionForm {...formProps} />
      </details>
    );
  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && pendingRef.current) {
          details.cancel();
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger
        className={triggerClassName}
        ref={triggerRef}
        aria-label={triggerAriaLabel}
      >
        {trigger}
      </DialogTrigger>
      <DialogContent busy={pending} finalFocus={triggerRef}>
        <div className={styles.header}>
          <DialogTitle className={styles.title}>{title}</DialogTitle>
          <DialogDescription className={styles.description}>
            {description}
          </DialogDescription>
        </div>
        <ActionForm
          {...formProps}
          onPendingChange={setBusy}
          onSuccess={complete}
          cancel={
            <DialogClose className="button" ref={cancelRef} disabled={pending}>
              Cancelar
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
