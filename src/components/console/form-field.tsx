import type { ReactNode } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

/**
 * One field of a form: label, control, optional hint. Every form in the
 * Console stacks these in `grid gap-5` (pairs in `sm:grid-cols-2`).
 */
export function FormField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor} className="mb-1.5">
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A titled group of fields inside a long form. */
export function FormSection({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("m-0 grid min-w-0 gap-5 border-0 p-0", className)}>
      <legend className="mb-4 p-0 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}
