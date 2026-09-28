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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
 * action navigates (returns `href`), in which case the navigation replaces it.
 *
 * `tabs` adds sections next to the form (a task's comments): tabs sit under
 * the title, the form stays mounted while another tab shows, so nothing typed
 * is lost, and each extra tab brings its own body and footer.
 */
export type SheetTab = { value: string; label: ReactNode; content: ReactNode };

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
  submitDisabled,
  onDelete,
  deleteLabel = "Excluir",
  footerStart,
  tabs,
  formTabLabel = "Detalhes",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: keyof typeof widths;
  title: ReactNode;
  description?: ReactNode;
  action: FormAction;
  prepare?: (form: FormData) => Promise<FormData>;
  /** Defaults to closing the sheet, unless the action navigates (returns `href`). */
  onSuccess?: () => void;
  /** Remounts the form (and clears it) when the record changes. */
  formKey?: string;
  submitLabel: ReactNode;
  pendingLabel?: string;
  /** Greys out the primary action, e.g. when there is nothing to post yet. */
  submitDisabled?: boolean;
  /** Shows a destructive "Excluir" on the left of the footer; open a ConfirmDialog from it. */
  onDelete?: () => void;
  deleteLabel?: string;
  /** Anything else for the left side of the footer, instead of or after Excluir. */
  footerStart?: ReactNode;
  /** Sections beside the form; each brings its own body and footer. */
  tabs?: SheetTab[];
  formTabLabel?: string;
  children: ReactNode;
}) {
  const header = (
    <SheetHeader className={cn("border-b px-6 py-5", tabs && "pb-0")}>
      <SheetTitle>{title}</SheetTitle>
      {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
      {tabs && (
        <TabsList variant="line" className="mt-3 -mb-px h-auto w-full justify-start gap-5 p-0">
          {[{ value: "form", label: formTabLabel }, ...tabs].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-auto flex-none px-0 pt-1 pb-3 group-data-[orientation=horizontal]/tabs:after:bottom-0"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
    </SheetHeader>
  );
  const form = (
    <ServerForm
      key={formKey}
      action={action}
      prepare={prepare}
      onSuccess={(state) => {
        if (onSuccess) return onSuccess();
        // An action that returns `href` navigates to the new record; closing here
        // would make a route sheet go back and undo that navigation.
        if (!state.href) onOpenChange(false);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
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
        <SubmitButton pendingLabel={pendingLabel} disabled={submitDisabled}>
          {submitLabel}
        </SubmitButton>
      </SheetFooter>
    </ServerForm>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn("flex w-full flex-col gap-0 p-0", widths[size])}
        onEscapeKeyDown={(event) => {
          // An inline editor inside (a comment being edited) takes Escape to cancel itself.
          if (event.target instanceof Element && event.target.closest("[data-escape-local]")) event.preventDefault();
        }}
      >
        {tabs ? (
          // A new record starts on the form; the key resets the tab with it.
          <Tabs key={formKey} defaultValue="form" className="flex min-h-0 flex-1 flex-col gap-0">
            {header}
            <TabsContent value="form" forceMount className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              {form}
            </TabsContent>
            {tabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="flex min-h-0 flex-1 flex-col">
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <>
            {header}
            {form}
          </>
        )}
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
