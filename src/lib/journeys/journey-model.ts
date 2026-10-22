import { z } from "zod";
import { dateLabel } from "../format";

/*
 * "Jornada do projeto": the path the Anuntech team walks with one client
 * project, from the first contact to the hosting, as stages and steps. The
 * template lives here, in code; each journey stores only what the Console
 * cannot see (meetings, the briefing, GitHub, Vercel, Neon, the domain…).
 * What the Console already knows (the company, the proposal, the contract,
 * the charges, the board, the hosting) ticks itself from the data.
 *
 * Pure: no database, no server-only imports. The page, the actions, the AI
 * helpers and the tests all read the same rules.
 */

/* ---------- stages and steps ---------- */

export const JOURNEY_TEMPLATE_VERSION = "projeto-v1";

export const JOURNEY_STAGES = [
  { key: "descoberta", title: "Contato e descoberta", description: "Quem é o cliente, o que ele precisa e o que foi dito na primeira reunião." },
  { key: "proposta", title: "Proposta", description: "Fases, tarefas e valores no orçamento, até o aceite do Administrador." },
  { key: "contratacao", title: "Contratação e início", description: "Contrato, entrada, projeto no quadro e a reunião de início." },
  { key: "setup", title: "Setup técnico", description: "Em paralelo, sem ordem fixa: repositório, ambientes, banco, visual e domínio." },
  { key: "validacao", title: "Construção e validação", description: "O quadro andando, a apresentação e o que o cliente pediu para ajustar." },
  { key: "entrega", title: "Entrega e pós-entrega", description: "A entrega, o aceite, o saldo, a hospedagem e o suporte." },
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number]["key"];
export const journeyStageKeys = JOURNEY_STAGES.map((stage) => stage.key) as [JourneyStage, ...JourneyStage[]];
export const stageTitle = (stage: string) => JOURNEY_STAGES.find((s) => s.key === stage)?.title ?? "Outros";

/** Meetings with a prepared agenda. */
export const MEETINGS = ["briefing", "inicio", "apresentacao", "entrega"] as const;
export type JourneyMeeting = (typeof MEETINGS)[number];
export const meetingTitles: Record<JourneyMeeting, string> = {
  briefing: "Reunião de briefing",
  inicio: "Reunião de início",
  apresentacao: "Reunião de apresentação",
  entrega: "Reunião de entrega",
};

/** What the AI does for a step; every step without one still gets "passo" (how to do it, for this project). */
export type JourneyAi =
  | { kind: "briefing" }
  | { kind: "prompt" }
  | { kind: "design" }
  | { kind: "pauta"; meeting: JourneyMeeting }
  | { kind: "retorno" }
  | { kind: "passo" };

export type StepField = "url" | "value" | "date" | "note";

export type JourneyStepDef = {
  key: string;
  stage: JourneyStage;
  title: string;
  /** One or two sentences: what "done" means and where it happens. */
  help: string;
  /** Counts toward progress; optional ones sit under "Também vale conferir" until touched. */
  required: boolean;
  /**
   * auto: the Console's data decides (only "Não se aplica" by hand);
   * manual: the team marks it; hybrid: the data ticks it when it can, by hand otherwise.
   */
  source: "auto" | "manual" | "hybrid";
  /** Steps that come first; until they are done (or skipped) this one waits. */
  after?: string[];
  fields?: StepField[];
  /** Label and example for the value field (a domain, a name). */
  valueLabel?: string;
  /** What a good link looks like, shown under the field. */
  urlHint?: string;
  ai?: JourneyAi;
};

const step = (def: JourneyStepDef) => def;

