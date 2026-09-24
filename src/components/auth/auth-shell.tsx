import Image from "next/image";
import type { ReactNode } from "react";
import {
  FileTextIcon,
  HeadphonesIcon,
  Layers3Icon,
  LockKeyholeIcon,
} from "lucide-react";

const DEFAULT_INTRO = {
  eyebrow: "Seu espaço na Anuntech",
  headline: (
    <>
      Tudo que conecta sua empresa à <span className="text-[#8fb3ff]">Anuntech.</span>
    </>
  ),
  text: "Acompanhe seus serviços, converse com a equipe e organize seus pagamentos em um só lugar.",
  features: [
    { icon: <Layers3Icon />, label: "Produtos e serviços da sua empresa" },
    { icon: <HeadphonesIcon />, label: "Atendimento perto de você" },
    { icon: <FileTextIcon />, label: "Faturas e contratos organizados" },
  ],
};

export type AuthIntro = {
  eyebrow?: string;
  headline: ReactNode;
  text: string;
  features?: { icon: ReactNode; label: string }[];
};

/**
 * The frame every access screen shares: the brand on the left, one focused
 * card on the right. On phones the brand shrinks to a top bar so the form
 * comes first.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  intro = DEFAULT_INTRO,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  intro?: AuthIntro;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside
        aria-label="Anuntech"
        className="relative hidden overflow-hidden bg-[#011e41] text-white lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-32 size-[560px] rounded-full bg-[#1a428a]/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-24 size-[480px] rounded-full bg-[#1a428a]/30 blur-3xl"
        />
        <Image
          src="/brand/logo-anuntech.png"
          alt="Anuntech"
          width={1200}
          height={372}
          priority
          className="relative h-9 w-auto self-start brightness-0 invert"
        />
        <div className="relative max-w-md">
          {intro.eyebrow && (
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/55 uppercase">
              {intro.eyebrow}
            </p>
          )}
          <h2 className="mt-4 text-4xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance xl:text-5xl">
            {intro.headline}
          </h2>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-white/70">
            {intro.text}
          </p>
          {intro.features && (
            <ul className="mt-8 grid gap-3">
              {intro.features.map((feature) => (
                <li
                  key={feature.label}
                  className="flex items-center gap-3 text-sm text-white/85"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 [&_svg]:size-4">
                    {feature.icon}
                  </span>
                  {feature.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="relative text-xs text-white/50">Anuntech · Portal do cliente</p>
      </aside>

      <section className="flex min-h-svh flex-col lg:min-h-0">
        <header className="flex items-center px-6 pt-6 lg:hidden">
          <Image
            src="/brand/logo-anuntech.png"
            alt="Anuntech"
            width={1200}
            height={372}
            priority
            className="h-8 w-auto dark:brightness-0 dark:invert"
          />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-sm">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            )}
            <div className="mt-7">{children}</div>
          </div>
        </div>
        <footer className="flex items-center justify-center gap-1.5 px-6 pb-6 text-xs text-muted-foreground">
          <LockKeyholeIcon className="size-3.5" aria-hidden="true" />
          Seu acesso é pessoal e protegido.
        </footer>
      </section>
    </div>
  );
}
