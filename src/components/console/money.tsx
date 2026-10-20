import type { ReactNode } from "react";
import { currency } from "@/lib/format";

/** A money value the overview's eye can hide (MoneyToggle): blurred inside a hidden scope, never removed. */
export function Money({ cents, children }: { cents?: number; children?: ReactNode }) {
  return <span data-money="">{children ?? currency(cents ?? 0)}</span>;
}

/** The part of a page whose values the eye hides; `hidden` comes from the cookie, so it renders right away. */
export function MoneyScope({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return (
    <div data-money-scope="" data-money-hidden={hidden ? "" : undefined} className="contents">
      {children}
    </div>
  );
}
