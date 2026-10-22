"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChevronRightIcon, HeadsetIcon, MessageCircleQuestionIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandArt } from "@/components/ui/brand-art";
import { EmptyState, PageHeader } from "@/components/console/page-header";
import { SearchField } from "@/components/console/search-field";
import { openAssistant } from "@/components/shell/assistant-events";
import { openSupportWidget } from "@/components/shell/support-trigger";
import { HELP_ARTICLES as articles } from "@/lib/help/articles";
import { HELP_CATEGORIES, categoryOf, type HelpArticle } from "@/lib/help/help-model";
import { searchHelp } from "@/lib/help/help-search";
import { TUTORIALS } from "@/lib/help/tutorials";
import { TOP_QUESTIONS } from "@/lib/help/help-view";
import { HelpFaqList } from "./help-content";
import { CategoryTile } from "./help-icons";
import { durationLabel } from "./tutorial-player";

export type HelpViewer = { staff: boolean; manager: boolean; support: boolean };

/** "Só Administrador", next to what a Membro cannot do himself. */
export function AdminOnly({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground ${className}`}>
      Administrador
    </span>
  );
}

function ArticleRow({
  article,
  showCategory = false,
  markAdmin = false,
}: {
  article: HelpArticle;
  showCategory?: boolean;
  /** Only a Membro needs to know an article is the Administrador's; whoever administers already is. */
  markAdmin?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/ajuda/${article.slug}`}
        className="group flex min-h-11 items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {showCategory && <CategoryTile id={article.category} className="mt-0.5 size-8" />}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-foreground group-hover:text-primary">{article.title}</span>
            {markAdmin && article.audience === "administrador" && <AdminOnly />}
            {article.video && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                <PlayIcon aria-hidden="true" className="size-3 fill-current" />
                Vídeo
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {showCategory && `${categoryOf(article.category).title} · `}
            {article.summary}
          </span>
        </span>
        <ChevronRightIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground/60 group-hover:text-primary" />
      </Link>
    </li>
  );
}

export function NotFoundHelp({ viewer }: { viewer: HelpViewer }) {
  return (
    <Card className="gap-4 px-5 py-5 sm:px-6">
      <div>
        <h2 className="m-0 text-body font-medium text-foreground">Não encontrou o que procurava?</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={openAssistant}>
          <SparklesIcon />
          Perguntar ao assistente
        </Button>
        {(viewer.support || viewer.staff) && (
          <Button variant="outline" asChild>
            <Link href="/chamados/novo?tipo=duvida">
              <HeadsetIcon />
              Abrir chamado
            </Link>
          </Button>
        )}
        <Button type="button" variant="outline" onClick={openSupportWidget}>
          <MessageCircleQuestionIcon />
          Conversar com a equipe
        </Button>
      </div>
    </Card>
  );
}

/**
 * The help center: search over every article, the tutorial videos, each area
 * with its articles, Como trabalhamos, the common questions and where to ask
 * when the answer is not here. Everyone reads everything; what only an
 * Administrador does is marked.
 */
// Each video opens with the article that explains the same thing.
const tutorials = TUTORIALS.flatMap((tutorial) => {
  const article = articles.find((a) => a.video === tutorial.id);
  return article ? [{ tutorial, slug: article.slug }] : [];
});

