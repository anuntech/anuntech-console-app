import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Details on demand: a quiet "Ver detalhes" line that opens what most people
 * do not need every time (technical ids, hashes, audit dates, secondary
 * facts). Native <details>, so it works without JavaScript, is announced as
 * expandable and opens with Enter or Space. It opens in place, without
 * motion: it is used many times a day.
 *
 * Put a <dl> of `Fact`s inside, never the only copy of something the person
 * needs to act on.
 */
export function Disclosure({
  summary = "Ver detalhes",
  children,
  defaultOpen = false,
  className,
}: {
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details className={cn("group/disclosure", className)} open={defaultOpen || undefined}>
      <summary className="-mx-1 inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors select-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform group-open/disclosure:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
