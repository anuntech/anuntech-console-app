"use client";
import Link from "next/link";
import { ChevronRightIcon, PlayIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/console/page-header";
import { dateLabel } from "@/lib/format";
import type { HelpArticle, HelpCategory } from "@/lib/help/help-model";
import type { Tutorial } from "@/lib/help/tutorials";
import { HelpFaqList, HelpSections, sectionAnchor } from "./help-content";
import { AdminOnly, NotFoundHelp, type HelpViewer } from "./help-hub";
import { CategoryTile } from "./help-icons";
import { TocList } from "./toc";
import { TutorialPlayer } from "./tutorial-player";

function SideLinks({ title, articles }: { title: string; articles: HelpArticle[] }) {
  if (!articles.length) return null;
  return (
    <nav aria-label={title} className="flex flex-col gap-1">
      <p className="m-0 px-2.5 text-caption font-medium text-muted-foreground">{title}</p>
      <ul className="m-0 flex list-none flex-col p-0">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/ajuda/${a.slug}`}
              className="flex min-h-9 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary hover:text-primary"
            >
              <span className="min-w-0 flex-1">{a.title}</span>
              {a.video && <PlayIcon aria-label="Com vídeo" className="size-3 shrink-0 fill-current text-primary" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * One help article: what it is, who does it, the steps, the rules and the
 * common questions, with the video when there is one and the way to the
 * screen where it happens.
 */
export function HelpArticleView({
  article,
  category,
  tutorial,
  related,
  siblings,
  viewer,
}: {
  article: HelpArticle;
  category: HelpCategory;
  tutorial: Tutorial | null;
  related: HelpArticle[];
  siblings: HelpArticle[];
  viewer: HelpViewer;
}) {
  const adminOnly = article.audience === "administrador";
  // A Membro still reads it, to know the process and whom to ask.
  const readsAsMember = adminOnly && !viewer.staff && !viewer.manager;
  const contents = [
    ...(tutorial ? [{ id: "video", title: "Vídeo" }] : []),
    ...article.sections.map((s) => ({ id: sectionAnchor(s.title), title: s.title })),
    ...(article.faq?.length ? [{ id: "perguntas-frequentes", title: "Perguntas frequentes" }] : []),
  ];
  return (
    <>
      <PageHeader
        className="mb-6"
        crumbs={[{ label: "Ajuda", href: "/ajuda" }, { label: category.title, href: `/ajuda#${category.id}` }, { label: article.title }]}
        leading={<CategoryTile id={category.id} className="size-11 rounded-xl [&_svg]:size-5" />}
        title={article.title}
        description={
          <span className="flex flex-col gap-2">
            <span>{article.summary}</span>
            {adminOnly && (
              <span className="flex items-center gap-2 text-xs">
                <AdminOnly />
                <span>Só o Administrador da empresa faz isto no Console.</span>
              </span>
            )}
          </span>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <article className="flex min-w-0 flex-col gap-9">
          {readsAsMember && (
            <p className="m-0 flex items-start gap-2.5 rounded-lg bg-accent/60 px-4 py-3 text-sm leading-6 text-foreground">
              <UsersIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
              Quem faz isto é um Administrador da sua empresa. Você pode ler para entender o processo e, se precisar, pedir a ele ou abrir um chamado.
            </p>
          )}
          {tutorial && <TutorialPlayer tutorial={tutorial} />}
          <HelpSections sections={article.sections} />
          {article.faq && <HelpFaqList faq={article.faq} />}
          <p className="m-0 text-xs text-muted-foreground">Atualizado em {dateLabel(article.updatedAt)}</p>
          <NotFoundHelp viewer={viewer} />
        </article>
        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
          {article.actions && article.actions.length > 0 && (
            <Card className="gap-2 px-3 py-3">
              {article.actions.map((action) => (
                <Button key={action.href} variant="outline" className="justify-between" asChild>
                  <Link href={action.href}>
                    {action.label}
                    <ChevronRightIcon className="text-muted-foreground" />
                  </Link>
                </Button>
              ))}
            </Card>
          )}
          {contents.length > 2 && (
            <TocList items={contents} label="Neste artigo" heading="Neste artigo" className="hidden px-2.5 lg:flex" />
          )}
          <SideLinks title="Relacionados" articles={related} />
          <SideLinks title={`Mais em ${category.title}`} articles={siblings.filter((s) => !related.some((r) => r.slug === s.slug))} />
          <Link href="/ajuda" className="flex items-center gap-1 px-2.5 text-sm font-medium text-primary hover:underline">
            Todos os assuntos
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </Link>
        </aside>
      </div>
    </>
  );
}
