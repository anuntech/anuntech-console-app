import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { HELP_ARTICLES } from "../src/lib/help/articles";
import { HELP_CATEGORIES, splitLinks, type HelpArticle } from "../src/lib/help/help-model";
import { fold, searchHelp } from "../src/lib/help/help-search";
import { TUTORIALS } from "../src/lib/help/tutorials";

/** Every page route of the app, as patterns ("/ajuda/[slug]" matches any one segment). */
function pageRoutes(dir = join(__dirname, "../src/app"), prefix = ""): string[] {
  const routes: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) {
      if (name === "page.tsx" || name === "route.ts") routes.push(prefix || "/");
      continue;
    }
    // Route groups and parallel or intercepted routes do not add to the URL.
    if (name.startsWith("@") || name.startsWith("(.") ) continue;
    routes.push(...pageRoutes(path, name.startsWith("(") ? prefix : `${prefix}/${name}`));
  }
  return routes;
}
const ROUTES = pageRoutes();
function routeExists(href: string) {
  const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const parts = path.split("/");
  return ROUTES.some((route) => {
    const r = route.split("/");
    return r.length === parts.length && r.every((seg, i) => (seg.startsWith("[") ? !!parts[i] : seg === parts[i]));
  });
}

function texts(article: HelpArticle) {
  return [
    article.title,
    article.summary,
    ...article.sections.flatMap((s) => [
      s.title,
      ...s.blocks.flatMap((b) => (b.kind === "p" || b.kind === "note" ? [b.text] : b.kind === "pairs" ? b.items.flatMap((i) => [i.term, i.text]) : b.items)),
    ]),
    ...(article.faq ?? []).flatMap((f) => [f.q, f.a]),
  ];
}

test("every article has a unique slug, a known category and the parts a reader needs", () => {
  assert.ok(HELP_ARTICLES.length >= 40, `${HELP_ARTICLES.length} artigos`);
  const slugs = HELP_ARTICLES.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const a of HELP_ARTICLES) {
    assert.match(a.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, a.slug);
    assert.ok(HELP_CATEGORIES.some((c) => c.id === a.category), a.slug);
    assert.ok(a.sections.length > 0 && a.sections.every((s) => s.blocks.length > 0), a.slug);
    assert.ok(a.keywords.length >= 4, `${a.slug}: palavras-chave`);
    assert.match(a.updatedAt, /^\d{4}-\d{2}-\d{2}$/, a.slug);
    for (const r of a.related ?? []) assert.ok(slugs.includes(r), `${a.slug} → ${r}`);
  }
  // Every area has something to read.
  for (const c of HELP_CATEGORIES) assert.ok(HELP_ARTICLES.some((a) => a.category === c.id), c.id);
});

test("links go to pages that exist, inside the Console", () => {
  const slugs = new Set(HELP_ARTICLES.map((a) => a.slug));
  for (const a of HELP_ARTICLES) {
    const hrefs = [
      ...texts(a).flatMap((t) => splitLinks(t).flatMap((p) => ("href" in p ? [p.href] : []))),
      ...(a.actions ?? []).map((x) => x.href),
    ];
    for (const href of hrefs) {
      assert.ok(href.startsWith("/") && !href.startsWith("//"), `${a.slug}: ${href}`);
      const help = /^\/ajuda\/([^/?#]+)/.exec(href);
      if (help) assert.ok(slugs.has(help[1]), `${a.slug}: artigo ${help[1]} não existe`);
      else assert.ok(routeExists(href), `${a.slug}: ${href} não é uma página do Console`);
    }
    // No unclosed markup reaches the reader.
    for (const t of texts(a)) assert.doesNotMatch(t.replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, "$1"), /\]\(/, `${a.slug}: ${t}`);
  }
});

test("the voice holds: no travessão joining sentences, no exclamation, no 'Ops'", () => {
  for (const a of HELP_ARTICLES)
    for (const t of texts(a)) {
      assert.doesNotMatch(t, /[—–]/, `${a.slug}: ${t}`);
      assert.doesNotMatch(t, /!/, `${a.slug}: ${t}`);
      assert.doesNotMatch(t, /\bops\b/i, `${a.slug}: ${t}`);
    }
});

test("each video belongs to one article, and each article's video exists", () => {
  for (const t of TUTORIALS) {
    assert.match(t.src, /^\/ajuda\/videos\/[a-z]+-[0-9a-f]{10}\.mp4$/, t.id);
    assert.ok(t.chapters.length > 0 && t.duration > 0, t.id);
    assert.equal(HELP_ARTICLES.filter((a) => a.video === t.id).length, 1, `${t.id}: um artigo`);
    const file = join(__dirname, "../public", t.src);
    assert.ok(statSync(file).size > 100_000, file);
  }
  for (const a of HELP_ARTICLES) if (a.video) assert.ok(TUTORIALS.some((t) => t.id === a.video), a.slug);
});

test("search finds the article people mean, with or without accents", () => {
  const top = (query: string, n = 3) => searchHelp(HELP_ARTICLES, query, { limit: n }).map((r) => r.article.slug);
  assert.ok(top("boleto").includes("pagar-uma-fatura"), String(top("boleto")));
  assert.ok(top("pagar com pix").includes("pagar-uma-fatura"));
  assert.ok(top("não recebi o código").includes("entrar"), String(top("não recebi o código")));
  assert.ok(top("nao recebi o codigo").includes("entrar"));
  assert.ok(top("convidar pessoa").includes("convidar-pessoas"), String(top("convidar pessoa")));
  assert.ok(top("assinar contrato").includes("assinar-um-contrato"));
  assert.ok(top("diferença entre membro e administrador").includes("membro-ou-administrador"), String(top("diferença entre membro e administrador")));
  assert.ok(top("prazo de resposta do chamado", 4).includes("prazos-de-atendimento"), String(top("prazo de resposta do chamado", 4)));
  assert.ok(top("nota fiscal").includes("nota-fiscal"));
  assert.ok(top("abrir chamado").includes("abrir-um-chamado"));
  assert.deepEqual(top("xyzzy plugh"), []);
  assert.equal(fold("Cobrança Ação"), "cobranca acao");
});
