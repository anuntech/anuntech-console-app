import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INVOICE_BANK_EVENTS,
  INVOICE_DELETE_REFUSAL,
  canDeleteDraftInvoice,
  canDeleteTicket,
  invoiceDeletionBlock,
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
  assert.equal(canDeleteDraftInvoice(draft), true);
  assert.equal(invoiceDeletionBlock(draft), null);
  assert.equal(canDeleteDraftInvoice({ ...draft, status: "cancelled" }), true);
});

test("issued and paid invoices are never deleted", () => {
  for (const status of ["issued", "paid", "unknown"]) {
    assert.equal(canDeleteDraftInvoice({ ...draft, status }), false, status);
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
      assert.equal(canDeleteDraftInvoice({ ...draft, status, ...trace }), false, JSON.stringify({ status, trace }));
  }
  for (const fiscalStatus of ["processing", "authorized", "error"])
    assert.equal(canDeleteDraftInvoice({ ...draft, fiscalStatus }), false, fiscalStatus);
});

test("the bank events the server checks exist, and every delete has a label", () => {
  for (const action of INVOICE_BANK_EVENTS) assert.ok(auditLabels[action], action);
  assert.ok(auditLabels["ticket.deleted"]);
  assert.ok(auditLabels["invoice.deleted"]);
});
