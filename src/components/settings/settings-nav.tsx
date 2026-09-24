"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";

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
  | "assistant";

export type SettingsGroup = {
  title: string;
  items: { key: SettingsSection; href: string; label: string; icon: ReactNode }[];
};

/** The left rail of every settings page; a wrapping row of chips on phones. */
export function SettingsNav({ groups }: { groups: SettingsGroup[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Categorias dos ajustes"
      className="flex flex-wrap gap-x-6 gap-y-4 lg:flex-col lg:gap-6"
    >
      {groups.map((group) => (
        <div key={group.title} className="min-w-0">
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {group.title}
          </p>
          <ul className="flex flex-wrap gap-0.5 lg:flex-col">
            {group.items.map((item) => {
              const current = pathname === item.href;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                      current
                        ? "bg-accent text-primary"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
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
      ))}
    </nav>
  );
}
