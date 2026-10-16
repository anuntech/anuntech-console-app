"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { ChevronRightIcon, HeadsetIcon, MessageCircleQuestionIcon, PlayIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/console/search-field";
import { openAssistant } from "@/components/shell/assistant-events";
import { openSupportWidget } from "@/components/shell/support-trigger";
import { HELP_ARTICLES as articles } from "@/lib/help/articles";
import { HELP_CATEGORIES, categoryOf, type HelpArticle } from "@/lib/help/help-model";
import { searchHelp } from "@/lib/help/help-search";
import { TUTORIALS } from "@/lib/help/tutorials";
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

function ArticleRow({ article, showCategory = false }: { article: HelpArticle; showCategory?: boolean }) {
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
            {article.audience === "administrador" && <AdminOnly />}
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

/** The questions people ask most, picked by article (the first question of each). */
const TOP_QUESTIONS = [
  "entrar",
  "abrir-um-chamado",
  "situacoes-do-chamado",
  "prazos-de-atendimento",
  "pagar-uma-fatura",
  "membro-ou-administrador",
  "assinar-um-contrato",
  "responder-um-orcamento",
  "notificacoes",
  "quadro-do-projeto",
];

export function NotFoundHelp({ viewer }: { viewer: HelpViewer }) {
  return (
    <Card className="gap-4 px-5 py-5 sm:px-6">
      <div>
        <h2 className="m-0 text-[15px] font-semibold text-foreground">Não encontrou o que procurava?</h2>
        <p className="m-0 mt-1 text-sm text-muted-foreground">O assistente responde na hora, e a equipe da Anuntech pelo chamado ou pelo chat.</p>
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
  const search = useCallback(
    (q: string) => router.replace(q.trim() ? `/ajuda?q=${encodeURIComponent(q)}` : "/ajuda", { scroll: false }),
    [router],
  );
  const results = useMemo(() => (query.trim() ? searchHelp(articles, query, { limit: 30 }) : []), [query]);
  const top = TOP_QUESTIONS.map((slug) => articles.find((a) => a.slug === slug)).filter((a): a is HelpArticle => !!a?.faq?.length);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SearchField
          value={query}
          onChange={search}
          placeholder="Busque por assunto: boleto, convite, prazo, contrato..."
          ariaLabel="Buscar na ajuda"
          className="max-w-2xl [&_input]:h-11 [&_input]:text-base"
        />
        <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
          {query.trim() ? (results.length ? `${results.length} ${results.length === 1 ? "artigo encontrado" : "artigos encontrados"}` : "Nenhum artigo encontrado") : `${articles.length} artigos sobre tudo o que dá para fazer no Console.`}
        </p>
      </div>

      {query.trim() ? (
        <>
          {results.length > 0 && (
            <Card className="py-2">
              <ul className="m-0 flex list-none flex-col p-1">
                {results.map(({ article }) => (
                  <ArticleRow key={article.slug} article={article} showCategory />
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
              <h2 id="videos" className="m-0 text-lg font-semibold tracking-[-0.01em] text-foreground">
                Tutoriais em vídeo
              </h2>
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {tutorials.map(({ tutorial, slug }) => (
                  <li key={tutorial.id}>
                    <Link
                      href={`/ajuda/${slug}#video`}
                      className="group flex h-full items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none">
                        <PlayIcon aria-hidden="true" className="ml-0.5 size-4 fill-current" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{tutorial.title}</span>
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
            <h2 id="assuntos" className="m-0 text-lg font-semibold tracking-[-0.01em] text-foreground">
              Assuntos
            </h2>
            {/* Columns, not a grid: each card keeps its own height. */}
            <div className="gap-4 md:columns-2 xl:columns-3">
              {HELP_CATEGORIES.map((category) => {
                const items = articles.filter((a) => a.category === category.id);
                if (!items.length) return null;
                return (
                  <Card key={category.id} id={category.id} className="mb-4 scroll-mt-6 break-inside-avoid gap-3 px-2 py-4">
                    <div className="flex items-start gap-3 px-3">
                      <CategoryTile id={category.id} />
                      <div className="min-w-0">
                        <h3 className="m-0 text-[15px] font-semibold text-foreground">{category.title}</h3>
                        <p className="m-0 text-xs leading-5 text-muted-foreground">{category.description}</p>
                      </div>
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
              <h2 id="perguntas" className="m-0 text-lg font-semibold tracking-[-0.01em] text-foreground">
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
