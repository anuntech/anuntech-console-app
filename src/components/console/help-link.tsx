import Link from "next/link";
import type { ReactNode } from "react";
import { LifeBuoyIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A short way to the help article about what is on screen ("Como pagar"),
 * small and in the text's flow: the help center has no button of its own.
 */
export function HelpLink({ slug, children, className, newTab = false }: { slug: string; children: ReactNode; className?: string; newTab?: boolean }) {
  return (
    <Link
      href={`/ajuda/${slug}`}
      className={cn("inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline", className)}
      {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
    >
      <LifeBuoyIcon aria-hidden="true" className="size-3.5" />
      {children}
      {newTab && <span className="sr-only"> (abre em nova aba)</span>}
    </Link>
  );
}
