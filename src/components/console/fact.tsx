import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One label/value pair inside a <dl>; the grammar every detail card shares.
 *
 * An empty value (null, undefined, false, "") renders nothing: a missing
 * phone is omitted, not shown as "—" or "Não informado". Say what is missing
 * only when it blocks something, and then as a warning with the fix, not as a
 * Fact. The label names the field, never the value ("Situação: Ativo" next to
 * an "Ativo" badge is said twice).
 */
export function Fact({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  if (children === null || children === undefined || children === false || children === "") return null;
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground break-words">{children}</dd>
    </div>
  );
}
