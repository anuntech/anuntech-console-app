import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "cn";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * The one page header used by every redesigned screen: optional breadcrumb
 * trail, title with an optional count, one-line description, actions on the
 * right. Keeping the grammar identical across screens is the point.
 */
export function PageHeader({
  crumbs,
  title,
  count,
  description,
  actions,
  leading,
  className,
}: {
  crumbs?: { label: string; href?: string }[];
  title: ReactNode;
  count?: number;
  description?: ReactNode;
  actions?: ReactNode;
  /** Identity slot rendered before the title (avatar, status). */
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-7 flex flex-col gap-4", className)}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            {crumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
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
            {description && (
              <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
        <h2 className="text-[15px] font-semibold leading-6 text-foreground">
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

/** Empty state with the same voice everywhere: what is missing, what to do. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-primary [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-[42ch] text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
