import type { ToneName } from "./status";

/** The pill color of a contract or quote situation: done is green, waiting on someone is amber. */
export const contractTone = (status: string): ToneName =>
  status === "signed" ? "good" : status === "sent" || status === "in_review" ? "attention" : "neutral";

export const quoteTone = (status: string): ToneName =>
  status === "accepted" ? "good" : status === "sent" ? "attention" : status === "declined" ? "danger" : "neutral";

/** Who signed or answered, as the Console writes it. */
export const partyLabels: Record<string, string> = { client: "Pela empresa", anuntech: "Pela Anuntech" };
