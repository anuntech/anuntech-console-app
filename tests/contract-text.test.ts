import assert from "node:assert/strict";
import test from "node:test";
import { contractBlocks } from "../src/lib/contract-text";

test("contract text is read into title, parties, headings, clauses and paragraphs", () => {
  const body = [
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    "CONTRATANTE: Maxipark Ltda, CNPJ 12.345.678/0001-90.\nCONTRATADA: Anuntech Ltda, CNPJ 98.765.432/0001-10.",
    "As partes celebram o presente contrato.",
    "CLÁUSULA 1 — OBJETO\n1.1. A CONTRATADA prestará o serviço.\n1.2. A licença compreende o acesso\ncontinuado na linha seguinte.",
    "São Paulo, 24 de setembro de 2026.",
  ].join("\n\n");
  assert.deepEqual(contractBlocks(body), [
    { type: "title", text: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS" },
    { type: "party", label: "CONTRATANTE", text: "Maxipark Ltda, CNPJ 12.345.678/0001-90." },
    { type: "party", label: "CONTRATADA", text: "Anuntech Ltda, CNPJ 98.765.432/0001-10." },
    { type: "paragraph", text: "As partes celebram o presente contrato." },
    { type: "heading", text: "CLÁUSULA 1 — OBJETO" },
    { type: "clause", number: "1.1", text: "A CONTRATADA prestará o serviço." },
    { type: "clause", number: "1.2", text: "A licença compreende o acesso\ncontinuado na linha seguinte." },
    { type: "paragraph", text: "São Paulo, 24 de setembro de 2026." },
  ]);
});

test("a plain text without structure stays as paragraphs", () => {
  assert.deepEqual(contractBlocks("Primeiro parágrafo.\n\nSegundo parágrafo, com CNPJ 00.000.000/0001-00."), [
    { type: "paragraph", text: "Primeiro parágrafo." },
    { type: "paragraph", text: "Segundo parágrafo, com CNPJ 00.000.000/0001-00." },
  ]);
  // A sentence in caps that ends with a period is not a heading.
  assert.deepEqual(contractBlocks("FICA CLARO QUE NADA MUDA."), [{ type: "paragraph", text: "FICA CLARO QUE NADA MUDA." }]);
});
