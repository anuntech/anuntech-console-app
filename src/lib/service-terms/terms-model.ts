/*
 * What a company's contract promises and asks, in a shape the Console can
 * compute with: the "Condições de atendimento". Every value carries the
 * clause it comes from; nothing here is ever shown to a client unless a
 * company has conditions published from a contract. Times are business
 * minutes (9h to 18h on business days, so 1 dia útil = 540).
 */

export const BUSINESS_DAY_MINUTES = 540;

export const ticketLevels = ["critical", "high", "normal"] as const;
export type TicketLevel = (typeof ticketLevels)[number];

export type ResponseRule = {
  /** A commitment (SUP 5.2). */
  firstResponseMinutes: number;
  /** A goal, never a commitment; absent where the contract sets none. */
  goalMinutes?: number | null;
};

export type ServicePolicy = {
  /** Contracts with priority levels (Suporte) answer per level; the others treat every ticket alike. */
  levels: boolean;
  response: Partial<Record<TicketLevel, ResponseRule>>;
  /** A faster first response when the whole service is down (Infra, E-mail). */
  outageFirstResponseMinutes?: number | null;
  /** The clock stops while the ticket waits for the client (SUP 5.3). */
  pausesWhileWaiting: boolean;
  /** Days the client has to answer the team (SUP 6.1 b). */
  clientResponseDays?: number | null;
  /** Days the client has to test a delivery (SUP 4.3). */
  testDays?: number | null;
  /** Silence or use in production counts as acceptance. */
  tacitAcceptance: boolean;
  hoursBank?: {
    monthlyMinutes: number;
    alertPercent: number;
    overageCents?: number | null;
    /** Days to contest the monthly report (SUP 3.4). */
    reportContestDays?: number | null;
  } | null;
  /** Improvements up to this size come out of the hours bank with an approved estimate (SUP 4.1). */
  improvementBankLimitMinutes?: number | null;
  improvementWarrantyDays?: number | null;
  outOfHours: "not_included" | "if_contracted" | "unspecified";
  includesDevelopment: boolean;
  /** Days late before suspension, and whether a notice comes first. */
  suspensionDays?: number | null;
  suspensionNotice?: boolean | null;
  /** End of a delivery warranty (Serviço pontual), as YYYY-MM-DD. */
  warrantyUntil?: string | null;
  /** Clause behind each value, keyed by the policy field ("response", "pausesWhileWaiting"…). */
  clauses: Record<string, string>;
};

/** What a ticket keeps from the conditions in force when it was opened. */
export type TermsSnapshot = {
  termsId: string;
  version: number;
  label: string;
  preset: string;
  policy: ServicePolicy;
  /** From when the client sees these terms; before that only the team does. */
  publishAt: string | null;
  personClient: boolean;
};

export type TermsBasis = "console_contract" | "external_contract" | "none";
