"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLinkIcon, LifeBuoyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HELP_ARTICLES } from "@/lib/help/articles";
import { searchHelp } from "@/lib/help/help-search";
import type { HelpArticle } from "@/lib/help/help-model";
import { HelpFaqList, HelpSections } from "./help-content";

/**
 * An article over the page, for readers in the middle of something (the
 * ticket form keeps no draft): links inside open in a new tab, and the full
 * page is one click away.
 */
export function HelpArticleSheet({ article, onOpenChange }: { article: HelpArticle | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!article} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {article && (
          <>
            <SheetHeader className="gap-1 border-b px-5 py-4 pr-12">
              <SheetTitle className="text-lg">{article.title}</SheetTitle>
              <SheetDescription>{article.summary}</SheetDescription>
              <Link
                href={`/ajuda/${article.slug}`}
                target="_blank"
                rel="noopener"
                className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Abrir o artigo{article.video ? " com o vídeo" : ""} em nova aba
                <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
              </Link>
            </SheetHeader>
            <div className="flex flex-col gap-8 px-5 py-5">
              <HelpSections sections={article.sections} links="new-tab" compact />
              {article.faq && <HelpFaqList faq={article.faq} links="new-tab" />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * "Talvez isto responda": while a client writes a ticket, the articles that
 * match what they typed. Opening one never leaves the form; nothing stops
 * them from sending the ticket.
 */
export function HelpSuggestions({ text, prefer }: { text: string; prefer?: boolean }) {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const [open, setOpen] = useState<HelpArticle | null>(null);
  const matches = useMemo(() => {
    if ((settled.match(/\p{L}/gu)?.length ?? 0) < 4) return [];
    // A question ("Dúvida") gets more suggestions than a problem report.
    return searchHelp(HELP_ARTICLES, settled, { limit: prefer ? 3 : 2, minScore: prefer ? 5 : 7 });
  }, [settled, prefer]);
  return (
    <div aria-live="polite">
      {matches.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/15 bg-accent/40 px-3 py-3">
          <p className="m-0 flex items-center gap-2 text-xs font-medium text-foreground">
            <LifeBuoyIcon aria-hidden="true" className="size-3.5 text-primary" />
            Talvez isto responda
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {matches.map(({ article }) => (
              <li key={article.slug}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(article)}
                  className="h-auto w-full justify-start px-2 py-1.5 text-left whitespace-normal"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-primary">{article.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{article.summary}</span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          <p className="m-0 text-xs text-muted-foreground">Se não resolver, siga com o chamado. Nada do que você escreveu se perde.</p>
        </div>
      )}
      <HelpArticleSheet article={open} onOpenChange={(value) => !value && setOpen(null)} />
    </div>
  );
}
