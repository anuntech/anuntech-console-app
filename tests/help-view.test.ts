import assert from "node:assert/strict";
import test from "node:test";
import { HELP_ARTICLES } from "../src/lib/help/articles";
import { HELP_CATEGORIES } from "../src/lib/help/help-model";
import { TUTORIALS } from "../src/lib/help/tutorials";
import { TOP_QUESTIONS, helpArticleView, helpHome, helpSearchResults } from "../src/lib/help/help-view";

const membro = { staff: false, manager: false, support: true };
const administrador = { staff: false, manager: true, support: true };

test("the home lists every article once, in the help page's order", () => {
  const home = helpHome(membro);
  const slugs = home.categories.flatMap((c) => c.articles.map((a) => a.slug));
  assert.equal(slugs.length, HELP_ARTICLES.length);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.deepEqual(
    home.categories.map((c) => c.id),
    HELP_CATEGORIES.filter((c) => HELP_ARTICLES.some((a) => a.category === c.id)).map((c) => c.id),
  );
  assert.ok(home.canOpenTicket);
});

test("each tutorial opens the article that explains it, and the questions come from the top articles", () => {
  const home = helpHome(membro);
  assert.equal(home.tutorials.length, TUTORIALS.length);
  for (const t of home.tutorials) assert.equal(HELP_ARTICLES.find((a) => a.slug === t.slug)?.video, t.id);
  // No videos while new ones are recorded: no article points at one.
  assert.ok(HELP_ARTICLES.every((a) => !a.video));
  assert.ok(home.faq.length > 0 && home.faq.length <= TOP_QUESTIONS.length);
  for (const q of home.faq) assert.equal(HELP_ARTICLES.find((a) => a.slug === q.slug)?.faq?.[0].q, q.q);
});

test("only a Membro sees the Administrador mark and the notice", () => {
  const adminArticle = HELP_ARTICLES.find((a) => a.audience === "administrador")!;
  const marked = (viewer: typeof membro) =>
    helpHome(viewer).categories.flatMap((c) => c.articles).find((a) => a.slug === adminArticle.slug)!.adminOnly;
  assert.equal(marked(membro), true);
  assert.equal(marked(administrador), false);
  assert.equal(marked({ staff: true, manager: false, support: false }), false);
  assert.equal(helpArticleView(adminArticle.slug, membro)!.readsAsMember, true);
  assert.equal(helpArticleView(adminArticle.slug, administrador)!.readsAsMember, false);
  const everyone = HELP_ARTICLES.find((a) => a.audience === "todos")!;
  assert.equal(helpArticleView(everyone.slug, membro)!.readsAsMember, false);
});

test("an article carries its related articles and the rest of its subject without repeats", () => {
  const article = HELP_ARTICLES.find((a) => a.related?.length)!;
  const view = helpArticleView(article.slug, membro)!;
  assert.equal(view.tutorial, null);
  assert.ok(view.related.length > 0);
  assert.ok(!view.siblings.some((s) => s.slug === article.slug || view.related.some((r) => r.slug === s.slug)));
  assert.ok(view.siblings.every((s) => s.category === article.category));
  assert.equal(helpArticleView("nao-existe", membro), null);
});

test("the search answers with slug, title and summary only", () => {
  const results = helpSearchResults("boleto");
  assert.ok(results.length > 0);
  assert.deepEqual(Object.keys(results[0]).sort(), ["slug", "summary", "title"]);
  assert.deepEqual(helpSearchResults(""), []);
});
