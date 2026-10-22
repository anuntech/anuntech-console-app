import assert from "node:assert/strict";
import test from "node:test";
import {
  invoiceFiscalView,
  invoiceProcessing,
  invoiceRecurrenceView,
  invoiceTermsView,
  overdueDays,
} from "../src/lib/billing/invoice-client-view";

const terms = { discountCents: null, fineBps: null, interestMonthlyBps: null };

test("days overdue count only while the invoice shows as overdue", () => {
  assert.equal(overdueDays("overdue", "2026-10-01", "2026-10-22"), 21);
  assert.equal(overdueDays("overdue", "2026-12-31", "2027-01-01"), 1);
  assert.equal(overdueDays("issued", "2026-10-01", "2026-10-22"), 0);
  assert.equal(overdueDays("paid", "2026-10-01", "2026-10-22"), 0);
});

test("processing means the bank holds the charge without Pix and boleto yet", () => {
  const base = { status: "issued" as const, providerId: "inter-1", pixCopyPaste: null, boletoLine: null };
  assert.equal(invoiceProcessing(base), true);
  assert.equal(invoiceProcessing({ ...base, pixCopyPaste: "000201" }), false);
  assert.equal(invoiceProcessing({ ...base, boletoLine: "2379" }), false);
  assert.equal(invoiceProcessing({ ...base, providerId: null }), false);
  assert.equal(invoiceProcessing({ ...base, status: "paid" }), false);
});

test("terms show while the charge can be paid, with the on-time amount and the late fees", () => {
  assert.equal(invoiceTermsView({ status: "issued", amountCents: 10000, ...terms }), null);
  const view = invoiceTermsView({ status: "issued", amountCents: 10000, discountCents: 500, fineBps: 200, interestMonthlyBps: 100 });
  assert.deepEqual(view, {
    discountCents: 500,
    onTimeCents: 9500,
    fineBps: 200,
    interestMonthlyBps: 100,
    lateFees: "multa de 2% e juros de 1% ao mês",
  });
  assert.equal(invoiceTermsView({ status: "issued", amountCents: 10000, ...terms, fineBps: 150 })?.lateFees, "multa de 1,5%");
  assert.equal(invoiceTermsView({ status: "issued", amountCents: 10000, ...terms, discountCents: 100 })?.lateFees, null);
  assert.equal(invoiceTermsView({ status: "paid", amountCents: 10000, ...terms, discountCents: 100 }), null);
  assert.equal(invoiceTermsView({ status: "cancelled", amountCents: 10000, ...terms, fineBps: 200 }), null);
});

test("the fiscal card follows the web: requested, or paid for the client, settled for the team", () => {
  const invoice = { status: "issued" as const, fiscalStatus: "not_requested" as const, fiscalUrl: null };
  assert.equal(invoiceFiscalView(invoice, false), null);
  assert.deepEqual(invoiceFiscalView(invoice, true), { status: "not_requested", url: null });
  assert.deepEqual(invoiceFiscalView({ ...invoice, status: "paid" }, false), { status: "not_requested", url: null });
  assert.deepEqual(invoiceFiscalView({ ...invoice, fiscalStatus: "processing" }, false), { status: "processing", url: null });
  assert.deepEqual(
    invoiceFiscalView({ status: "paid", fiscalStatus: "authorized", fiscalUrl: "https://nfe.example/1" }, false),
    { status: "authorized", url: "https://nfe.example/1" },
  );
  // A link registered before the authorization is not offered.
  assert.equal(invoiceFiscalView({ status: "paid", fiscalStatus: "error", fiscalUrl: "https://nfe.example/1" }, false)?.url, null);
});

test("the recurrence says what comes next only while active and issued or paid", () => {
  const sub = { interval: "monthly" as const, status: "active", nextDueDate: "2026-11-10", leadDays: 5, amountCents: 9900 };
  assert.equal(invoiceRecurrenceView({ status: "issued" }, null, false, null), null);
  assert.deepEqual(invoiceRecurrenceView({ status: "issued" }, sub, true, null), {
    interval: "monthly",
    ahead: null,
    next: { amountCents: 9900, dueDate: "2026-11-10", issueDate: "2026-11-05", onPayment: true },
  });
  // Already paid: the next period no longer waits for this payment.
  assert.equal(invoiceRecurrenceView({ status: "paid" }, sub, true, null)?.next?.onPayment, false);
  const ahead = { id: "x", dueDate: "2026-11-10", amountCents: 9900, status: "issued" as const };
  assert.deepEqual(invoiceRecurrenceView({ status: "paid" }, sub, false, ahead), { interval: "monthly", ahead, next: null });
  assert.deepEqual(invoiceRecurrenceView({ status: "issued" }, { ...sub, status: "paused" }, false, ahead), {
    interval: "monthly",
    ahead: null,
    next: null,
  });
  assert.equal(invoiceRecurrenceView({ status: "draft" }, { ...sub, interval: "yearly" }, false, null)?.next, null);
});
