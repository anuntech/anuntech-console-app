import { BrandLockup } from "@/components/shell/brand";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BrandArt, type SpotArtName } from "@/components/ui/brand-art";

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
  art,
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
  /** The brand illustration: `busca` for "not found", `chamados` for errors. Not with a numeral. */
  art?: SpotArtName;
  /** A small icon tile, where there is no illustration. */
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
      ) : art ? (
        // The pixel field and the light stay behind the art only.
        <div className="relative isolate">
          <span aria-hidden="true" className="pixel-field pointer-events-none absolute -inset-x-20 -inset-y-10 -z-10 [--pixel-from:50%_50%]" />
          <BrandArt name={art} glow className="w-44 sm:w-52" />
        </div>
      ) : (
        icon && (
          <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground [&_svg]:size-6">
            {icon}
          </div>
        )
      )}
      {eyebrow && (
        <p className={cn("text-caption font-medium text-muted-foreground", numeral ? "mt-4" : "mt-6")}>{eyebrow}</p>
      )}
      <h1
        className={cn(
          "text-title text-balance text-foreground",
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
    // overflow-x-clip: the pixel field behind the art reaches past narrow screens.
    return <section className="flex min-h-[60vh] items-center justify-center overflow-x-clip px-2 py-12">{body}</section>;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="px-6 pt-6 sm:px-10">
        <Link href="/" aria-label="Anuntech" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLockup className="h-6" />
        </Link>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center overflow-x-clip px-6 py-16 outline-none">
        {body}
      </main>
    </div>
  );
}
