"use client";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { splitLinks, type HelpBlock, type HelpFaq, type HelpSection } from "@/lib/help/help-model";

/** Where links in help text open: in place, or in a new tab when the reader is mid-form (the ticket form keeps no draft). */
export type LinkMode = "same" | "new-tab";

/** A help text with its [rótulo](/caminho) links. */
export function HelpText({ text, links = "same" }: { text: string; links?: LinkMode }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        "text" in part ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : (
          <Link
            key={i}
            href={part.href}
            className="font-medium text-primary underline-offset-4 hover:underline"
            {...(links === "new-tab" ? { target: "_blank", rel: "noopener" } : {})}
          >
            {part.label}
            {links === "new-tab" && <span className="sr-only"> (abre em nova aba)</span>}
          </Link>
        ),
      )}
    </>
  );
}

const text = "text-sm leading-6 text-foreground";

export function HelpBlockView({ block, links }: { block: HelpBlock; links?: LinkMode }) {
  if (block.kind === "p")
    return (
      <p className={cn("m-0", text)}>
        <HelpText text={block.text} links={links} />
      </p>
    );
  if (block.kind === "note") {
    const attention = block.tone === "attention";
    const Icon = attention ? TriangleAlertIcon : InfoIcon;
    return (
      <p
        className={cn(
          "m-0 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-6",
          attention ? "border-warning-edge bg-warning-soft text-foreground" : "border-transparent bg-accent/60 text-foreground",
        )}
      >
        <Icon aria-hidden="true" className={cn("mt-1 size-4 shrink-0", attention ? "text-warning" : "text-primary")} />
        <span>
          <span className="sr-only">{attention ? "Atenção: " : "Observação: "}</span>
          <HelpText text={block.text} links={links} />
        </span>
      </p>
    );
  }
  if (block.kind === "list")
    return (
      <ul className={cn("m-0 flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground", text)}>
        {block.items.map((item) => (
          <li key={item}>
            <HelpText text={item} links={links} />
          </li>
        ))}
      </ul>
    );
  if (block.kind === "steps")
    return (
      <ol className="m-0 flex list-none flex-col gap-3 p-0 [counter-reset:step]">
        {block.items.map((item) => (
          <li
            key={item}
            className={cn(
              "relative pl-9 [counter-increment:step] before:absolute before:top-0 before:left-0 before:flex before:size-6 before:items-center before:justify-center before:rounded-full before:bg-accent before:text-xs before:font-semibold before:text-primary before:content-[counter(step)]",
              text,
            )}
          >
            <HelpText text={item} links={links} />
          </li>
        ))}
      </ol>
    );
  return (
    <dl className="m-0 grid gap-3">
      {block.items.map((item) => (
        <div key={item.term}>
          <dt className="text-sm font-medium text-foreground">{item.term}</dt>
          <dd className="m-0 text-sm leading-6 text-muted-foreground">
            <HelpText text={item.text} links={links} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The anchor of a section ("Como pagar com Pix" → "como-pagar-com-pix"), for "Neste artigo". */
export function sectionAnchor(title: string) {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function HelpSections({ sections, links, compact = false }: { sections: HelpSection[]; links?: LinkMode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-6" : "gap-9")}>
      {sections.map((section) => (
        <section key={section.title} id={sectionAnchor(section.title)} className="flex scroll-mt-6 flex-col gap-3.5">
          <h2 className={cn("m-0 font-semibold tracking-[-0.01em] text-foreground", compact ? "text-[15px]" : "text-lg")}>{section.title}</h2>
          {section.blocks.map((block, i) => (
            <HelpBlockView key={i} block={block} links={links} />
          ))}
        </section>
      ))}
    </div>
  );
}

export function HelpFaqList({ faq, links, title = "Perguntas frequentes" }: { faq: HelpFaq[]; links?: LinkMode; title?: ReactNode }) {
  if (!faq.length) return null;
  return (
    <section id="perguntas-frequentes" className="scroll-mt-6">
      {title && <h2 className="m-0 mb-1 text-lg font-semibold tracking-[-0.01em] text-foreground">{title}</h2>}
      <Accordion type="multiple">
        {faq.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger className="text-[15px] text-foreground hover:no-underline">{item.q}</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">
              <HelpText text={item.a} links={links} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
