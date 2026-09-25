"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import type { FormAction } from "@/lib/action-state";

const widths = {
  md: "sm:max-w-md",
  xl: "sm:max-w-xl",
  "3xl": "sm:max-w-3xl",
} as const;

/**
 * The one shell for creating or editing a record in a side sheet:
 *
 *   header   title + one-line description, border below
 *   body     scrolls; the form error first, then the fields in `grid gap-5`
 *   footer   [Excluir (edit only)] ··· [Cancelar] [primary]
 *
 * Widths: `md` for four short fields or fewer, `xl` by default, `3xl` only
 * for long-text editors. The form closes the sheet on success unless the
 * action navigates (returns `href`).
 */
export function FormSheet({
  open,
  onOpenChange,
  size = "xl",
  title,
  description,
  action,
  prepare,
  onSuccess,
  formKey,
  submitLabel,
  pendingLabel = "Salvando…",
  onDelete,
  deleteLabel = "Excluir",
  footerStart,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: keyof typeof widths;
  title: ReactNode;
  description?: ReactNode;
  action: FormAction;
  prepare?: (form: FormData) => Promise<FormData>;
  /** Defaults to closing the sheet. */
  onSuccess?: () => void;
  /** Remounts the form (and clears it) when the record changes. */
  formKey?: string;
  submitLabel: ReactNode;
  pendingLabel?: string;
  /** Shows a destructive "Excluir" on the left of the footer; open a ConfirmDialog from it. */
  onDelete?: () => void;
  deleteLabel?: string;
  /** Anything else for the left side of the footer, instead of or after Excluir. */
  footerStart?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("flex w-full flex-col gap-0 p-0", widths[size])}>
        <ServerForm
          key={formKey}
          action={action}
          prepare={prepare}
          onSuccess={onSuccess ?? (() => onOpenChange(false))}
          className="flex h-full min-h-0 flex-col"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <div className="grid gap-5">{children}</div>
          </div>
          <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            {onDelete && (
              <Button type="button" variant="ghost" className="mr-auto text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2Icon />
                {deleteLabel}
              </Button>
            )}
            {footerStart && <div className={cn("flex items-center gap-2", !onDelete && "mr-auto")}>{footerStart}</div>}
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}

/**
 * For sheets that live on a route (`/x/novo` intercepted over the current
 * page): opens at once, and on close slides out before going back.
 */
export function useRouteSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return {
    open,
    onOpenChange: (next: boolean) => {
      if (next) return;
      setOpen(false);
      setTimeout(() => router.back(), 300);
    },
  };
}
