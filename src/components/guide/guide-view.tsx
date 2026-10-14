"use client";
import Link from "next/link";
import { useEffect } from "react";
import { BookOpenIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { markGuideRead } from "@/lib/guide/milestone-actions";
import type { GuideBlock, GuideSection } from "@/lib/guide/guide-content";
import type { TermsFact } from "@/lib/service-terms/terms-text";

export type CompanyTermsView = { company: string; items: { title: string; promises: TermsFact[]; asks: TermsFact[] }[] };

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
      <p className="m-0 mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-foreground marker:text-muted-foreground">
        {facts.map((f) => (
          <li key={f.text}>{f.text}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Como trabalhamos": the guide every client can open from the account menu
 * and from the "Como trabalhamos" links on tickets, projects and quotes. The
 * company's own deadlines show only where its contract is in the Console.
 */
export function GuideView({ sections, terms, staff }: { sections: GuideSection[]; terms: CompanyTermsView[]; staff: boolean }) {
  useEffect(() => {
    void markGuideRead();
  }, []);
  const many = terms.length > 1;
  return (
    <>
      <PageHeader
        className="mb-4"
        crumbs={[{ label: "Ajuda", href: "/ajuda" }, { label: "Como trabalhamos" }]}
        title="Como trabalhamos"
        description="Como a Anuntech atende a sua empresa: chamados, prazos, projetos e contratação."
      />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Seções" className="hidden lg:block">
          <ul className="sticky top-6 m-0 flex list-none flex-col gap-0.5 p-0">
            {sections.map((s) => (
              <li key={s.id}>
                <Link href={`#${s.id}`} className="block rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          <nav aria-label="Seções" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
            {sections.map((s) => (
              <Link key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
                {s.title}
              </Link>
            ))}
          </nav>
          {staff && (
            <p className="m-0 flex items-start gap-2 rounded-lg bg-accent/60 px-4 py-3 text-sm text-foreground">
              <BookOpenIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              Esta é a página que os clientes leem. Os prazos de cada empresa entram em Condições de atendimento, na página da empresa, e aparecem aqui para ela.
            </p>
          )}
          {sections.map((s) => (
            <Card key={s.id} id={s.id} className="scroll-mt-6 gap-4 py-5">
              <CardHeader>
                <h2 className="m-0 text-[15px] leading-6 font-semibold text-foreground">{s.title}</h2>
                <p className="m-0 text-sm text-muted-foreground">{s.lead}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {s.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
                {s.id === "tempo" &&
                  terms.map((c) => (
                    <div key={c.company} className="flex flex-col gap-3 rounded-lg border bg-secondary/40 p-4">
                      <p className="m-0 text-sm font-semibold text-foreground">Seus prazos{many ? ` · ${c.company}` : ""}</p>
                      {c.items.map((item) => (
                        <Facts key={item.title} title={item.title} facts={item.promises} />
                      ))}
                    </div>
                  ))}
                {s.id === "voce" &&
                  terms.map((c) =>
                    c.items.some((i) => i.asks.length) ? (
                      <div key={c.company} className="flex flex-col gap-3 rounded-lg border bg-secondary/40 p-4">
                        <p className="m-0 text-sm font-semibold text-foreground">O que o seu contrato pede{many ? ` · ${c.company}` : ""}</p>
                        {c.items.map((item) => (
                          <Facts key={item.title} title={item.title} facts={item.asks} />
                        ))}
                      </div>
                    ) : null,
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
