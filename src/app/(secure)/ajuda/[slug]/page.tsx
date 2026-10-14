import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allowedIds, getActor } from "@/lib/access/access";
import { HELP_ARTICLES, helpArticle } from "@/lib/help/articles";
import { categoryOf } from "@/lib/help/help-model";
import { tutorialOf } from "@/lib/help/tutorials";
import { HelpArticleView } from "@/components/help/help-article";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const article = helpArticle((await params).slug);
  return article ? { title: `${article.title} · Ajuda`, description: article.summary } : { title: "Ajuda" };
}

export default async function HelpArticlePage({ params }: Params) {
  const actor = await getActor();
  const article = helpArticle((await params).slug);
  if (!article) notFound();
  const related = (article.related ?? []).map((slug) => HELP_ARTICLES.find((a) => a.slug === slug)).filter((a) => !!a);
  // The rest of the same area, for "Neste assunto".
  const siblings = HELP_ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug);
  return (
    <HelpArticleView
      article={article}
      category={categoryOf(article.category)}
      tutorial={tutorialOf(article.video)}
      related={related}
      siblings={siblings}
      viewer={{
        staff: actor.admin,
        manager: allowedIds(actor, "finance").length > 0,
        support: allowedIds(actor, "support").length > 0,
      }}
    />
  );
}
