import { BrandLockup } from "@/components/shell/brand";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * The one shape of every error and "not found" screen: what happened, what
 * the person can do, and a reference for the team when there is one.
 *
 * `page` fills the window with the brand on top, for screens outside the app
 * (sign-in, payment links, a broken root layout). `inline` sits inside the
 * app's content area, so the dock stays within reach.
 */
export function StatusPage({
  layout = "page",
  eyebrow,
  numeral,
  icon,
  title,
  description,
  actions,
  reference,
  footnote,
}: {
  layout?: "page" | "inline";
  /** A short label above the title: "Erro 404", "Link de pagamento". Left out under a numeral that already says it. */
  eyebrow?: string;
  /** A large status number ("404"); only where people know what it means. */
  numeral?: string;
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  /** An error's digest: the team finds the matching server log with it. */
  reference?: string;
  footnote?: ReactNode;
}) {
  const body = (
    <div className="flex w-full max-w-md flex-col items-center text-center">
      {numeral ? (
        <p
          aria-hidden="true"
          className="bg-gradient-to-b from-primary to-primary/25 bg-clip-text text-[6.5rem] leading-none font-semibold tracking-[-0.06em] text-transparent select-none sm:text-[8rem]"
        >
          {numeral}
        </p>
      ) : (
        icon && (
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary [&_svg]:size-6">
            {icon}
          </div>
        )
      )}
      {eyebrow && (
        <p className={cn("text-[11px] font-semibold tracking-[0.14em] text-primary uppercase", numeral ? "mt-4" : "mt-6")}>
          {eyebrow}
        </p>
      )}
      <h1
        className={cn(
          "text-2xl font-semibold tracking-[-0.02em] text-balance text-foreground",
          eyebrow ? "mt-2" : numeral ? "mt-4" : "mt-6",
        )}
      >
        {title}
      </h1>
      <div className="mt-3 max-w-[46ch] text-sm leading-relaxed text-pretty text-muted-foreground">{description}</div>
      {actions && <div className="mt-7 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      {reference && (
        <p className="mt-6 text-xs text-muted-foreground">
          Código do erro: <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground select-all">{reference}</code>
        </p>
      )}
      {footnote && <div className="mt-6 text-xs text-muted-foreground">{footnote}</div>}
    </div>
  );

  if (layout === "inline")
    return <section className="flex min-h-[60vh] items-center justify-center px-2 py-12">{body}</section>;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="px-6 pt-6 sm:px-10">
        <Link href="/" aria-label="Anuntech" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLockup className="h-6" />
        </Link>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-6 py-16 outline-none">
        {body}
      </main>
    </div>
  );
}
