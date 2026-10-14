/*
 * The client help center ("Ajuda"): every article lives in code, reviewed like
 * the rest of the Console, so the page, the ticket form and the assistant read
 * the same text. Client-safe: no database, no server-only imports.
 *
 * Writing rules (docs/design.md, Escrita): plain Portuguese, no travessão to join
 * sentences, no exclamation, "o Console", "recorrência" for a periodic charge.
 * Deadlines never live here: they come from each company's conditions and show
 * in Como trabalhamos. Text may link with [rótulo](/caminho) to Console pages
 * and other articles (/ajuda/<slug>).
 */

export type HelpCategoryId =
  | "comecar"
  | "conta"
  | "chamados"
  | "projetos"
  | "produtos"
  | "financeiro"
  | "orcamentos"
  | "contratos"
  | "condicoes"
  | "pessoas"
  | "bookmarks"
  | "assistente"
  | "seguranca";

/** Who can do what the article explains; everyone can read every article. */
export type HelpAudience = "todos" | "administrador";

export type HelpBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "pairs"; items: { term: string; text: string }[] }
  | { kind: "note"; tone: "info" | "attention"; text: string };

export type HelpSection = { title: string; blocks: HelpBlock[] };

export type HelpFaq = { q: string; a: string };

/** A tutorial video (lib/help/tutorials.ts). */
export type TutorialId = "chamado" | "fatura" | "orcamento" | "projeto" | "acessos" | "assinatura" | "assistente";

export type HelpArticle = {
  /** Stable: links in e-mails, the assistant and the ticket form point at /ajuda/<slug>. */
  slug: string;
  category: HelpCategoryId;
  title: string;
  /** One sentence, shown under the title and in search results. */
  summary: string;
  audience: HelpAudience;
  /** Words a client would type, synonyms included, for search and ticket suggestions. */
  keywords: string[];
  video?: TutorialId;
  sections: HelpSection[];
  faq?: HelpFaq[];
  /** Where to do it in the Console ("Ir para Financeiro"). */
  actions?: { label: string; href: string }[];
  related?: string[];
  /** YYYY-MM-DD, shown as "Atualizado em". */
  updatedAt: string;
};

export type HelpCategory = { id: HelpCategoryId; title: string; description: string };

/** In the order of the help page. */
export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "comecar", title: "Começar", description: "Primeiro acesso, entrar e conhecer o Console." },
  { id: "conta", title: "Sua conta", description: "Perfil, WhatsApp, e-mails, aparência e sessões." },
  { id: "chamados", title: "Chamados", description: "Pedir ajuda à equipe e acompanhar cada resposta." },
  { id: "projetos", title: "Projetos", description: "O quadro de tarefas, os pedidos e as entregas." },
  { id: "produtos", title: "Produtos e serviços", description: "O que a sua empresa tem com a Anuntech e como abrir." },
  { id: "financeiro", title: "Financeiro", description: "Faturas, Pix, boleto, recorrências e nota fiscal." },
  { id: "orcamentos", title: "Orçamentos", description: "Ler, aceitar, recusar e pedir uma proposta." },
  { id: "contratos", title: "Contratos", description: "Ler, pedir alteração e assinar pelo Console." },
  { id: "condicoes", title: "Prazos e banco de horas", description: "Como contamos o tempo e o que o seu contrato prevê." },
  { id: "pessoas", title: "Pessoas e avisos", description: "Quem entra no Console, o que cada um vê e quem recebe os avisos." },
  { id: "bookmarks", title: "Bookmarks", description: "Links, arquivos e lousas da empresa." },
  { id: "assistente", title: "Assistente", description: "O que o assistente faz e como falar em vez de escrever." },
  { id: "seguranca", title: "Segurança e privacidade", description: "Seus dados, os avisos que o Console envia e boas práticas." },
];

export function categoryOf(id: HelpCategoryId) {
  return HELP_CATEGORIES.find((c) => c.id === id)!;
}

/** "[rótulo](/caminho)" inside a text, split for rendering; only Console paths become links. */
export function splitLinks(text: string): ({ text: string } | { label: string; href: string })[] {
  const parts: ({ text: string } | { label: string; href: string })[] = [];
  const pattern = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ label: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** The same text without link markup, for search and for the assistant. */
export function plainText(text: string) {
  return text.replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, "$1");
}
