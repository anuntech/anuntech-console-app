"use client";
import type { ComponentProps } from "react";
import { AlertDialog as Primitive } from "@base-ui/react/alert-dialog";
import styles from "./modal.module.css";

// Adapted from shadcn.io Alert Dialog, retaining Base UI's alertdialog semantics.
export const AlertDialog = Primitive.Root;
export const AlertDialogTitle = Primitive.Title;
export const AlertDialogDescription = Primitive.Description;
export const AlertDialogCancel = Primitive.Close;
export function AlertDialogContent({
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Popup>) {
  return (
    <Primitive.Portal>
      <Primitive.Backdrop className={styles.backdrop} />
      <Primitive.Popup className={`${styles.popup} ${className}`} {...props} />
    </Primitive.Portal>
  );
}
