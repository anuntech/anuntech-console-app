import type { ReactNode } from "react";
import { BrandLockup } from "@/components/shell/brand";

/** The public pages of Arquivos' links: the brand, a title, and the content, nothing of the Console around. */
export function ShareFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-svh bg-secondary/40 px-4 py-10 dark:bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <BrandLockup className="h-6" />
        <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-7">
          <p className="m-0 text-sm text-muted-foreground">{eyebrow}</p>
          <h1 className="m-0 mt-1 text-title-lg text-balance text-foreground [overflow-wrap:anywhere]">{title}</h1>
          {description && <div className="mt-2 text-sm text-muted-foreground">{description}</div>}
          <div className="mt-6">{children}</div>
        </section>
        <p className="m-0 text-center text-xs text-muted-foreground">Enviado pelo Console da Anuntech. Não compartilhe este link com quem não deve ver estes arquivos.</p>
      </div>
    </main>
  );
}