export const JOURNEY_TEMPLATE: JourneyStepDef[] = [
  /* Contato e descoberta */
  step({
    key: "cadastro",
    stage: "descoberta",
    title: "Cadastro do cliente",
    help: "Cadastre a empresa ou vincule uma que já existe. Até lá, a jornada guarda só o nome e o contato.",
    required: true,
    source: "auto",
  }),
  step({
    key: "briefing",
    stage: "descoberta",
    title: "Briefing da reunião",
    help: "Objetivo, público, funcionalidades e o que ficou em aberto. Cole as notas ou dite: a IA organiza, você confere e salva.",
    required: true,
    source: "auto",
    ai: { kind: "briefing" },
  }),
  step({
    key: "cadastro-cobranca",
    stage: "descoberta",
    title: "Cadastro pronto para cobrar",
    help: "Documento e endereço de cobrança completos, para o Inter aceitar a entrada.",
    required: true,
    source: "auto",
    after: ["cadastro"],
  }),
  step({
    key: "administrador",
    stage: "descoberta",
    title: "Administrador do cliente",
    help: "Só o Administrador aceita o orçamento, assina o contrato e vê as faturas. O envio do orçamento já convida.",
    required: true,
    source: "auto",
    after: ["cadastro"],
  }),
  step({
    key: "pedido",
    stage: "descoberta",
    title: "Pedido registrado no Console",
    help: "O chamado \"App ou projeto novo\" que deu origem ao trabalho. O cliente vê esse chamado: nada interno nele.",
    required: false,
    source: "auto",
    after: ["cadastro"],
  }),
  step({
    key: "nda",
    stage: "descoberta",
    title: "Acordo de confidencialidade",
    help: "Quando o cliente pede sigilo antes de contar o projeto. O modelo ainda espera a revisão do advogado.",
    required: false,
    source: "manual",
    after: ["cadastro"],
    fields: ["note"],
  }),

  /* Proposta */
  step({
    key: "tarefas",
    stage: "proposta",
    title: "Desenhar fases e tarefas",
    help: "As fases e as tarefas ficam no orçamento. Crie o orçamento a partir do briefing e use \"Sugerir fases\" no editor.",
    required: true,
    source: "auto",
    after: ["cadastro"],
  }),
  step({
    key: "orcamento",
    stage: "proposta",
    title: "Orçamento completo",
    help: "Valor da hora, desconto, entrada e validade preenchidos: é o que o envio exige.",
    required: true,
    source: "auto",
    after: ["tarefas"],
  }),
  step({
    key: "orcamento-enviado",
    stage: "proposta",
    title: "Orçamento enviado",
    help: "O envio congela a versão, avisa o Administrador e convida quem ainda não tem acesso.",
    required: true,
    source: "auto",
    after: ["orcamento"],
  }),
  step({
    key: "orcamento-aceito",
    stage: "proposta",
    title: "Aceite do orçamento",
    help: "O Administrador aceita no Console. Se o aceite veio por outro canal, registre a resposta pelo cliente no orçamento.",
    required: true,
    source: "auto",
    after: ["orcamento-enviado"],
  }),

  /* Contratação e início */
  step({
    key: "contrato",
    stage: "contratacao",
    title: "Contrato enviado",
    help: "O contrato sai preenchido a partir do orçamento aceito. Revise os campos e envie para assinatura.",
    required: true,
    source: "auto",
    after: ["orcamento-aceito"],
  }),
  step({
    key: "contrato-assinado",
    stage: "contratacao",
    title: "Contrato assinado",
    help: "As duas partes assinam no Console. Quando o cliente assina, falta só a assinatura da Anuntech.",
    required: true,
    source: "auto",
    after: ["contrato"],
  }),
  step({
    key: "entrada",
    stage: "contratacao",
    title: "Entrada paga",
    help: "A cobrança da entrada sai preenchida com o valor do orçamento. Conta como paga só quando o Inter confirma.",
    required: true,
    source: "auto",
    after: ["orcamento-aceito"],
  }),
  step({
    key: "projeto",
    stage: "contratacao",
    title: "Projeto no quadro",
    help: "Cria o projeto com as fases e tarefas do orçamento. O cliente vê o projeto e o quadro assim que ele é criado.",
    required: true,
    source: "auto",
    after: ["orcamento-aceito"],
  }),
  step({
    key: "acessos",
    stage: "contratacao",
    title: "Acessos do cliente",
    help: "Logins, servidores, domínio e contas que o projeto precisa. O cartão \"Acessos\" do quadro conta; se não houver, marque à mão.",
    required: true,
    source: "hybrid",
    after: ["projeto"],
    fields: ["note"],
  }),
  step({
    key: "kickoff",
    stage: "contratacao",
    title: "Reunião de início",
    help: "Com contrato assinado, entrada paga e acessos recebidos: cronograma, responsáveis e o primeiro entregável.",
    required: true,
    source: "hybrid",
    after: ["projeto"],
    fields: ["date", "note"],
    ai: { kind: "pauta", meeting: "inicio" },
  }),
  step({
    key: "condicoes",
    stage: "contratacao",
    title: "Condições de atendimento",
    help: "Prazos de resposta, testes e garantia do contrato, conferidos no cadastro da empresa.",
    required: false,
    source: "auto",
    after: ["contrato-assinado"],
  }),

  /* Setup técnico */
  step({
    key: "prompt-projeto",
    stage: "setup",
    title: "Prompt de início do projeto",
    help: "Estrutura, pastas, stack e o AGENTS.md, para o agente de código criar o projeto no padrão da Anuntech.",
    required: true,
    source: "manual",
    after: ["briefing"],
    fields: ["note"],
    ai: { kind: "prompt" },
  }),
  step({
    key: "repositorio",
    stage: "setup",
    title: "Repositório no GitHub",
    help: "Privado, na organização anuntech, com o nome do projeto.",
    required: true,
    source: "manual",
    after: ["orcamento-aceito"],
    fields: ["url", "note"],
    urlHint: "https://github.com/anuntech/nome-do-projeto",
  }),
  step({
    key: "vercel",
    stage: "setup",
    title: "Projeto na Vercel",
    help: "No time da Anuntech, ligado ao repositório, com preview e produção.",
    required: true,
    source: "manual",
    after: ["orcamento-aceito"],
    fields: ["url", "note"],
    urlHint: "https://vercel.com/anuntech/nome-do-projeto",
  }),
  step({
    key: "neon",
    stage: "setup",
    title: "Banco na Neon",
    help: "Um projeto por cliente, com branch de preview. A senha fica na Vercel, nunca aqui.",
    required: true,
    source: "manual",
    after: ["orcamento-aceito"],
    fields: ["url", "note"],
    urlHint: "https://console.neon.tech/app/projects/…",
  }),
  step({
    key: "variaveis",
    stage: "setup",
    title: "Variáveis de ambiente",
    help: "Configuradas na Vercel para preview e produção. Aqui, só os nomes, nunca os valores.",
    required: true,
    source: "manual",
    after: ["vercel"],
    fields: ["note"],
  }),
  step({
    key: "design-system",
    stage: "setup",
    title: "Layout e design system",
    help: "Cores, fontes, raio e o tom visual. A IA propõe uma direção com o contraste conferido.",
    required: true,
    source: "manual",
    after: ["briefing"],
    fields: ["url", "note"],
    urlHint: "Figma ou o repositório do design system",
    ai: { kind: "design" },
  }),
  step({
    key: "design-aprovado",
    stage: "setup",
    title: "Layout aprovado pelo cliente",
    help: "Vale virar um cartão do quadro: o Administrador aprova em Revisão e fica registrado.",
    required: false,
    source: "manual",
    after: ["design-system"],
    fields: ["note"],
  }),
  step({
    key: "dominio",
    stage: "setup",
    title: "Domínio",
    help: "Registrado em nome do cliente. Anote qual é e onde está registrado.",
    required: true,
    source: "manual",
    after: ["orcamento-aceito"],
    fields: ["value", "note"],
    valueLabel: "Domínio (ex.: cliente.com.br)",
  }),
  step({
    key: "cloudflare",
    stage: "setup",
    title: "DNS e SSL na Cloudflare",
    help: "Zona na Cloudflare, apontando para a Vercel, com SSL completo.",
    required: true,
    source: "manual",
    after: ["dominio"],
    fields: ["url", "note"],
    urlHint: "https://dash.cloudflare.com/…",
  }),
  step({
    key: "email-dominio",
    stage: "setup",
    title: "E-mail do domínio",
    help: "Quando o sistema manda e-mails: domínio no Resend com SPF, DKIM e DMARC.",
    required: false,
    source: "manual",
    after: ["dominio"],
    fields: ["note"],
  }),
  step({
    key: "monitoramento",
    stage: "setup",
    title: "Analytics e monitoramento",
    help: "Analytics, alerta de erro e de queda, para saber de um problema antes do cliente.",
    required: false,
    source: "manual",
    after: ["vercel"],
    fields: ["url", "note"],
  }),
  step({
    key: "lgpd",
    stage: "setup",
    title: "Privacidade e termos de uso",
    help: "Política de privacidade, termos e aviso de cookies quando o sistema guarda dados de pessoas.",
    required: false,
    source: "manual",
    after: ["briefing"],
    fields: ["url", "note"],
  }),

  /* Construção e validação */
  step({
    key: "desenvolvimento",
    stage: "validacao",
    title: "Quadro concluído",
    help: "Os cartões do projeto, até o último em Concluído. As entregas passam por Revisão com o cliente.",
    required: true,
    source: "auto",
    after: ["projeto"],
  }),
  step({
    key: "apresentacao",
    stage: "validacao",
    title: "Reunião de apresentação",
    help: "Mostrar o que foi feito e colher o retorno do cliente.",
    required: true,
    source: "manual",
    after: ["projeto"],
    fields: ["date", "note"],
    ai: { kind: "pauta", meeting: "apresentacao" },
  }),
  step({
    key: "revisao",
    stage: "validacao",
    title: "Revisão do que o cliente trouxe",
    help: "Separe o que é ajuste do escopo, o que é novo (vira orçamento ou aditivo) e o que é dúvida. Cole o retorno: a IA separa.",
    required: true,
    source: "manual",
    after: ["apresentacao"],
    fields: ["note"],
    ai: { kind: "retorno" },
  }),

  /* Entrega e pós-entrega */
  step({
    key: "entrega",
    stage: "entrega",
    title: "Reunião de entrega",
    help: "A última reunião: o que foi entregue, onde fica, como usar e o que vem depois.",
    required: true,
    source: "manual",
    after: ["apresentacao"],
    fields: ["date", "note"],
    ai: { kind: "pauta", meeting: "entrega" },
  }),
  step({
    key: "aceite",
    stage: "entrega",
    title: "Aceite da entrega",
    help: "A data em que o cliente aceitou a entrega. A garantia conta a partir daqui.",
    required: true,
    source: "manual",
    after: ["entrega"],
    fields: ["date", "note"],
  }),
  step({
    key: "saldo",
    stage: "entrega",
    title: "Saldo pago",
    help: "A cobrança do saldo sai preenchida com o valor do orçamento. Conta como paga só quando o Inter confirma.",
    required: true,
    source: "auto",
    after: ["orcamento-aceito"],
  }),
  step({
    key: "url-producao",
    stage: "entrega",
    title: "Endereço de produção",
    help: "Onde o sistema roda. Quando o projeto tem o endereço no cadastro, conta sozinho.",
    required: true,
    source: "hybrid",
    after: ["projeto"],
    fields: ["url"],
    urlHint: "https://app.cliente.com.br",
  }),
  step({
    key: "hospedagem",
    stage: "entrega",
    title: "Produto de hospedagem",
    help: "Vincule o produto ou serviço de hospedagem do catálogo a esta empresa e a esta jornada.",
    required: true,
    source: "auto",
    after: ["orcamento-aceito"],
  }),
  step({
    key: "recorrencia",
    stage: "entrega",
    title: "Recorrência da hospedagem",
    help: "A cobrança mensal da hospedagem, ativa. Nada é emitido sem você publicar.",
    required: true,
    source: "auto",
    after: ["hospedagem"],
  }),
  step({
    key: "passagem",
    stage: "entrega",
    title: "Passagem de contas e documentação",
    help: "Quem é dono de cada conta (repositório, Vercel, domínio) e onde está a documentação.",
    required: false,
    source: "manual",
    after: ["entrega"],
    fields: ["url", "note"],
  }),
  step({
    key: "treinamento",
    stage: "entrega",
    title: "Treinamento do cliente",
    help: "Quem vai usar o sistema sabe fazer o essencial sozinho.",
    required: false,
    source: "manual",
    after: ["entrega"],
    fields: ["date", "note"],
  }),
  step({
    key: "garantia",
    stage: "entrega",
    title: "Garantia",
    help: "Até quando a Anuntech corrige defeitos sem custo. Anote a data final.",
    required: false,
    source: "manual",
    after: ["aceite"],
    fields: ["date", "note"],
  }),
  step({
    key: "suporte",
    stage: "entrega",
    title: "Suporte depois da entrega",
    help: "Contrato de suporte ou banco de horas para o que vier depois.",
    required: false,
    source: "manual",
    after: ["aceite"],
    fields: ["note"],
  }),
  step({
    key: "concluir",
    stage: "entrega",
    title: "Projeto concluído",
    help: "Com tudo entregue e aceito, marque o projeto como concluído no quadro.",
    required: true,
    source: "auto",
    after: ["aceite"],
  }),
];

