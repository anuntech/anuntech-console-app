"use client";
import { cn } from "@/lib/cn";
import { useActiveSection } from "./use-active-section";

/**
 * A table of contents on a rail: the section being read gets the violet mark
 * and the foreground colour (a 120ms colour change, nothing moves). Used by
 * the help articles and Como trabalhamos.
 */
export function TocList({
  items,
  label,
  heading,
  className,
}: {
  items: { id: string; title: string }[];
  /** The navigation's accessible name. */
  label: string;
  /** A visible title above the list. */
  heading?: string;
  className?: string;
}) {
  const active = useActiveSection(items.map((item) => item.id));
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-2", className)}>
      {heading && <p className="m-0 text-caption font-medium text-muted-foreground">{heading}</p>}
      <ul className="m-0 flex list-none flex-col border-l p-0">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l-2 py-1.5 pr-2 pl-3 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  current
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
