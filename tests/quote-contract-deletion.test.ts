import assert from "node:assert/strict";
import test from "node:test";
import {
  QUOTE_DELETE_REFUSAL,
  canDeleteContract,
  canDeleteQuote,
  contractDeletionBlock,
  quoteDecisionNotice,
  quoteDeletionBlock,
} from "../src/lib/deletion-rules";

const today = "2026-09-25";

test("a proposal can be deleted unless it is still with the client", () => {
  for (const status of ["draft", "cancelled", "accepted", "declined"] as const) {
    assert.equal(canDeleteQuote(status), true, status);
    assert.equal(quoteDeletionBlock(status), null, status);
  }
  // Waiting for an answer: no validity, or validity not yet past.
  assert.equal(canDeleteQuote("sent", { validUntil: null, today }), false);
  assert.equal(canDeleteQuote("sent", { validUntil: "2026-09-25", today }), false);
  assert.equal(canDeleteQuote("sent", { validUntil: "2026-10-10", today }), false);
  assert.equal(quoteDeletionBlock("sent", { validUntil: "2026-10-10", today }), QUOTE_DELETE_REFUSAL);
  assert.equal(QUOTE_DELETE_REFUSAL, "Cancele o orçamento antes de excluir: ele ainda está com o cliente.");
});

test("an expired proposal can be deleted, but only when the validity is known", () => {
  assert.equal(canDeleteQuote("sent", { validUntil: "2026-09-24", today }), true);
  assert.equal(quoteDeletionBlock("sent", { validUntil: "2026-09-24", today }), null);
  // Without the dates a sent proposal is treated as still open.
  assert.equal(canDeleteQuote("sent"), false);
});

test("the confirmation mentions the client's answer only when there is one", () => {
  assert.match(quoteDecisionNotice("accepted") ?? "", /registro do aceite do cliente .* histórico de auditoria/);
  assert.match(quoteDecisionNotice("declined") ?? "", /registro da recusa do cliente .* histórico de auditoria/);
  assert.equal(quoteDecisionNotice("draft"), null);
  assert.equal(quoteDecisionNotice("cancelled"), null);
  assert.equal(quoteDecisionNotice("sent"), null);
});

test("only unsigned drafts and cancelled contracts without amendments can be deleted", () => {
  assert.equal(canDeleteContract({ status: "draft", signatures: 0, amendments: 0 }), true);
  assert.equal(canDeleteContract({ status: "cancelled", signatures: 0, amendments: 0 }), true);
  assert.equal(canDeleteContract({ status: "draft", signatures: 0, amendments: 0, kind: "amendment" }), true);
  assert.equal(canDeleteContract({ status: "sent", signatures: 0, amendments: 0 }), false);
  assert.equal(canDeleteContract({ status: "signed", signatures: 2, amendments: 0 }), false);
});

test("a signature on any earlier version or an amendment keeps the contract", () => {
  // Sent, signed by the client, then reverted to draft or cancelled: the signature stays as record.
  assert.equal(canDeleteContract({ status: "draft", signatures: 1, amendments: 0 }), false);
  assert.equal(canDeleteContract({ status: "cancelled", signatures: 1, amendments: 0 }), false);
  // Amendments point at the contract, cancelled ones included.
  assert.equal(canDeleteContract({ status: "cancelled", signatures: 0, amendments: 1 }), false);
});

test("the refusal says why, naming contract or amendment", () => {
  assert.equal(contractDeletionBlock({ status: "signed", signatures: 2, amendments: 0 }), "Um contrato assinado não pode ser excluído.");
  assert.equal(
    contractDeletionBlock({ status: "signed", signatures: 2, amendments: 0, kind: "amendment" }),
    "Um aditivo assinado não pode ser excluído.",
  );
  assert.match(contractDeletionBlock({ status: "sent", signatures: 0, amendments: 0 }) ?? "", /aguardando assinatura; cancele-o/);
  assert.match(contractDeletionBlock({ status: "draft", signatures: 1, amendments: 0 }) ?? "", /já recebeu assinatura/);
  assert.match(contractDeletionBlock({ status: "cancelled", signatures: 0, amendments: 2 }) ?? "", /tem aditivos/);
  assert.equal(contractDeletionBlock({ status: "cancelled", signatures: 0, amendments: 0 }), null);
});
