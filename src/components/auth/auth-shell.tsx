import type { ReactNode } from "react";
import { LockKeyholeIcon } from "lucide-react";
import { BrandLockup } from "@/components/shell/brand";
import { BrandArt } from "@/components/ui/brand-art";

export type AuthIntro = {
  headline: ReactNode;
  text: string;
};

/**
 * The frame every access screen shares: the logo at the top and one narrow
 * column with the title and the form. From 1024px a brand panel sits on the
 * right (the sphere, half smooth and half pixel, on the pixel field); on
 * phones it is the form alone (the texture only goes beside the art). Nothing
 * in the panel competes with the task: it is decorative and never moves
 * after it arrives.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  intro,
  children,
}: {
  /** A short label above the title, when the title alone does not place the screen. */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Older screens pass a pitch; only its sentence is kept, as the description. */
  intro?: AuthIntro;
  children: ReactNode;
}) {
  const lead = description ?? intro?.text;
  return (
    <div className="flex min-h-svh bg-background">
      {/* z-10: the confirmed-access vignette (fixed, inside the form) stays above the panel. */}
      <div className="relative isolate z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center px-6 sm:px-8">
          <BrandLockup className="h-6" />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 pt-6 pb-16 sm:px-10">
          <div className="w-full max-w-[22.5rem]">
            {/* Only the heading rises here: the forms place their own arrivals, so the
                full-screen vignette inside them is never caught under a transform. */}
            <div className="reveal">
              {eyebrow && <p className="mb-1 text-sm text-muted-foreground">{eyebrow}</p>}
              <h1 className="text-title-lg text-balance text-foreground">{title}</h1>
              {lead && <p className="mt-2 text-sm text-pretty text-muted-foreground">{lead}</p>}
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <footer className="flex items-center justify-center gap-1.5 px-6 pb-6 text-xs text-muted-foreground">
          <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
          Cada pessoa entra com o próprio e-mail ou WhatsApp.
        </footer>
      </div>
      <div
        className="relative isolate m-3 hidden w-[46%] max-w-[46rem] shrink-0 flex-col overflow-hidden rounded-3xl bg-secondary lg:flex dark:bg-card"
      >
        <span
          aria-hidden="true"
          className="pixel-field pointer-events-none absolute inset-0 -z-10 [--pixel-from:100%_0%] [--pixel-strength:6%]"
        />
        <div className="flex flex-1 items-center justify-center px-12 pt-16 pb-6">
          <BrandArt name="esfera" glow className="w-full max-w-[26rem]" />
        </div>
        <div className="reveal px-12 pb-12 [--i:6]">
          <p className="text-title text-foreground">Do bruto ao produto.</p>
          <p className="mt-1.5 max-w-[38ch] text-sm text-pretty text-muted-foreground">
            Chamados, projetos, faturas e contratos da sua empresa com a Anuntech, num lugar só.
          </p>
        </div>
      </div>
    </div>
  );
}
