import type { ToneName } from "./status";

/** The pill of a product's, service's or project's situation: suspended is red, paused amber. */
export const engagementTone = (status: string): ToneName =>
  status === "suspended" ? "danger" : status === "paused" ? "attention" : status === "active" ? "good" : "neutral";

/** "/mês" or "/ano" after a price in a list, as the web's Produtos. */
export const intervalSuffix = (interval: "monthly" | "yearly" | null) => (interval === "monthly" ? "/mês" : interval === "yearly" ? "/ano" : "");

/** "por mês" or "por ano" after a price in the service's Cobrança. */
export const intervalWords = (interval: "monthly" | "yearly" | null) => (interval === "monthly" ? " por mês" : interval === "yearly" ? " por ano" : "");
