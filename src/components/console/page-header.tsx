import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BrandArt, type SpotArtName } from "@/components/ui/brand-art";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * The one page header used by every redesigned screen: optional breadcrumb
 * trail, title with an optional count, one line of facts (`meta`), one-line
 * description, actions on the right. Keeping the grammar identical across
 * screens is the point.
 *
 * One fact, one place: the breadcrumb shows only the way back (parents with a
 * link); a last crumb without `href` is the current page, which the h1
 * already names, so it is not drawn. `meta` drops empty items, so a missing
 * value leaves no gap or dangling separator.
 *
 * It rises into place when the page arrives (bridging the loading skeleton);
 * it persists across filter and page changes, so it does not replay.
 */
export function PageHeader({
  crumbs,
  title,
  count,
  meta,
  description,
  actions,
  leading,
  actionsInline = false,
  className,
}: {
  /** Parents only. A trailing crumb without `href` (the page itself) is dropped: the h1 names it. */
  crumbs?: { label: string; href?: string }[];
  title: ReactNode;
  count?: number;
  /**
   * Short facts under the title, in this order: status badge, the record it
   * belongs to (company or project link), one key value. Falsy items are
   * skipped. Each fact appears here or in the page body, never both.
   */
  meta?: ReactNode[];
  description?: ReactNode;
  actions?: ReactNode;
  /** Identity slot rendered before the title (avatar, status). */
  leading?: ReactNode;
  /** Icon-only actions (the "…" menu) stay beside the title on phones instead of wrapping to a row of their own. */
  actionsInline?: boolean;
  className?: string;
}) {
  const trail = crumbs?.at(-1)?.href ? crumbs : crumbs?.slice(0, -1);
  const facts = meta?.filter((item) => item !== null && item !== undefined && item !== false && item !== "");
  return (
    <header className={cn("reveal mb-7 flex flex-col gap-4", className)}>
      {trail && trail.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            {trail.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    // A parent without its own page (a group); on a phone the trail stays on one line.
                    <span className="max-w-[24ch] truncate sm:max-w-[48ch]">{crumb.label}</span>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div
        className={cn(
          "flex items-start justify-between gap-y-3",
          actionsInline ? "flex-nowrap gap-x-3" : "flex-wrap gap-x-6",
        )}
      >
        <div className={cn("flex min-w-0 items-center gap-4", actionsInline && "flex-1")}>
          {leading}
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-title-lg text-foreground">
              <span className="min-w-0 break-words">{title}</span>
              {typeof count === "number" && (
                <span className="rounded-full bg-secondary px-2 py-0.5 font-sans text-xs font-medium tabular-nums text-secondary-foreground">
                  {count}
                </span>
              )}
            </h1>
            {facts && facts.length > 0 && (
              // Spaced, not dotted: a dot left at the end of a wrapped line dangles.
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {facts.map((fact, index) => (
                  <Fragment key={index}>{fact}</Fragment>
                ))}
              </div>
            )}
            {description && (
              <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          // min-w-0, not shrink-0: on a phone the actions wrap instead of pushing the page sideways.
          <div className={cn("flex min-w-0 flex-wrap items-center gap-2", actionsInline && "shrink-0")}>
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

/** Section heading inside a page or card body. */
export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-body font-medium text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  );
}

/** Literal classes, so Tailwind finds them. */
const STEP = { 2: "reveal [--i:2]", 3: "reveal [--i:3]", 4: "reveal [--i:4]" } as const;

/**
 * Empty state with the same voice everywhere: what is missing, what to do.
 *
 * Page-level empties (a list with nothing yet, a search with no match) show
 * the brand illustration of their area with `art`; small empties inside a
 * card keep the `icon` tile. With `art="busca"` the art only fades, since it
 * comes and goes while the person types.
 *
 *   art="chamados"  tickets, a conversation with no messages
 *   art="faturas"   invoices, quotes, contracts, sends
 *   art="projetos"  projects, journeys, bookmarks, products
 *   art="busca"     any list with filters or search and no result, 404
 */
export function EmptyState({
  art,
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  art?: SpotArtName;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** `compact`: smaller art and padding, for an empty area inside a card. */
  size?: "default" | "compact";
  className?: string;
}) {
  const search = art === "busca";
  // The text follows the art in; a search result swaps often, so it only fades.
  const enter = (step: 2 | 3 | 4) => (!art ? undefined : search ? "reveal-fade" : STEP[step]);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "compact" ? "px-4 py-8" : art ? "px-6 py-12" : "px-6 py-14",
        className,
      )}
    >
      {art ? (
        <BrandArt
          name={art}
          animate={search ? "fade" : "build"}
          className={cn(size === "compact" ? "mb-3 w-28" : "mb-5 w-40 sm:w-48")}
        />
      ) : (
        icon && (
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground [&_svg]:size-5">
            {icon}
          </div>
        )
      )}
      <p className={cn("font-medium text-foreground", art && size !== "compact" ? "text-body" : "text-sm", enter(2))}>{title}</p>
      {description && (
        <p className={cn("mt-1 max-w-[42ch] text-sm text-pretty text-muted-foreground", enter(3))}>{description}</p>
      )}
      {action && <div className={cn(size === "compact" ? "mt-4" : "mt-5", enter(4))}>{action}</div>}
    </div>
  );
}
