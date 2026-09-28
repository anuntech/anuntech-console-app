import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INVOICE_BANK_EVENTS,
  INVOICE_DELETE_REFUSAL,
  canDeleteInvoice,
  canDeleteTicket,
  invoiceDeletionBlock,
  recurrenceAllowsDelete,
  type InvoiceDeletionInput,
} from "../src/lib/deletion-rules";
import { auditLabels } from "../src/lib/format";

test("a ticket can be deleted in any state", () => {
  for (const status of ["open", "in_progress", "waiting_customer", "resolved", "closed"])
    assert.equal(canDeleteTicket(status), true, status);
  assert.equal(canDeleteTicket(""), false);
  assert.equal(canDeleteTicket("archived"), false);
});

const draft: InvoiceDeletionInput = {
  status: "draft",
  bankRequest: null,
  providerId: null,
  bankBase: null,
  bankStatus: null,
  bankCheckedAt: null,
  boletoLine: null,
  pixCopyPaste: null,
  boletoUrl: null,
  boletoPdf: null,
  publicId: null,
  fiscalStatus: "not_requested",
  fiscalUrl: null,
};

test("a draft that never reached the bank can be deleted, cancelled or not", () => {
  assert.equal(canDeleteInvoice(draft), true);
  assert.equal(invoiceDeletionBlock(draft), null);
  assert.equal(canDeleteInvoice({ ...draft, status: "cancelled" }), true);
});

test("issued and paid invoices are never deleted", () => {
  for (const status of ["issued", "paid", "unknown"]) {
    assert.equal(canDeleteInvoice({ ...draft, status }), false, status);
    assert.equal(invoiceDeletionBlock({ ...draft, status }), INVOICE_DELETE_REFUSAL);
  }
});

test("any trace of the Inter blocks the delete, even on a draft", () => {
  const traces: Partial<InvoiceDeletionInput>[] = [
    // A failed or undetermined emission keeps the request on the draft.
    { bankRequest: { seuNumero: "ABC" }, bankBase: "https://cdpj.partners.bancointer.com.br", bankStatus: "RESPOSTA_INDEFINIDA" },
    { bankRequest: {} },
    { bankRequest: true },
    { providerId: "0b0e2d1c-6b1f-4e7e-9a0c-000000000000" },
    { bankBase: "https://cdpj.partners.bancointer.com.br" },
    { bankStatus: "ENVIANDO" },
    { bankCheckedAt: new Date() },
    { boletoLine: "0000" },
    { pixCopyPaste: "000201" },
    { boletoUrl: "https://example.com/boleto.pdf" },
    { boletoPdf: "cache" },
    // A reissue clears the bank columns but keeps the public link.
    { publicId: "pub" },
    { fiscalUrl: "https://example.com/nfse" },
  ];
  for (const trace of traces) {
    for (const status of ["draft", "cancelled"])
      assert.equal(canDeleteInvoice({ ...draft, status, ...trace }), false, JSON.stringify({ status, trace }));
  }
  for (const fiscalStatus of ["processing", "authorized", "error"])
    assert.equal(canDeleteInvoice({ ...draft, fiscalStatus }), false, fiscalStatus);
});

// A charge the reconciliation found closed at the Inter keeps every trace.
const closed: InvoiceDeletionInput = {
  ...draft,
  status: "cancelled",
  bankRequest: { seuNumero: "ABC" },
  providerId: "0b0e2d1c-6b1f-4e7e-9a0c-000000000000",
  bankBase: "https://cdpj.partners.bancointer.com.br",
  bankStatus: "CANCELADO",
  bankCheckedAt: new Date(),
  boletoLine: "0000",
  pixCopyPaste: "000201",
  publicId: "pub",
};

test("a charge the Inter closed can be deleted", () => {
  for (const bankStatus of ["CANCELADO", "EXPIRADO", "FALHA_EMISSAO"])
    assert.equal(invoiceDeletionBlock({ ...closed, bankStatus }), null, bankStatus);
});

test("a charge still open, paid or undetermined at the bank stays", () => {
  // The reconciliation has not applied the bank's answer yet.
  assert.equal(canDeleteInvoice({ ...closed, status: "issued" }), false);
  assert.equal(canDeleteInvoice({ ...closed, status: "paid", bankStatus: "RECEBIDO" }), false);
  for (const bankStatus of ["A_RECEBER", "ATRASADO", "MARCADO_RECEBIDO", "EM_PROCESSAMENTO", "RESPOSTA_INDEFINIDA", "RECUSADA", null])
    assert.equal(canDeleteInvoice({ ...closed, bankStatus }), false, String(bankStatus));
});

test("a nota fiscal keeps the invoice, even when the Inter closed the charge", () => {
  assert.equal(canDeleteInvoice({ ...closed, fiscalStatus: "authorized" }), false);
  assert.equal(canDeleteInvoice({ ...closed, fiscalUrl: "https://example.com/nfse" }), false);
});

test("deleting never makes a recurrence bill a period again", () => {
  const due = { status: "cancelled", bankStatus: "CANCELADO", dueDate: "2026-09-10" };
  assert.equal(recurrenceAllowsDelete(due, null), true);
  assert.equal(recurrenceAllowsDelete(due, { status: "active", nextDueDate: "2026-10-10" }), true);
  assert.equal(recurrenceAllowsDelete(due, { status: "paused", nextDueDate: "2026-09-10" }), false);
  assert.equal(recurrenceAllowsDelete(due, { status: "active", nextDueDate: "2026-09-01" }), false);
  assert.equal(recurrenceAllowsDelete(due, { status: "cancelled", nextDueDate: "2026-09-10" }), true);
  const draftPeriod = { status: "draft", bankStatus: null, dueDate: "2026-09-10" };
  assert.equal(recurrenceAllowsDelete(draftPeriod, { status: "draft", nextDueDate: "2026-09-10" }), true);
  assert.equal(recurrenceAllowsDelete(draftPeriod, { status: "active", nextDueDate: "2026-10-10" }), false);
});

test("the bank events the server checks exist, and every delete has a label", () => {
  for (const action of INVOICE_BANK_EVENTS) assert.ok(auditLabels[action], action);
  assert.ok(auditLabels["ticket.deleted"]);
  assert.ok(auditLabels["invoice.deleted"]);
});