/* The articles come with this component's code (cached with the bundle), not in the page's data. */
export function HelpHub({ query, viewer }: { query: string; viewer: HelpViewer }) {
  const router = useRouter();
  // The sections arrive in sequence only on the first visit; after a search they just come back.
  const [fresh, setFresh] = useState(!query.trim());
  const search = useCallback(
    (q: string) => {
      setFresh(false);
      router.replace(q.trim() ? `/ajuda?q=${encodeURIComponent(q)}` : "/ajuda", { scroll: false });
    },
    [router],
  );
  const results = useMemo(() => (query.trim() ? searchHelp(articles, query, { limit: 30 }) : []), [query]);
  const top = TOP_QUESTIONS.map((slug) => articles.find((a) => a.slug === slug)).filter((a): a is HelpArticle => !!a?.faq?.length);

  return (
    <div className="flex flex-col gap-10">
      {/* The hero: title and search on the left; from 1024px the brand story on the
          right (a spreadsheet becoming a system) over the pixel field. */}
      <section className="relative isolate grid items-start gap-x-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="flex min-w-0 flex-col">
          {/* No description: the search, the videos and the subjects below already say what is here. */}
          <PageHeader className="mb-5" title="Ajuda" />
          <div className="reveal flex flex-col gap-2 [--i:1]">
            <SearchField
              value={query}
              onChange={search}
              placeholder="Busque por assunto: boleto, convite, prazo, contrato..."
              ariaLabel="Buscar na ajuda"
              className="max-w-2xl [&_input]:h-11 [&_input]:rounded-xl [&_input]:text-base"
            />
            <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
              {query.trim() && results.length > 0 && `${results.length} ${results.length === 1 ? "artigo encontrado" : "artigos encontrados"}`}
            </p>
          </div>
        </div>
        {/* pr-12: the art's glow reaches past it; the extra room keeps it inside the page (no sideways scroll at 1440px). */}
        <div className="relative hidden py-6 pr-12 pl-4 lg:block">
          <span aria-hidden="true" className="pixel-field pointer-events-none absolute inset-0 -z-10 [--pixel-from:55%_45%] [--pixel-strength:5.5%]" />
          <BrandArt name="planilha" glow className="w-full" />
        </div>
      </section>

      {query.trim() ? (
        <>
          {results.length === 0 && (
            <EmptyState
              art="busca"
              title="Nenhum artigo encontrado"
              description="Tente outra palavra, como boleto, convite, prazo ou contrato."
              className="py-6"
            />
          )}
          {results.length > 0 && (
            <Card className="py-2">
              <ul className="m-0 flex list-none flex-col p-1">
                {results.map(({ article }) => (
                  <ArticleRow key={article.slug} article={article} showCategory markAdmin={!viewer.staff && !viewer.manager} />
                ))}
              </ul>
            </Card>
          )}
          <NotFoundHelp viewer={viewer} />
        </>
      ) : (
        <>
          {tutorials.length > 0 && (
            <section aria-labelledby="videos" className="flex flex-col gap-3">
              <h2 id="videos" className="m-0 text-title-sm text-foreground">
                Tutoriais em vídeo
              </h2>
              {/* grid-cols-1: one explicit column on phones, or the truncated line widens the track. */}
              <ul className={`m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3 ${fresh ? "stagger" : ""}`}>
                {tutorials.map(({ tutorial, slug }) => (
                  <li key={tutorial.id}>
                    <Link
                      href={`/ajuda/${slug}#video`}
                      className="press group flex h-full items-center gap-3 rounded-xl border bg-card px-3.5 py-3 hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {/* Neutral at rest, so seven discs do not shout; the brand colour comes with the pointer. */}
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-focus-visible:bg-primary group-focus-visible:text-primary-foreground">
                        <PlayIcon aria-hidden="true" className="ml-0.5 size-4 fill-current" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground group-hover:text-primary">{tutorial.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          <span className="tabular-nums">{durationLabel(tutorial.duration)}</span> · {tutorial.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="assuntos" className="flex flex-col gap-3">
            <h2 id="assuntos" className="m-0 text-title-sm text-foreground">
              Assuntos
            </h2>
            {/* Columns, not a grid: each card keeps its own height. */}
            <div className="gap-4 md:columns-2 xl:columns-3">
              {HELP_CATEGORIES.map((category) => {
                const items = articles.filter((a) => a.category === category.id);
                if (!items.length) return null;
                return (
                  <Card key={category.id} id={category.id} className="mb-4 scroll-mt-6 break-inside-avoid gap-3 px-2 py-4">
                    <div className="flex items-center gap-3 px-3">
                      <CategoryTile id={category.id} />
                      {/* The articles below are the description: a line restating them would be read twice. */}
                      <h3 className="m-0 min-w-0 text-body font-medium text-foreground">{category.title}</h3>
                    </div>
                    <ul className="m-0 flex list-none flex-col p-0">
                      {items.map((article) => (
                        <li key={article.slug}>
                          <Link
                            href={`/ajuda/${article.slug}`}
                            className="group flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/50 hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            <span className="min-w-0 flex-1">{article.title}</span>
                            {article.audience === "administrador" && !viewer.staff && !viewer.manager && <AdminOnly />}
                            {article.video && <PlayIcon aria-label="Com vídeo" className="size-3 shrink-0 fill-current text-primary" />}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          </section>

          {top.length > 0 && (
            <section aria-labelledby="perguntas" className="flex flex-col gap-3">
              <h2 id="perguntas" className="m-0 text-title-sm text-foreground">
                Perguntas frequentes
              </h2>
              <Card className="px-5 py-1 sm:px-6">
                <HelpFaqList
                  title={null}
                  faq={top.map((article) => ({
                    q: article.faq![0].q,
                    a: `${article.faq![0].a} [Ler o artigo](/ajuda/${article.slug})`,
                  }))}
                />
              </Card>
            </section>
          )}

          <NotFoundHelp viewer={viewer} />
        </>
      )}
    </div>
  );
}
