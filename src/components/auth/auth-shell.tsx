import type { ReactNode } from "react";
import { LockKeyholeIcon } from "lucide-react";
import { BrandLockup } from "@/components/shell/brand";

export type AuthIntro = {
  headline: ReactNode;
  text: string;
};

/**
 * The frame every access screen shares: the logo at the top and one narrow,
 * centred column with the title and the form. Nothing competes with the
 * task; on phones it is the same column.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /** Older screens pass a pitch; only its sentence is kept, as the description. */
  intro?: AuthIntro;
  children: ReactNode;
}) {
  const lead = description ?? intro?.text;
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 items-center px-6 sm:px-8">
        <BrandLockup className="h-6" />
      </header>
      <div className="flex flex-1 items-center justify-center px-6 pt-6 pb-16 sm:px-10">
        <div className="w-full max-w-[22.5rem]">
          <p className="text-sm text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-1 text-title-lg text-foreground">{title}</h1>
          {lead && <p className="mt-2 text-sm text-muted-foreground">{lead}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <footer className="flex items-center justify-center gap-1.5 px-6 pb-6 text-xs text-muted-foreground">
        <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
        Cada pessoa entra com o próprio e-mail ou WhatsApp.
      </footer>
    </div>
  );
}
