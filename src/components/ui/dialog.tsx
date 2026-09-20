"use client";
import type { ComponentProps } from "react";
import { Dialog as Primitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import styles from "./modal.module.css";

// Adapted from the shadcn.io Dialog source; Base UI owns modal focus and dismissal.
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({
  children,
  className = "",
  busy = false,
  ...props
}: ComponentProps<typeof Primitive.Popup> & { busy?: boolean }) {
  return (
    <Primitive.Portal>
      <Primitive.Backdrop className={styles.backdrop} />
      <Primitive.Popup className={`${styles.popup} ${className}`} {...props}>
        {children}
        <Primitive.Close
          className={`icon-button ${styles.close}`}
          aria-label="Fechar janela"
          disabled={busy}
        >
          <X size={20} aria-hidden="true" />
        </Primitive.Close>
      </Primitive.Popup>
    </Primitive.Portal>
  );
}
