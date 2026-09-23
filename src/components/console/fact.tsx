import type { ReactNode } from "react";
import { cn } from "cn";

/** One label/value pair inside a <dl>; the grammar every detail card shares. */
export function Fact({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground break-words">{children}</dd>
    </div>
  );
}
