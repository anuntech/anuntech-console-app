import "server-only";
import { allowedIds, type Actor } from "../../access/access";
import { HELP_ARTICLES } from "../../help/articles";
import { searchHelp } from "../../help/help-search";
import { helpArticleView, helpHome, helpSearchResults, type HelpViewer } from "../../help/help-view";
import { api } from "../server";
import { guard, missing } from "../access";

/** Who reads, as the web's /ajuda pages tell it (lib/help is the same for everyone; only the marks change). */
function viewerOf(actor: Actor): HelpViewer {
  return {
    staff: actor.admin,
    manager: allowedIds(actor, "finance").length > 0,
    support: allowedIds(actor, "support").length > 0,
  };
}

/** The ticket form's suggestions ("Talvez isto responda", components/help/help-suggestions.tsx); the Ajuda's box uses helpSearchResults. */
const suggestions = {
  // A question ("Dúvida") gets more suggestions than a problem report.
  question: { limit: 3, minScore: 5 },
  ticket: { limit: 2, minScore: 7 },
} as const;

/** Ajuda: the articles live in code (lib/help), served here so the app reads new text without a release. */
export const help = {
  home: api.help.home.use(guard({ self: true })).handler(({ context }) => helpHome(viewerOf(context.actor))),
  get: api.help.get.use(guard({ self: true })).handler(({ input, context }) => {
    const article = helpArticleView(input.slug, viewerOf(context.actor));
    if (!article) throw missing();
    return article;
  }),
  search: api.help.search.use(guard({ self: true })).handler(({ input }) => {
    if (input.for === "search") return helpSearchResults(input.q);
    // The form waits for a few letters before guessing.
    if ((input.q.match(/\p{L}/gu)?.length ?? 0) < 4) return [];
    return searchHelp(HELP_ARTICLES, input.q, suggestions[input.for]).map(({ article }) => ({
      slug: article.slug,
      title: article.title,
      summary: article.summary,
    }));
  }),
};
