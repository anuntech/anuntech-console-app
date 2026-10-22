"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { BookOpenIcon } from "lucide-react";
import { BrandArt } from "@/components/ui/brand-art";
import { PageHeader } from "@/components/console/page-header";
import { TocList } from "@/components/help/toc";
import { markGuideRead } from "@/lib/guide/milestone-actions";
import type { GuideBlock, GuideSection } from "@/lib/guide/guide-content";
import type { TermsFact } from "@/lib/service-terms/terms-text";
import type { CompanyTermsView } from "@/lib/guide/guide-terms";

export type { CompanyTermsView };

function Block({ block }: { block: GuideBlock }) {
  if (block.kind === "p") return <p className="m-0 text-sm leading-6 text-foreground">{block.text}</p>;
  if (block.kind === "list")
    return (
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-foreground marker:text-muted-foreground">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  if (block.kind === "steps")
    return (
      <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-6 text-foreground marker:font-medium marker:text-muted-foreground">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  return (
    <dl className="m-0 grid gap-3">
      {block.items.map((item) => (
        <div key={item.term}>
          <dt className="text-sm font-medium text-foreground">{item.term}</dt>
          <dd className="m-0 text-sm leading-6 text-muted-foreground">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Facts({ title, facts }: { title: string; facts: TermsFact[] }) {
  if (!facts.length) return null;
  return (
    <div>
      <p className="m-0 mb-1.5 text-caption font-medium text-muted-foreground">{title}</p>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-foreground marker:text-muted-foreground">
        {facts.map((f) => (
          <li key={f.text}>{f.text}</li>
        ))}
      </ul>
    </div>
  );
}

/** The company's own terms, inside a section: a soft panel, so it reads as "yours" next to the general text. */
function TermsPanel({ title, company, children }: { title: string; company?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-4 sm:p-5 dark:bg-card">
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
        {title}
        {company && <span className="font-normal text-muted-foreground">{company}</span>}
      </p>
      {children}
    </div>
  );
}

/**
 * "Como trabalhamos": the guide every client can open from the account menu
 * and from the "Como trabalhamos" links on tickets, projects and quotes. The
 * company's own deadlines show only where its contract is in the Console.
 *
 * Laid out to be read: a column of about 80 characters, sections divided by
 * a hairline instead of boxed, and the contents on a rail that marks the
 * section in view.
 */
export function GuideView({ sections, terms, staff }: { sections: GuideSection[]; terms: CompanyTermsView[]; staff: boolean }) {
  useEffect(() => {
    void markGuideRead();
  }, []);
  const many = terms.length > 1;
  return (
    <div className="grid gap-x-10 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,42rem)_minmax(0,1fr)]">
      <div className="flex items-start justify-between gap-8 lg:col-span-2">
        <PageHeader
          className="mb-8 min-w-0"
          crumbs={[{ label: "Ajuda", href: "/ajuda" }, { label: "Como trabalhamos" }]}
          title="Como trabalhamos"
        />
        {/* Blocks being built: how the work comes together. Beside the title from 1024px… */}
        <BrandArt name="blocos" className="hidden w-20 shrink-0 lg:block xl:hidden" />
      </div>
      {/* …and in the margin beside the reading column once there is room for one. */}
      <div className="hidden items-start justify-center pt-2 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:flex">
        <BrandArt name="blocos" className="w-52 2xl:w-60" />
      </div>
      <div className="hidden lg:block">
        <TocList items={sections} label="Seções" className="sticky top-6" />
      </div>
      <div className="flex min-w-0 flex-col gap-8">
        <nav aria-label="Seções" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
          {sections.map((s) => (
            <Link key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
              {s.title}
            </Link>
          ))}
        </nav>
        {staff && (
          <p className="m-0 flex items-start gap-2.5 rounded-xl bg-accent/60 px-4 py-3 text-sm leading-6 text-foreground">
            <BookOpenIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
            Esta é a página que os clientes leem. Os prazos de cada empresa entram em Condições de atendimento, na página da empresa, e aparecem aqui para ela.
          </p>
        )}
        {sections.map((s, index) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-title`}
            className={index > 0 ? "flex scroll-mt-6 flex-col gap-4 border-t pt-8" : "flex scroll-mt-6 flex-col gap-4"}
          >
            <div className="flex flex-col gap-1">
              <h2 id={`${s.id}-title`} className="m-0 text-title-sm text-foreground">
                {s.title}
              </h2>
              <p className="m-0 text-sm leading-6 text-pretty text-muted-foreground">{s.lead}</p>
            </div>
            {s.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
            {s.id === "tempo" &&
              terms.map((c) => (
                <TermsPanel key={c.company} title="Seus prazos" company={many ? c.company : undefined}>
                  {c.items.map((item) => (
                    <Facts key={item.title} title={item.title} facts={item.promises} />
                  ))}
                </TermsPanel>
              ))}
            {s.id === "voce" &&
              terms.map((c) =>
                c.items.some((i) => i.asks.length) ? (
                  <TermsPanel key={c.company} title="O que o seu contrato pede" company={many ? c.company : undefined}>
                    {c.items.map((item) => (
                      <Facts key={item.title} title={item.title} facts={item.asks} />
                    ))}
                  </TermsPanel>
                ) : null,
              )}
          </section>
        ))}
      </div>
    </div>
  );
}
