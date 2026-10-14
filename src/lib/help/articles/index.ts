import type { HelpArticle } from "../help-model";
import { comecarContaArticles } from "./comecar-conta";
import { chamadosArticles } from "./chamados";
import { projetosProdutosArticles } from "./projetos-produtos";
import { financeiroArticles } from "./financeiro";
import { orcamentosContratosArticles } from "./orcamentos-contratos";
import { condicoesPessoasArticles } from "./condicoes-pessoas";
import { bookmarksAssistenteArticles } from "./bookmarks-assistente";
import { segurancaArticles } from "./seguranca";

/** Every help article, in the order of HELP_CATEGORIES and then as each file lists them. */
export const HELP_ARTICLES: HelpArticle[] = [
  ...comecarContaArticles,
  ...chamadosArticles,
  ...projetosProdutosArticles,
  ...financeiroArticles,
  ...orcamentosContratosArticles,
  ...condicoesPessoasArticles,
  ...bookmarksAssistenteArticles,
  ...segurancaArticles,
];

export function helpArticle(slug: string) {
  return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
}
