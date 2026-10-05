/*
 * What a ticket is about, as the client picks it when opening: the kind of
 * need, and for problems how badly it hurts. The team sets the priority
 * (support contract 5.1); the Console only suggests it from the impact.
 * Client-facing words live here so the form, the list and the assistant say
 * the same thing.
 */

export const ticketKinds = ["problem", "question", "change", "access", "new_project"] as const;
export type TicketKind = (typeof ticketKinds)[number];

export const ticketKindLabels: Record<TicketKind, string> = {
  problem: "Parou ou deu erro",
  question: "Dúvida",
  change: "Ajuste ou algo novo",
  access: "Acesso",
  new_project: "App ou projeto novo",
};

export const ticketKindHints: Record<TicketKind, string> = {
  problem: "Algo não funciona como deveria.",
  question: "Como usar ou onde encontrar algo.",
  change: "Um texto, uma regra, uma tela ou uma função.",
  access: "Liberar, remover ou recuperar um acesso.",
  new_project: "A equipe conversa com você e prepara um orçamento.",
};

/** Short names for badges in lists. */
export const ticketKindShort: Record<TicketKind, string> = {
  problem: "Erro",
  question: "Dúvida",
  change: "Ajuste",
  access: "Acesso",
  new_project: "Projeto novo",
};

/** Slugs for links that open the form with a kind already chosen (/chamados/novo?tipo=novo-projeto). */
export const ticketKindSlugs: Record<string, TicketKind> = {
  erro: "problem",
  duvida: "question",
  ajuste: "change",
  acesso: "access",
  "novo-projeto": "new_project",
};

export const ticketImpacts = ["down", "workaround", "other"] as const;
export type TicketImpact = (typeof ticketImpacts)[number];

export const ticketImpactLabels: Record<TicketImpact, string> = {
  down: "Parou tudo e não dá para contornar",
  workaround: "Falha, mas dá para contornar, ou afeta muita gente",
  other: "Outro problema",
};

export const ticketChannels = ["console", "whatsapp", "phone", "chat", "email"] as const;
export type TicketChannel = (typeof ticketChannels)[number];
export const ticketChannelLabels: Record<TicketChannel, string> = {
  console: "Console",
  whatsapp: "WhatsApp",
  phone: "Telefone",
  chat: "Chat",
  email: "E-mail",
};

/** What the description should tell, per kind. */
export const ticketDescriptionHints: Record<TicketKind, string> = {
  problem: "Conte o que você fez, o que esperava e o que aconteceu. Um print ajuda.",
  question: "Conte o que você quer fazer e onde está agora.",
  change: "Conte o que precisa mudar, onde e por quê.",
  access: "Diga quem, em qual sistema e o que precisa: liberar, remover ou recuperar.",
  new_project: "Conte o problema, quem vai usar e se há uma data importante.",
};

/**
 * The priority the Console suggests; the team confirms or changes it.
 * Contracts without levels (licenses, infra, e-mail) never get Crítica.
 */
export function suggestPriority(
  kind: TicketKind | null | undefined,
  impact: TicketImpact | null | undefined,
  levels = false,
): "critical" | "high" | "normal" {
  if (kind !== "problem") return "normal";
  if (impact === "down") return levels ? "critical" : "high";
  if (impact === "workaround") return "high";
  return "normal";
}

/** A request for a new app or project is sales, not support: no response clock. */
export const outsideSupportClock = (kind: TicketKind | null | undefined) => kind === "new_project";
