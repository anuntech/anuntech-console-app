"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { LIST_LAYOUT_COOKIES, type ListLayout, type ListLayoutArea } from "@/lib/list-layout";

/*
 * The grid way of drawing a list (Bookmarks, Projetos, Contratos, Produtos,
 * Empresas): the same ListCard, toolbar and footer, with cards instead of
 * rows. The viewer picks Lista or Grade in the toolbar; the choice is
 * remembered per area (lib/list-layout).
 */

/** Kept for a year, like the theme and the dock position. */
function remember(area: ListLayoutArea, view: ListLayout) {
  document.cookie = `${LIST_LAYOUT_COOKIES[area]}=${view}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

/** The layout in use; switching is immediate, and the cookie makes the next page (a reload, another filter) render the same way. */
export function useListLayout(area: ListLayoutArea, initial: ListLayout) {
  const [view, setView] = useState(initial);
  const choose = (next: ListLayout) => {
    setView(next);
    remember(area, next);
  };
  return [view, choose] as const;
}

/** Lista · Grade, for the list's toolbar (`ListCard`'s `layout`). */
export function ViewToggle({ view, onChange }: { view: ListLayout; onChange: (view: ListLayout) => void }) {
  return (
    <div role="group" aria-label="Visualização" className="flex rounded-md border bg-background p-0.5">
      {(
        [
          ["list", "Lista", <ListIcon key="list" />],
          ["grid", "Grade", <LayoutGridIcon key="grid" />],
        ] as const
      ).map(([mode, label, icon]) => (
        <Button
          key={mode}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          title={label}
          aria-pressed={view === mode}
          onClick={() => onChange(mode)}
          className={cn("size-7", view === mode ? "bg-accent text-primary hover:bg-accent" : "text-muted-foreground")}
        >
          {icon}
        </Button>
      ))}
    </div>
  );
}

/** The cards, in as many columns as fit. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <ul className="m-0 grid list-none gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</ul>;
}

const InCard = createContext(false);
/** True inside a GridCard: `RowActions` then draws only its button, without a table cell. */
export const useInCard = () => useContext(InCard);

/** The tile at the start of a card: an icon or initials on a soft square. */
export function CardTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-primary [&_svg]:size-5",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * One record as a card. The title's link (or button) stretches over the
 * whole card, so a click anywhere opens the record like a row does; the
 * "…" menu (`actions`, usually the same component as the row's) sits above
 * it and keeps its own clicks.
 *
 *   ┌ tile  Title, up to two lines             … ┐
 *   │       subtitle                              │
 *   │ children (status, progress, values)          │
 *   └ footer: small facts, pushed to the bottom ──┘
 */
export function GridCard({
  href = null,
  external = false,
  onOpen,
  leading,
  title,
  subtitle,
  actions,
  children,
  footer,
}: {
  /** Without a destination (and no `onOpen`) the card is plain. */
  href?: string | null;
  /** Opens outside the Console, in a new tab. */
  external?: boolean;
  /** Opens the record in place (a sheet, a download). */
  onOpen?: () => void;
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const cover =
    "text-foreground no-underline outline-none group-hover/card:text-primary hover:no-underline after:absolute after:inset-0 after:rounded-lg after:content-['']";
  const name = onOpen ? (
    <button type="button" onClick={onOpen} className={cn("text-left", cover)}>
      {title}
    </button>
  ) : !href ? (
    title
  ) : external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cover}>
      {title}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  ) : (
    // No prefetch: a page shows 25+ cards, and opening one already shows the loading state at once.
    <Link href={href} prefetch={false} className={cover}>
      {title}
    </Link>
  );
  return (
    <li
      className={cn(
        "group/card relative flex min-w-0 flex-col rounded-lg border bg-card p-4 transition-colors",
        (href || onOpen) &&
          "hover:border-primary/30 hover:bg-accent/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
      )}
    >
      <div className="flex items-start gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <p className="m-0 line-clamp-2 text-sm leading-5 font-medium break-words">{name}</p>
          {subtitle ? <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions && (
          <div className="relative z-10 -mt-1.5 -mr-2">
            <InCard.Provider value={true}>{actions}</InCard.Provider>
          </div>
        )}
      </div>
      {children && <div className="mt-3 flex min-w-0 flex-col gap-2 text-xs">{children}</div>}
      {footer && (
        <div className="mt-auto flex min-w-0 items-center gap-3 pt-4 text-xs text-muted-foreground">{footer}</div>
      )}
    </li>
  );
}
