import assert from "node:assert/strict";
import test from "node:test";
import { billingProblemsLabel, billingReadiness } from "../src/lib/billing/billing-readiness";

const address = { endereco: "Rua A", numero: "10", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP", cep: "01001-000" };
const company = { name: "Cliente Ltda", document: "11222333000181", archived: false, billingAddress: address };

test("a complete record is ready to bill", () => {
  assert.deepEqual(billingReadiness(company), []);
});

test("the same checks as the publication, each named", () => {
  assert.deepEqual(billingReadiness({ ...company, billingAddress: null }), ["address"]);
  assert.deepEqual(billingReadiness({ ...company, billingAddress: { ...address, numero: "" } }), ["address"]);
  assert.deepEqual(billingReadiness({ ...company, billingAddress: { ...address, cep: "0100" } }), ["address"]);
  assert.deepEqual(billingReadiness({ ...company, document: "123" }), ["document"]);
  assert.deepEqual(billingReadiness({ ...company, name: "x".repeat(101) }), ["name"]);
  assert.deepEqual(billingReadiness({ ...company, archived: true, billingAddress: null }), ["archived", "address"]);
  assert.deepEqual(billingReadiness({ ...company, document: "12345678901" }), []);
});

test("problems read as one Portuguese sentence", () => {
  assert.equal(billingProblemsLabel(["address"]), "endereço de cobrança incompleto");
  assert.equal(billingProblemsLabel(["document", "address"]), "CPF ou CNPJ inválido e endereço de cobrança incompleto");
  assert.equal(billingProblemsLabel([]), "");
});
