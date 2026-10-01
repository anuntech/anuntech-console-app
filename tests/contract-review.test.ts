import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyProposal,
  blockLabel,
  contractBlocks,
  diffBlocks,
  diffWords,
  requestable,
} from "../src/lib/contracts/contract-text";
import { contractDeletionBlock } from "../src/lib/deletion-rules";

const body = [
  "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
  "CONTRATANTE: Empresa A, CNPJ 00.000.000/0001-00.",
  "CLÁUSULA 1 — OBJETO\n1.1 Desenvolvimento do portal.\n1.2 Suporte por 30 dias.",
  "CLÁUSULA 2 — PAGAMENTO\n2.1 Pagamento em 30 dias.",
  "São Paulo, 1 de outubro de 2026.",
].join("\n\n");

test("clauses, parties and paragraphs can be asked to change, with a readable name", () => {
  const blocks = contractBlocks(body);
  const names = blocks.filter(requestable).map(blockLabel);
  assert.deepEqual(names, ["Contratante", "Cláusula 1.1", "Cláusula 1.2", "Cláusula 2.1", "Parágrafo"]);
  assert.equal(blocks.filter((b) => !requestable(b)).length, 3);
});

test("a proposal replaces the whole clause text and keeps its number", () => {
  const next = applyProposal(body, "Pagamento em 30 dias.", "Pagamento em 15 dias após a entrega.");
  assert.ok(next?.includes("2.1 Pagamento em 15 dias após a entrega."));
  assert.ok(!next?.includes("Pagamento em 30 dias."));
  const party = applyProposal(body, "Empresa A, CNPJ 00.000.000/0001-00.", "Empresa A Ltda., CNPJ 00.000.000/0001-00.");
  assert.ok(party?.includes("CONTRATANTE: Empresa A Ltda."));
});

test("a proposal is left to the team when the block changed or is ambiguous", () => {
  // The team already rewrote it.
  assert.equal(applyProposal(body, "Pagamento em 45 dias.", "x"), null);
  // Part of another clause is not the block.
  assert.equal(applyProposal(body, "30 dias.", "x"), null);
  // The same words twice.
  assert.equal(applyProposal(`${body}\n\n2.2 Pagamento em 30 dias.`, "Pagamento em 30 dias.", "x"), null);
});

test("the new version marks what changed and where text left", () => {
  const next = body.replace("1.2 Suporte por 30 dias.", "1.2 Suporte por 60 dias.").replace("São Paulo, 1 de outubro de 2026.", "");
  const changes = diffBlocks(contractBlocks(body), contractBlocks(next));
  const summary = changes.map((c) => `${c.change}:${c.block.text}`);
  assert.ok(summary.includes("removed:Suporte por 30 dias."));
  assert.ok(summary.includes("added:Suporte por 60 dias."));
  assert.ok(summary.includes("removed:São Paulo, 1 de outubro de 2026."));
  assert.ok(summary.includes("same:Desenvolvimento do portal."));
  // The removed text sits right before what replaced it.
  const at = summary.indexOf("removed:Suporte por 30 dias.");
  assert.equal(summary[at + 1], "added:Suporte por 60 dias.");
  // Every block of the new text keeps its position for the anchors.
  assert.deepEqual(
    changes.filter((c) => c.change !== "removed").map((c) => c.index),
    contractBlocks(next).map((_, i) => i),
  );
});

test("word by word, a proposed text shows what it keeps, drops and adds", () => {
  const words = diffWords("Pagamento em 30 dias.", "Pagamento em 15 dias após a entrega.");
  assert.deepEqual(words, [
    { text: "Pagamento em", change: "same" },
    { text: " 30 dias.", change: "removed" },
    { text: " 15 dias após a entrega.", change: "added" },
  ]);
  assert.equal(words.filter((w) => w.change !== "removed").map((w) => w.text).join(""), "Pagamento em 15 dias após a entrega.");
});

test("a contract in review is not deleted; it is cancelled first", () => {
  assert.equal(
    contractDeletionBlock({ status: "in_review", signatures: 0, amendments: 0 }),
    "Este contrato está em revisão com o cliente; cancele-o antes de excluir.",
  );
});
