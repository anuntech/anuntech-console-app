import { HELP_ARTICLES } from "./articles";
import { HELP_CATEGORIES, categoryOf, type HelpArticle } from "./help-model";
import { searchHelp } from "./help-search";
import { TUTORIALS, tutorialOf } from "./tutorials";

/*
 * The help center as data, for the app's API (help.home, help.get,
 * help.search): the same articles, order and marks as the web's /ajuda.
 * Client-safe, like the rest of lib/help.
 */

export type HelpViewer = { staff: boolean; manager: boolean; support: boolean };

/** The questions people ask most, picked by article (the first question of each). */
export const TOP_QUESTIONS = [
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

/** Only a Membro needs to know an article is the Administrador's; whoever administers already is. */
export const readsAsMember = (viewer: HelpViewer) => !viewer.staff && !viewer.manager;

export function helpStub(article: HelpArticle, viewer: HelpViewer) {
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: article.category,
    adminOnly: article.audience === "administrador" && readsAsMember(viewer),
    video: !!article.video,
  };
}

/** /ajuda: the tutorials (each with the article that explains it), the subjects with their articles and the common questions. */
export function helpHome(viewer: HelpViewer, articles = HELP_ARTICLES) {
  const tutorials = TUTORIALS.flatMap((tutorial) => {
    const article = articles.find((a) => a.video === tutorial.id);
    return article
      ? [{ id: tutorial.id, title: tutorial.title, description: tutorial.description, duration: tutorial.duration, slug: article.slug }]
      : [];
  });
  const categories = HELP_CATEGORIES.map((category) => ({
    id: category.id,
    title: category.title,
    description: category.description,
    articles: articles.filter((a) => a.category === category.id).map((a) => helpStub(a, viewer)),
  })).filter((c) => c.articles.length);
  const faq = TOP_QUESTIONS.map((slug) => articles.find((a) => a.slug === slug))
    .filter((a): a is HelpArticle => !!a?.faq?.length)
    .map((a) => ({ q: a.faq![0].q, a: a.faq![0].a, slug: a.slug }));
  return { tutorials, categories, faq, canOpenTicket: viewer.support || viewer.staff };
}

/** /ajuda/<slug>: the article, its video, related articles and the rest of its subject. Null when there is no such article. */
export function helpArticleView(slug: string, viewer: HelpViewer, articles = HELP_ARTICLES) {
  const article = articles.find((a) => a.slug === slug);
  if (!article) return null;
  const related = (article.related ?? []).map((s) => articles.find((a) => a.slug === s)).filter((a): a is HelpArticle => !!a);
  const siblings = articles.filter((a) => a.category === article.category && a.slug !== article.slug && !related.some((r) => r.slug === a.slug));
  const tutorial = tutorialOf(article.video);
  const category = categoryOf(article.category);
  const adminOnly = article.audience === "administrador";
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: { id: category.id, title: category.title },
    adminOnly,
    // A Membro still reads it, to know the process and whom to ask.
    readsAsMember: adminOnly && readsAsMember(viewer),
    sections: article.sections,
    faq: article.faq ?? [],
    actions: article.actions ?? [],
    updatedAt: article.updatedAt,
    tutorial: tutorial
      ? {
          id: tutorial.id,
          title: tutorial.title,
          description: tutorial.description,
          src: tutorial.src,
          duration: tutorial.duration,
          chapters: tutorial.chapters,
          transcript: tutorial.transcript.map(([at, text]) => ({ at, text })),
        }
      : null,
    related: related.map((a) => helpStub(a, viewer)),
    siblings: siblings.map((a) => helpStub(a, viewer)),
    canOpenTicket: viewer.support || viewer.staff,
  };
}

/** The help page's search, as the list the app shows: best first. */
export function helpSearchResults(query: string, articles = HELP_ARTICLES) {
  return searchHelp(articles, query.slice(0, 160), { limit: 30 }).map(({ article }) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
  }));
}
