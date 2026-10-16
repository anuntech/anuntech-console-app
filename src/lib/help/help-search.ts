import { plainText, type HelpArticle, type HelpBlock } from "./help-model";

/*
 * One search for the help page, the ticket form and the assistant. Small
 * corpus (dozens of articles), so it runs anywhere, without a library:
 * accents and case do not matter ("cobranca" finds "cobrança"), a word
 * matches as a prefix ("assin" finds "assinar"), simple plurals fold, and a
 * few Console synonyms join ("boleto" also looks for fatura and pagar).
 */

const STOPWORDS = new Set(
  "a o e de da do das dos em no na nos nas um uma uns umas para pra por com sem que como eu meu minha meus minhas se ao aos as os ou mais muito ja nao sim ser ter tem esta este essa esse isso isto qual quais onde quando porque pelo pela ele ela eles elas voce voces sua seu suas seus lhe me te entre sobre fazer faco consigo posso pode preciso quero".split(" "),
);

/** Each group's words find each other. Keep them short: they widen every search. */
const SYNONYMS: string[][] = [
  ["boleto", "fatura", "cobranca", "pagar", "pagamento", "pix"],
  ["chamado", "suporte", "ticket", "pedido", "ajuda", "atendimento"],
  ["entrar", "login", "acesso", "codigo", "senha", "logar"],
  ["membro", "usuario", "pessoa", "convite", "convidar", "colaborador", "funcionario"],
  ["contrato", "assinar", "assinatura"],
  ["orcamento", "proposta", "cotacao"],
  ["projeto", "tarefa", "quadro", "entrega"],
  ["aviso", "notificacao", "email", "whatsapp", "mensagem"],
  ["prazo", "tempo", "demora", "resposta"],
  ["trocar", "mudar", "alterar", "editar", "atualizar"],
  ["nota", "nfse"],
];

/** Conjugations clients type, folded to the verb the articles use ("paguei" → "pagar"). */
const VERBS: Record<string, string[]> = {
  pagar: ["pago", "paguei", "pague", "pagando", "pagou", "pagamos"],
  assinar: ["assino", "assinei", "assine", "assinando", "assinou"],
  receber: ["recebi", "recebo", "recebeu", "recebendo", "recebemos"],
  entrar: ["entro", "entrei", "entre", "entrando", "entrou", "consigo entrar"],
  trocar: ["troco", "troquei", "troque", "trocando"],
  convidar: ["convido", "convidei", "convide", "convidando"],
  abrir: ["abro", "abri", "abra", "abriu", "abrindo"],
  cancelar: ["cancelo", "cancelei", "cancele", "cancelou"],
  mudar: ["mudo", "mudei", "mude", "mudou"],
  baixar: ["baixo", "baixei", "baixe", "baixou"],
  aprovar: ["aprovo", "aprovei", "aprove", "aprovou"],
  enviar: ["envio", "enviei", "envie", "enviou"],
  chegar: ["chegou", "chega", "chegaram"],
};
const VERB_OF = new Map(Object.entries(VERBS).flatMap(([verb, forms]) => forms.map((form) => [form, verb] as const)));

export function fold(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

/** A word reduced to a stem that singular and plural share. */
function stem(word: string) {
  if (word.length > 4 && word.endsWith("oes")) return `${word.slice(0, -3)}ao`;
  if (word.length > 4 && word.endsWith("aes")) return `${word.slice(0, -3)}ao`;
  if (word.length > 4 && word.endsWith("ais")) return `${word.slice(0, -3)}al`;
  if (word.length > 4 && word.endsWith("eis")) return `${word.slice(0, -3)}el`;
  if (word.length > 4 && word.endsWith("res")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function terms(text: string) {
  return fold(text)
    .replace(/\be-mails?\b/g, "email")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map((word) => VERB_OF.get(word) ?? word)
    .map(stem);
}

function blockText(block: HelpBlock): string {
  if (block.kind === "p" || block.kind === "note") return block.text;
  if (block.kind === "pairs") return block.items.map((i) => `${i.term} ${i.text}`).join(" ");
  return block.items.join(" ");
}

type Field = { weight: number; words: string[] };
type Indexed = { article: HelpArticle; title: string[]; fields: Field[] };

const indexes = new WeakMap<HelpArticle[], Indexed[]>();

function indexOf(articles: HelpArticle[]) {
  let found = indexes.get(articles);
  if (!found) {
    found = articles.map((article) => ({
      article,
      title: [...new Set(terms(article.title))],
      fields: [
        { weight: 6, words: terms(article.title) },
        { weight: 4, words: terms(article.keywords.join(" ")) },
        { weight: 3, words: terms(article.summary) },
        { weight: 3, words: terms((article.faq ?? []).map((f) => f.q).join(" ")) },
        { weight: 2, words: terms(article.sections.map((s) => s.title).join(" ")) },
        {
          weight: 1,
          words: terms(
            plainText(
              [...article.sections.flatMap((s) => s.blocks.map(blockText)), ...(article.faq ?? []).map((f) => f.a)].join(" "),
            ),
          ),
        },
      ],
    }));
    indexes.set(articles, found);
  }
  return found;
}

/** The words a query word stands for: itself and its synonyms. */
function expand(word: string) {
  const group = SYNONYMS.find((g) => g.some((s) => terms(s).includes(word)));
  return group ? [...new Set([word, ...group.flatMap(terms)])] : [word];
}

function score(entry: Indexed, alternatives: string[][]) {
  let total = 0;
  let matched = 0;
  for (const options of alternatives) {
    let best = 0;
    for (const field of entry.fields)
      for (const word of field.words)
        for (const [i, option] of options.entries()) {
          // The typed word counts in full; a synonym counts less.
          const exact = word === option ? 1 : word.startsWith(option) && option.length >= 3 ? 0.7 : 0;
          best = Math.max(best, exact * field.weight * (i === 0 ? 1 : 0.5));
        }
    if (best > 0) matched++;
    total += best;
  }
  // Most of the words must be there; covering all of them weighs more than repeating one.
  const needed = Math.max(1, Math.ceil(alternatives.length * 0.6));
  if (matched < needed) return 0;
  // A query that names the article ("membro administrador") finds it first.
  const typed = alternatives.map((options) => options[0]);
  const named = entry.title.filter((word) => typed.some((t) => word === t || (t.length >= 3 && word.startsWith(t)))).length / entry.title.length;
  return total * (matched / alternatives.length) ** 2 + (named >= 0.5 ? 8 * named ** 2 : 0);
}

export type HelpResult = { article: HelpArticle; score: number };

/**
 * Articles for a query, best first. Most of the words must match (a synonym
 * will do) and an article covering all of them ranks higher. `minScore` keeps
 * weak guesses out of the ticket form.
 */
export function searchHelp(articles: HelpArticle[], query: string, { limit = 20, minScore = 0 } = {}): HelpResult[] {
  const words = [...new Set(terms(query))].slice(0, 12);
  if (!words.length) return [];
  const alternatives = words.map(expand);
  return indexOf(articles)
    .map((entry) => ({ article: entry.article, score: score(entry, alternatives) }))
    .filter((r) => r.score > minScore)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title, "pt-BR"))
    .slice(0, limit);
}
