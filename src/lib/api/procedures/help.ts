import "server-only";
import { allowedIds, type Actor } from "../../access/access";
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

/** Ajuda: the articles live in code (lib/help), served here so the app reads new text without a release. */
export const help = {
  home: api.help.home.use(guard({ self: true })).handler(({ context }) => helpHome(viewerOf(context.actor))),
  get: api.help.get.use(guard({ self: true })).handler(({ input, context }) => {
    const article = helpArticleView(input.slug, viewerOf(context.actor));
    if (!article) throw missing();
    return article;
  }),
  search: api.help.search.use(guard({ self: true })).handler(({ input }) => helpSearchResults(input.q)),
};
