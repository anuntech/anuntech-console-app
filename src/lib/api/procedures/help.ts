import "server-only";
import { HELP_ARTICLES } from "../../help/articles";
import { searchHelp } from "../../help/help-search";
import { api } from "../server";
import { guard } from "../access";

/** How each place searches: the Ajuda's box, and the ticket form's suggestions (components/help/help-suggestions.tsx). */
const modes = {
  search: { limit: 30, minScore: 0 },
  // A question ("Dúvida") gets more suggestions than a problem report.
  question: { limit: 3, minScore: 5 },
  ticket: { limit: 2, minScore: 7 },
} as const;

export const help = {
  search: api.help.search
    // The articles are the same for everyone (client-safe content in code).
    .use(guard({ self: true }))
    .handler(({ input }) => {
      // The form waits for a few letters before guessing.
      if (input.for !== "search" && (input.q.match(/\p{L}/gu)?.length ?? 0) < 4) return [];
      return searchHelp(HELP_ARTICLES, input.q, modes[input.for]).map(({ article }) => ({
        slug: article.slug,
        title: article.title,
        summary: article.summary,
      }));
    }),
};
