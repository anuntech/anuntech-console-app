"use client";
import type { ComponentProps } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

// Adapted from the Sheet source researched with the shadcn.io MCP.
export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export function SheetContent({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Dialog.Popup>) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="sheet-overlay" />
      <Dialog.Popup className={`sheet-content ${className}`} {...props}>
        {children}
        <Dialog.Close
          className="icon-button sheet-close"
          aria-label="Fechar menu"
        >
          <X size={20} aria-hidden="true" />
        </Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}