export const templateStep = (key: string) => JOURNEY_TEMPLATE.find((s) => s.key === key) ?? null;

/** A step the team added to one journey ("pode ter algo que estou esquecendo"). */
export const isExtraKey = (key: string) => key.startsWith("extra:");

/* ---------- briefing ---------- */

const text = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`);
const list = (max: number, items: number, label: string) =>
  z
    .array(z.string().trim().min(1).max(max, `Cada item de ${label} pode ter até ${max} caracteres.`))
    .max(items, `Até ${items} itens em ${label}.`);

export const PROJECT_TYPES = ["site", "app", "sistema", "automacao", "integracao", "outro"] as const;
export const projectTypeLabels: Record<(typeof PROJECT_TYPES)[number], string> = {
  site: "Site",
  app: "Aplicativo",
  sistema: "Sistema",
  automacao: "Automação",
  integracao: "Integração",
  outro: "Outro",
};

export const journeyBriefingSchema = z.object({
  /** What was said, as written or dictated; the AI reads it, the team keeps it. */
  notas: text(16000).default(""),
  objetivo: text(600).default(""),
  problema: text(600).default(""),
  publico: text(400).default(""),
  tipoProjeto: z.enum(PROJECT_TYPES).nullable().default(null),
  funcionalidades: list(200, 30, "funcionalidades").default([]),
  integracoes: list(200, 15, "integrações").default([]),
  restricoes: list(200, 15, "restrições").default([]),
  prazoDesejado: text(200).default(""),
  orcamentoCliente: text(200).default(""),
  decisor: text(200).default(""),
  perguntasAbertas: list(300, 20, "perguntas em aberto").default([]),
  riscos: list(300, 15, "riscos").default([]),
  proximosPassos: list(300, 10, "próximos passos").default([]),
});
export type JourneyBriefing = z.infer<typeof journeyBriefingSchema>;
export const emptyBriefing = (): JourneyBriefing => journeyBriefingSchema.parse({});

/** Enough to design the proposal: the goal and at least one feature. */
export const briefingDone = (b: JourneyBriefing | null | undefined) => !!b && !!b.objetivo.trim() && b.funcionalidades.length > 0;
export const briefingStarted = (b: JourneyBriefing | null | undefined) =>
  !!b && (!!b.notas.trim() || !!b.objetivo.trim() || b.funcionalidades.length > 0);

/** The briefing as the proposal's summary: the part the client reads first, up to 4 thousand characters. */
export function briefingSummary(b: JourneyBriefing): string {
  const block = (label: string, items: string[]) => (items.length ? `${label}:\n${items.map((item) => `- ${item}`).join("\n")}` : "");
  const parts = [
    b.objetivo && `Objetivo: ${b.objetivo}`,
    b.problema && `Problema: ${b.problema}`,
    b.publico && `Público: ${b.publico}`,
    block("Funcionalidades", b.funcionalidades),
    block("Integrações", b.integracoes),
    // The client reads this summary: a budget said in the meeting stays out of it.
    block(
      "Restrições",
      b.restricoes.filter((item) => !/verba|or[cç]amento|R\$|investimento/i.test(item)),
    ),
    b.prazoDesejado && `Prazo desejado: ${b.prazoDesejado}`,
  ].filter(Boolean);
  const summary = parts.join("\n\n");
  return summary.length > 4000 ? `${summary.slice(0, 3999)}…` : summary;
}

/* ---------- design direction (the AI's proposal, checked here) ---------- */

export const designDirectionSchema = z.object({
  paleta: z
    .array(z.object({ nome: text(40).min(1), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), uso: text(160) }))
    .min(3)
    .max(10),
  fontes: z.object({ titulos: text(60).min(1), texto: text(60).min(1) }),
  raio: z.enum(["nenhum", "pequeno", "medio", "grande"]),
  tom: text(300),
  justificativa: text(600),
});
export type DesignDirection = z.infer<typeof designDirectionSchema>;

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
/** WCAG contrast ratio between two "#rrggbb" colors, 1 to 21. */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
/** Each color against white and black: which one reads on it, and whether text on it passes AA (4.5). */
export function swatchContrast(hex: string) {
  const white = contrastRatio(hex, "#ffffff");
  const black = contrastRatio(hex, "#000000");
  const text = white >= black ? "#ffffff" : "#000000";
  const ratio = Math.max(white, black);
  return { text, ratio, passes: ratio >= 4.5 };
}
/** The palette as CSS custom properties, to paste in the new project. */
export function paletteCss(d: DesignDirection) {
  const slug = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "cor";
  const radius = { nenhum: "0", pequeno: "0.375rem", medio: "0.625rem", grande: "1rem" }[d.raio];
  return [":root {", ...d.paleta.map((c) => `  --${slug(c.nome)}: ${c.hex.toLowerCase()}; /* ${c.uso} */`), `  --radius: ${radius};`, `  --font-heading: "${d.fontes.titulos}";`, `  --font-body: "${d.fontes.texto}";`, "}"].join("\n");
}

/* ---------- what the Console knows ---------- */

export type InvoiceFact = { id: string; status: "draft" | "issued" | "paid" | "cancelled"; amountCents: number } | null;

/** Read from the database for one journey (journey-facts.ts); everything here is optional because a journey starts empty. */
export type JourneyFacts = {
  company: {
    id: string;
    name: string;
    archived: boolean;
    billingReady: boolean;
    manager: boolean;
    managerSignedIn: boolean;
    terms: boolean;
  } | null;
  ticket: { id: string; subject: string; status: string } | null;
  quote: {
    id: string;
    number: string;
    title: string;
    status: "draft" | "sent" | "accepted" | "declined" | "cancelled";
    phases: number;
    tasks: number;
    complete: boolean;
    upfrontCents: number;
    balanceCents: number;
    validUntil: string | null;
    publishedAt: string | null;
    decidedAt: string | null;
  } | null;
  contract: { id: string; title: string; status: string; signedAt: string | null; clientSigned: boolean } | null;
  upfront: InvoiceFact;
  balance: InvoiceFact;
  project: {
    id: string;
    name: string;
    status: string;
    url: string | null;
    total: number;
    done: number;
    review: number;
    accessDone: boolean;
    kickoffDone: boolean;
  } | null;
  hosting: { id: string; name: string; subscription: "active" | "paused" | "cancelled" | "draft" | null } | null;
};

export const emptyFacts = (): JourneyFacts => ({
  company: null,
  ticket: null,
  quote: null,
  contract: null,
  upfront: null,
  balance: null,
  project: null,
  hosting: null,
});

/* ---------- stored steps and resolution ---------- */

export type StoredStep = {
  key: string;
  title: string | null;
  stage: string | null;
  status: "todo" | "doing" | "done" | "skipped";
  note: string | null;
  url: string | null;
  value: string | null;
  /** ISO instant. */
  scheduledAt: string | null;
  assigneeId: string | null;
  doneBy: string | null;
  doneAt: string | null;
  aiText: string | null;
};

/** What a step shows: done, in progress, the one to do (ready), waiting on another, or skipped. */
export type StepStatus = "done" | "doing" | "ready" | "waiting" | "skipped";

/** What the step's button does: a link, or one of the journey's own actions. */
export type StepAction =
  | { type: "link"; href: string; label: string; external?: boolean }
  | { type: "createQuote"; label: string }
  | { type: "createProject"; label: string }
  | { type: "linkHosting"; label: string }
  | { type: "linkCompany"; label: string };

export type ResolvedStep = {
  def: JourneyStepDef;
  status: StepStatus;
  /** Who decided: the Console's data or someone of the team. */
  by: "data" | "team" | null;
  /** One line under the title: what the data shows, or why it waits. */
  detail: string | null;
  /** A soft warning (paid infrastructure before the down payment). */
  warning: string | null;
  action: StepAction | null;
  row: StoredStep | null;
  extra: boolean;
};

type Auto = { status: "done" | "doing"; detail: string | null } | null;
const brDate = (iso: string | null) => (iso ? dateLabel(iso.length > 10 ? new Date(iso) : iso) : "");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the Console's data says about a step, when it can say anything. */
export function autoStatus(key: string, f: JourneyFacts, briefing: JourneyBriefing | null): Auto {
  // A cancelled proposal is as good as none: the journey needs a new one.
  const q = f.quote?.status === "cancelled" ? null : f.quote;
  switch (key) {
    case "cadastro":
      return f.company ? { status: "done", detail: f.company.name } : null;
    case "cadastro-cobranca":
      return f.company?.billingReady ? { status: "done", detail: "Documento e endereço completos" } : null;
    case "administrador":
      if (!f.company?.manager) return null;
      return f.company.managerSignedIn
        ? { status: "done", detail: "O Administrador já entrou no Console" }
        : { status: "doing", detail: "Convidado; ainda não entrou" };
    case "pedido":
      return f.ticket ? { status: "done", detail: f.ticket.subject } : null;
    case "briefing":
      return briefingDone(briefing)
        ? { status: "done", detail: plural(briefing!.funcionalidades.length, "funcionalidade", "funcionalidades") }
        : briefingStarted(briefing)
          ? { status: "doing", detail: "Falta o objetivo ou as funcionalidades" }
          : null;
    case "tarefas":
      if (!q) return null;
      return q.tasks > 0
        ? { status: "done", detail: `${plural(q.tasks, "tarefa", "tarefas")} em ${plural(q.phases, "fase", "fases")}` }
        : { status: "doing", detail: `Orçamento ${q.number} sem tarefas` };
    case "orcamento":
      if (!q) return null;
      return q.complete || q.status !== "draft"
        ? { status: "done", detail: `Orçamento ${q.number}` }
        : { status: "doing", detail: "Falta valor da hora, fase ou validade" };
    case "orcamento-enviado":
      if (!q || q.status === "draft" || q.status === "cancelled") return null;
      return { status: "done", detail: q.publishedAt ? `Enviado em ${brDate(q.publishedAt)}` : "Enviado" };
    case "orcamento-aceito":
      if (!q) return null;
      if (q.status === "accepted") return { status: "done", detail: q.decidedAt ? `Aceito em ${brDate(q.decidedAt)}` : "Aceito" };
      if (q.status === "declined")
        return { status: "doing", detail: `Recusado${q.decidedAt ? ` em ${brDate(q.decidedAt)}` : ""}. Duplique como novo rascunho e vincule à jornada, ou marque a jornada como perdida.` };
      if (q.status === "sent") return { status: "doing", detail: q.validUntil ? `Esperando o cliente; válido até ${brDate(q.validUntil)}` : "Esperando o cliente" };
      return null;
    case "contrato":
      if (!f.contract) return null;
      return f.contract.status === "draft"
        ? { status: "doing", detail: "Rascunho: revise e envie" }
        : { status: "done", detail: f.contract.title };
    case "contrato-assinado":
      if (!f.contract || f.contract.status === "draft") return null;
      if (f.contract.status === "signed") return { status: "done", detail: f.contract.signedAt ? `Assinado em ${brDate(f.contract.signedAt)}` : "Assinado" };
      return { status: "doing", detail: f.contract.clientSigned ? "O cliente assinou; falta a Anuntech" : "Esperando a assinatura do cliente" };
    case "entrada":
      if (q && q.status === "accepted" && q.upfrontCents === 0) return { status: "done", detail: "Este orçamento não tem entrada" };
      if (!f.upfront) return null;
      return f.upfront.status === "paid"
        ? { status: "done", detail: "Paga" }
        : f.upfront.status === "cancelled"
          ? null
          : { status: "doing", detail: f.upfront.status === "draft" ? "Cobrança em rascunho" : "Cobrança emitida, esperando o pagamento" };
    case "saldo":
      if (q && q.status === "accepted" && q.balanceCents === 0) return { status: "done", detail: "Este orçamento não tem saldo" };
      if (!f.balance) return null;
      return f.balance.status === "paid"
        ? { status: "done", detail: "Pago" }
        : f.balance.status === "cancelled"
          ? null
          : { status: "doing", detail: f.balance.status === "draft" ? "Cobrança em rascunho" : "Cobrança emitida, esperando o pagamento" };
    case "projeto":
      return f.project ? { status: "done", detail: f.project.name } : null;
    case "acessos":
      return f.project?.accessDone ? { status: "done", detail: "Cartão \"Acessos\" concluído" } : null;
    case "kickoff":
      return f.project?.kickoffDone ? { status: "done", detail: "Cartão \"Reunião de início\" concluído" } : null;
    case "condicoes":
      return f.company?.terms ? { status: "done", detail: "Condições conferidas" } : null;
    case "desenvolvimento":
      if (!f.project || !f.project.total) return null;
      return f.project.done === f.project.total
        ? { status: "done", detail: `${plural(f.project.total, "cartão concluído", "cartões concluídos")}` }
        : {
            status: "doing",
            detail: `${f.project.done} de ${plural(f.project.total, "cartão", "cartões")}${f.project.review ? ` · ${f.project.review} em Revisão` : ""}`,
          };
    case "url-producao":
      return f.project?.url ? { status: "done", detail: f.project.url } : null;
    case "hospedagem":
      return f.hosting ? { status: "done", detail: f.hosting.name } : null;
    case "recorrencia":
      if (!f.hosting?.subscription) return null;
      return f.hosting.subscription === "active"
        ? { status: "done", detail: "Recorrência ativa" }
        : f.hosting.subscription === "cancelled"
          ? null
          : { status: "doing", detail: f.hosting.subscription === "draft" ? "Recorrência em rascunho" : "Recorrência pausada" };
    case "concluir":
      return f.project?.status === "completed" ? { status: "done", detail: "Concluído" } : null;
    default:
      return null;
  }
}

/** Where a step is done, for the journey with these ids (`j` the journey). */
export function stepAction(key: string, f: JourneyFacts, j: { id: string; ticketId: string | null }): StepAction | null {
  const c = f.company?.id;
  const q = f.quote?.status === "cancelled" ? null : f.quote;
  switch (key) {
    case "cadastro":
      return f.company ? { type: "link", href: `/empresas/${c}`, label: "Abrir empresa" } : { type: "link", href: `/empresas/nova?jornada=${j.id}`, label: "Cadastrar empresa" };
    case "cadastro-cobranca":
      return c ? { type: "link", href: `/empresas/${c}?editar=1`, label: "Completar cadastro" } : null;
    case "administrador":
      return c ? { type: "link", href: `/empresas/${c}#pessoas`, label: "Ver pessoas" } : null;
    case "pedido":
      // The request is the client's: the journey links one (Registros), it never files one.
      return f.ticket ? { type: "link", href: `/chamados/${f.ticket.id}`, label: "Abrir pedido" } : null;
    case "nda":
      return c ? { type: "link", href: `/contratos/novo?companyId=${c}`, label: "Novo contrato" } : null;
    case "tarefas":
      return q ? { type: "link", href: `/orcamentos/${q.id}`, label: "Abrir orçamento" } : c ? { type: "createQuote", label: "Criar orçamento com o briefing" } : null;
    case "orcamento":
    case "orcamento-enviado":
    case "orcamento-aceito":
      return q ? { type: "link", href: `/orcamentos/${q.id}`, label: "Abrir orçamento" } : null;
    case "contrato":
    case "contrato-assinado":
      return f.contract
        ? { type: "link", href: `/contratos/${f.contract.id}`, label: "Abrir contrato" }
        : q?.status === "accepted"
          ? { type: "link", href: `/contratos/novo?orcamento=${q.id}`, label: "Preparar contrato" }
          : null;
    case "entrada":
      return f.upfront && f.upfront.status !== "cancelled"
        ? { type: "link", href: `/financeiro/${f.upfront.id}`, label: "Abrir cobrança" }
        : q?.status === "accepted" && q.upfrontCents > 0
          ? { type: "link", href: `/financeiro/nova?orcamento=${q.id}&parte=entrada`, label: "Preparar cobrança" }
          : null;
    case "saldo":
      return f.balance && f.balance.status !== "cancelled"
        ? { type: "link", href: `/financeiro/${f.balance.id}`, label: "Abrir cobrança" }
        : q?.status === "accepted" && q.balanceCents > 0
          ? { type: "link", href: `/financeiro/nova?orcamento=${q.id}&parte=saldo`, label: "Preparar cobrança" }
          : null;
    case "projeto":
      return f.project ? { type: "link", href: `/projetos/${f.project.id}`, label: "Abrir quadro" } : q?.status === "accepted" ? { type: "createProject", label: "Criar projeto" } : null;
    case "acessos":
    case "kickoff":
    case "desenvolvimento":
    case "concluir":
    case "url-producao":
      return f.project ? { type: "link", href: `/projetos/${f.project.id}`, label: "Abrir quadro" } : null;
    case "condicoes":
      return c ? { type: "link", href: `/empresas/${c}#condicoes`, label: "Ver condições" } : null;
    case "hospedagem":
      return f.hosting ? { type: "link", href: `/produtos/${f.hosting.id}`, label: "Abrir produto" } : c ? { type: "linkHosting", label: "Vincular hospedagem" } : null;
    case "recorrencia":
      return f.hosting ? { type: "link", href: `/produtos/${f.hosting.id}`, label: "Abrir produto" } : null;
    default:
      return null;
  }
}

