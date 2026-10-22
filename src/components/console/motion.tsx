"use client";
import { useLinkStatus } from "next/link";
import { useState, type ReactNode } from "react";

/*
 * Small motion helpers that need the client. The CSS utilities (`reveal`,
 * `reveal-fade`, `stagger`, `press`, `pixel-field`, `brand-glow`) live in
 * shadcn.css; see docs/design.md#movimento.
 */

/**
 * Put inside a `<Link prefetch={false}>`: while the next page is on its way, a
 * violet hairline grows along the edge given by `className` (default: the
 * bottom edge of the nearest `relative` ancestor). Nothing shows if the answer comes
 * within 120ms.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-slot="link-pending"
      data-pending={pending || undefined}
      className={className ?? "inset-x-0 bottom-0"}
    />
  );
}

/**
 * A figure that slides in when it changes while on screen (a metric after a
 * filter, a counter after an action). The first render is static, so a page
 * load never animates its numbers, and there is no counting up: the value
 * is read as it is. Keep `tabular-nums` on the parent.
 */
export function AnimatedValue({ value, children, className }: { value: string | number; children?: ReactNode; className?: string }) {
  // Adjusting state while rendering (React's pattern for "derive from a prop change").
  const [shown, setShown] = useState(value);
  const [changed, setChanged] = useState(false);
  if (shown !== value) {
    setShown(value);
    setChanged(true);
  }
  return (
    <span key={String(value)} data-value-changed={changed || undefined} className={className}>
      {children ?? value}
    </span>
  );
}
