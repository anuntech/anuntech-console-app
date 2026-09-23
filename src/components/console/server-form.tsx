"use client";
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { cn } from "cn";
import { toast } from "@/components/notifications";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionState, FormAction } from "@/lib/action-state";

const ErrorContext = createContext<string | undefined>(undefined);
/* Work done before the action runs (uploads) is pending too, and
   useFormStatus cannot see it. */
const PreparingContext = createContext(false);

/**
 * Runs a server action from a form on the shadcn foundation. Success toasts
 * and refreshes (or navigates when the action returns `href`); errors are
 * announced inline through <FormError /> and as a toast. `prepare` may
 * rewrite the FormData asynchronously before it reaches the action.
 */
export function ServerForm({
  action,
  onSuccess,
  prepare,
  reset = false,
  className,
  children,
  ref,
  onSubmit,
  ...props
}: Omit<ComponentProps<"form">, "action"> & {
  action: FormAction;
  onSuccess?: (state: ActionState) => void;
  prepare?: (form: FormData) => Promise<FormData>;
  /** Clear the fields after a successful submission (replies, uploads). */
  reset?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [preparing, setPreparing] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const handled = useRef<ActionState | null>(null);
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.error) toast.error(state.error);
    if (state.success) toast.success(state.success);
    if (state.success && reset) formRef.current?.reset();
    if (state.success || state.href) onSuccess?.(state);
    if (state.href) router.push(state.href);
    else if (state.success) router.refresh();
  }, [state, router, onSuccess, reset]);
  return (
    <ErrorContext.Provider value={state.error}>
      <PreparingContext.Provider value={preparing}>
        <form
          action={formAction}
          aria-busy={pending || preparing || undefined}
          className={cn("contents", className)}
          ref={(node) => {
            formRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          onSubmit={(event) => {
            onSubmit?.(event);
            if (!prepare || event.defaultPrevented) return;
            event.preventDefault();
            const submitter = (event.nativeEvent as SubmitEvent).submitter;
            const data = new FormData(
              event.currentTarget,
              submitter instanceof HTMLElement ? submitter : undefined,
            );
            setPreparing(true);
            startTransition(async () => {
              try {
                const prepared = await prepare(data);
                startTransition(() => formAction(prepared));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível enviar. Tente novamente.",
                );
              } finally {
                setPreparing(false);
              }
            });
          }}
          {...props}
        >
          {children}
        </form>
      </PreparingContext.Provider>
    </ErrorContext.Provider>
  );
}

export function FormError({ className }: { className?: string }) {
  const error = useContext(ErrorContext);
  if (!error) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-md border border-destructive-edge bg-destructive-soft px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      {error}
    </p>
  );
}

/** Submit button that reflects the surrounding form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const status = useFormStatus();
  const preparing = useContext(PreparingContext);
  const pending = status.pending || preparing;
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2Icon className="animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

type ConfirmProps = {
  action: FormAction;
  fields?: Record<string, string>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onSuccess?: (state: ActionState) => void;
};

/**
 * A confirmation that submits a server action with hidden fields. Controlled,
 * so it can live outside a dropdown menu whose items merely open it — menu
 * content unmounts when the menu closes, which would take the form with it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  action,
  fields = {},
  title,
  description,
  confirmLabel = "Confirmar",
  destructive = false,
  onSuccess,
}: ConfirmProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <ServerForm
        ref={formRef}
        action={action}
        onSuccess={(state) => {
          onOpenChange(false);
          onSuccess?.(state);
        }}
      >
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </ServerForm>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={destructive ? "destructive" : "default"}
              onClick={(event) => {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** ConfirmDialog with its own trigger, for buttons that sit in the page. */
export function ConfirmAction({
  children,
  ...props
}: ConfirmProps & { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span
        className="contents"
        onClickCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </span>
      <ConfirmDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}