/** Paid infrastructure usually waits for the down payment: a warning, never a block. */
const PAID_SETUP = new Set(["vercel", "neon", "dominio"]);

export type ResolvedJourney = {
  stages: { key: string; title: string; description: string; steps: ResolvedStep[]; optional: ResolvedStep[]; done: number; total: number }[];
  /** The one thing to do now: the first required step ready (or in progress) outside the setup lane, else the first setup step. */
  next: ResolvedStep | null;
  done: number;
  total: number;
  /** Stored steps whose key left the template: kept so nothing is lost. */
  orphans: StoredStep[];
};

const finished = (status: StepStatus) => status === "done" || status === "skipped";
/** "Projeto na Vercel" → "projeto na Vercel": only the first letter, so names keep their capitals. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Every step's status. The data wins: a step the Console shows as done is
 * done whatever was marked. Then what the team marked (done only on manual
 * and hybrid steps; "Não se aplica" on any). Then the data in progress. Then
 * the order: a step waits until the steps it comes after are done.
 */
export function resolveJourney(
  facts: JourneyFacts,
  rows: StoredStep[],
  briefing: JourneyBriefing | null,
  j: { id: string; ticketId: string | null },
): ResolvedJourney {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const resolved = new Map<string, ResolvedStep>();
  // Resolve in template order; `after` always points backwards or to a step resolved in an earlier pass.
  const resolveOne = (def: JourneyStepDef, extra: boolean): ResolvedStep => {
    const cached = resolved.get(def.key);
    if (cached) return cached;
    const row = byKey.get(def.key) ?? null;
    const auto = extra ? null : autoStatus(def.key, facts, briefing);
    let result: Pick<ResolvedStep, "status" | "by" | "detail">;
    if (auto?.status === "done") result = { status: "done", by: "data", detail: auto.detail };
    else if (row?.status === "skipped") result = { status: "skipped", by: "team", detail: row.note ? `Não se aplica: ${row.note}` : "Não se aplica" };
    else if (row?.status === "done" && def.source !== "auto") result = { status: "done", by: "team", detail: manualDetail(def, row) };
    else if (auto?.status === "doing") result = { status: "doing", by: "data", detail: auto.detail };
    else if (row?.status === "doing" && def.source !== "auto") result = { status: "doing", by: "team", detail: manualDetail(def, row) };
    else {
      const blockers = (def.after ?? []).filter((key) => {
        const before = templateStep(key);
        return before && !finished(resolveOne(before, false).status);
      });
      result = blockers.length
        ? { status: "waiting", by: null, detail: `Depende de: ${blockers.map((key) => lowerFirst(templateStep(key)!.title)).join(", ")}.` }
        : { status: "ready", by: null, detail: row ? manualDetail(def, row) : null };
    }
    const step: ResolvedStep = {
      def,
      ...result,
      warning:
        PAID_SETUP.has(def.key) && !finished(result.status) && facts.quote?.status === "accepted" && facts.quote.upfrontCents > 0 && facts.upfront?.status !== "paid"
          ? "A entrada ainda não foi paga. Domínio e planos pagos costumam esperar o pagamento."
          : def.key === "projeto" && !finished(result.status) && facts.contract?.status !== "signed" && facts.quote?.status === "accepted"
            ? "O contrato ainda não foi assinado. O cliente vê o projeto assim que ele é criado."
            : null,
      action: extra ? null : stepAction(def.key, facts, j),
      row,
      extra,
    };
    resolved.set(def.key, step);
    return step;
  };
  for (const def of JOURNEY_TEMPLATE) resolveOne(def, false);
  const extras = rows
    .filter((row) => isExtraKey(row.key))
    .map((row) =>
      resolveOne(
        {
          key: row.key,
          stage: (journeyStageKeys as string[]).includes(row.stage ?? "") ? (row.stage as JourneyStage) : "entrega",
          title: row.title || "Passo",
          help: "Passo acrescentado pela equipe nesta jornada.",
          required: true,
          source: "manual",
          fields: ["url", "note"],
        },
        true,
      ),
    );
  const all = [...JOURNEY_TEMPLATE.map((def) => resolved.get(def.key)!), ...extras];
  const counted = (s: ResolvedStep) => s.def.required || (s.row !== null && s.row.status !== "todo") || s.status === "done";
  const stages = JOURNEY_STAGES.map((stage) => {
    const steps = all.filter((s) => s.def.stage === stage.key);
    const shown = steps.filter((s) => s.def.required || counted(s));
    const optional = steps.filter((s) => !shown.includes(s));
    return {
      key: stage.key,
      title: stage.title,
      description: stage.description,
      steps: shown,
      optional,
      done: shown.filter((s) => finished(s.status)).length,
      total: shown.length,
    };
  });
  const flow = all.filter((s) => s.def.required && s.def.stage !== "setup" && (s.status === "ready" || s.status === "doing"));
  const setup = all.filter((s) => s.def.required && s.def.stage === "setup" && (s.status === "ready" || s.status === "doing"));
  // In progress waiting on someone else (the client's answer, a payment) is not "the next thing to do" while something is ready.
  const actionable = (list: ResolvedStep[]) => list.find((s) => s.status === "ready") ?? list[0] ?? null;
  const known = new Set(JOURNEY_TEMPLATE.map((def) => def.key));
  return {
    stages,
    next: actionable(flow) ?? actionable(setup),
    done: stages.reduce((sum, s) => sum + s.done, 0),
    total: stages.reduce((sum, s) => sum + s.total, 0),
    orphans: rows.filter((row) => !known.has(row.key) && !isExtraKey(row.key)),
  };
}

