import type { QuoteStatus } from "@/lib/quotes/quote-model";

/** One proposal as the lists show it. */
export type QuoteRow = {
  id: string;
  number: string;
  title: string;
  companyId: string;
  company: string;
  status: QuoteStatus;
  validUntil: string | null;
  totalCents: number;
  hoursMin: number;
  hoursMax: number;
  updatedAt: string;
};
