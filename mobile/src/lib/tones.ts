/** The pill color of a contract or quote situation: done is green, waiting on someone is amber. */
export const contractTone = (status: string) =>
  status === "signed" ? "good" : status === "sent" || status === "in_review" ? "attention" : "neutral";

export const quoteTone = (status: string) => (status === "accepted" ? "good" : status === "sent" ? "attention" : "neutral");

/** Who signed or answered, as the Console writes it. */
export const partyLabels: Record<string, string> = { client: "Pela empresa", anuntech: "Pela Anuntech" };
