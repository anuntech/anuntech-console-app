import type { QuoteStatus } from "@/lib/quotes/quote-model";

/** One proposal as the lists show it. */
export type QuoteRow = {
  id: string;
  number: string;
  title: string;
  companyId: string;
  /** Razão social, as stored; lists show its display name. */
  company: string;
  /** CNPJ/CPF, so a MEI's number can come off its name on screen. */
  companyDocument?: string | null;
  status: QuoteStatus;
  validUntil: string | null;
  totalCents: number;
  hoursMin: number;
  hoursMax: number;
  updatedAt: string;
};
