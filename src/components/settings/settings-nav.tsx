"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SettingsSection =
  | "account"
  | "security"
  | "appearance"
  | "company"
  | "members"
  | "notifications"
  | "catalog"
  | "contracts"
  | "integrations"
  | "automations"
  | "cleanup"
  | "assistant";

export type SettingsGroup = {
  title: string;
  items: { key: SettingsSection; href: string; label: string; icon: ReactNode }[];
};

/**
 * The left rail of every settings page. Below 1024px it becomes one row of
 * chips that scrolls sideways (groups split by a hairline), so the section's
 * content starts right under it instead of below a wall of links; the page
 * open is scrolled into view.
 */
export function SettingsNav({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname();
  const row = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const scroller = row.current;
    const link = current.current;
    // Only when the row actually scrolls (phones and tablets); scrollLeft never moves the page.
    if (!scroller || !link || scroller.scrollWidth <= scroller.clientWidth) return;
    // Leave a sliver of the previous chip in view, so the row reads as scrollable both ways.
    scroller.scrollLeft = link.offsetLeft - 60;
  }, [pathname]);
  return (
    <nav aria-label="Categorias dos ajustes">
      <div
        ref={row}
        // Both edges fade once the row has been scrolled; at rest only the right one does.
        onScroll={(event) => event.currentTarget.toggleAttribute("data-scrolled", event.currentTarget.scrollLeft > 4)}
        className={cn(
          "relative -mx-1 flex items-center gap-1 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]",
          "data-scrolled:[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]",
          // The 4px padding keeps the focus ring inside the scroller; the rail on desktop needs neither.
          "lg:mx-0 lg:flex-col lg:items-stretch lg:gap-6 lg:overflow-visible lg:p-0 lg:[mask-image:none] lg:data-scrolled:[mask-image:none]",
        )}
      >
        {groups.map((group, index) => (
          <Fragment key={group.title}>
            {index > 0 && <span aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-border lg:hidden" />}
            <div className="flex shrink-0 items-center lg:block lg:min-w-0">
              <p className="sr-only lg:not-sr-only lg:mb-1.5 lg:px-2.5 lg:text-caption lg:font-medium lg:text-muted-foreground">
                {group.title}
              </p>
              <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.key} className="shrink-0">
                      <Link
                        ref={active ? current : undefined}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0",
                          "lg:gap-2.5 lg:rounded-lg lg:px-2.5 lg:py-2",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Fragment>
        ))}
      </div>
    </nav>
  );
}
