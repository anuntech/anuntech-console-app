/*
 * What the Console prepares a charge from, and the automation event that
 * records it was prepared, one per source (unique kind + entity). The event
 * points at the new invoice in `details.invoiceId`; cancelling or deleting
 * that draft removes it, so the source can be billed again.
 */

export const chargeSourceKinds = ["rebill", "quote_upfront", "quote_balance", "contract"] as const;
export type ChargeSourceKind = (typeof chargeSourceKinds)[number];

/** The automation event kind per source. */
export const chargeSourceEvent: Record<ChargeSourceKind, string> = {
  rebill: "debt.rebilled",
  quote_upfront: "quote.upfront",
  quote_balance: "quote.balance",
  contract: "contract.recurrence",
};

export const preparedChargeEvents = Object.values(chargeSourceEvent);