function manualDetail(def: JourneyStepDef, row: StoredStep): string | null {
  const parts = [
    row.value,
    row.url?.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    row.scheduledAt ? (def.key === "aceite" || def.key === "garantia" ? brDate(row.scheduledAt) : `Em ${brDate(row.scheduledAt)}`) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * The stage the journey is in: the first one, in order, with a required
 * step not finished. The setup lane runs alongside, so it only counts once
 * everything before delivery is done.
 */
export function currentStage(resolved: ResolvedJourney): string {
  const open = (stage: ResolvedJourney["stages"][number]) => stage.steps.some((step) => step.def.required && !finished(step.status));
  return (
    resolved.stages.find((stage) => stage.key !== "setup" && open(stage))?.key ??
    resolved.stages.find(open)?.key ??
    resolved.stages[resolved.stages.length - 1].key
  );
}

/* ---------- list ---------- */

export const JOURNEY_STATUSES = ["active", "paused", "done", "lost"] as const;
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];
export const journeyStatusLabels: Record<JourneyStatus, string> = {
  active: "Em andamento",
  paused: "Pausada",
  done: "Concluída",
  lost: "Perdida",
};
/** The list's filter: one status, or all of them. */
export const journeyFilters = ["active", "paused", "done", "lost", "all"] as const;
export type JourneyFilter = (typeof journeyFilters)[number];
export const journeyFilterLabels: Record<JourneyFilter, string> = {
  active: "Em andamento",
  paused: "Pausadas",
  done: "Concluídas",
  lost: "Perdidas",
  all: "Todas",
};
/** A journey with no change for this many days shows as stalled. */
export const JOURNEY_STALLED_DAYS = 5;

/** A plain https link: no user or password in it, and no query parameter that carries a key or a token. */
export function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if ([...url.searchParams.keys()].some((key) => /token|key|secret|pass|senha|sig|auth/i.test(key))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Text that looks like a secret: a connection string with a password, "senha: …",
 * NAME_KEY=value, or a provider key. Notes keep names and links; the values
 * live in the Vercel variables or the team's vault.
 */
export function looksSecret(text: string) {
  return (
    /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/i.test(text) ||
    /\b(senha|password|pwd)\b[^\n]{0,30}?[:=]\s*\S/i.test(text) ||
    /\b(senha|password|pwd)\b[^\n]{0,30}?\s(é|e)\s+\S*[\d!@#$%^&*]/i.test(text) ||
    /\b[A-Z][A-Z0-9_]*(SECRET|TOKEN|KEY|PASSWORD|PASS)[A-Z0-9_]*\s*=\s*[^\s<[]/.test(text) ||
    /\b(sk-|sk_|ghp_|github_pat_|re_|whsec_|npm_|napi_)[A-Za-z0-9_-]{16,}/.test(text) ||
    /\bAIza[0-9A-Za-z_-]{35}\b/.test(text)
  );
}
