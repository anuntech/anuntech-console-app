import type { SFSymbol } from "expo-symbols";

/*
 * One map from a situation to its tone and symbol, shared by pills and the
 * round status tiles, so a status always reads as icon, color and words.
 */
export type ToneName = "info" | "attention" | "good" | "danger" | "neutral";
export type StatusLook = { tone: ToneName; icon: SFSymbol };

export const ticketLook: Record<string, StatusLook> = {
  open: { tone: "info", icon: "clock.fill" },
  in_progress: { tone: "info", icon: "wrench.and.screwdriver.fill" },
  waiting_customer: { tone: "attention", icon: "exclamationmark.bubble.fill" },
  resolved: { tone: "good", icon: "checkmark.circle.fill" },
  closed: { tone: "neutral", icon: "archivebox.fill" },
};

export const invoiceLook: Record<string, StatusLook> = {
  issued: { tone: "info", icon: "clock.fill" },
  overdue: { tone: "danger", icon: "exclamationmark.triangle.fill" },
  expired: { tone: "danger", icon: "exclamationmark.triangle.fill" },
  paid: { tone: "good", icon: "checkmark.circle.fill" },
  scheduled: { tone: "neutral", icon: "calendar" },
  draft: { tone: "neutral", icon: "pencil" },
  cancelled: { tone: "neutral", icon: "xmark.circle.fill" },
};
