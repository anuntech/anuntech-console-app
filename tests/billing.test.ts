import test from "node:test";
import assert from "node:assert/strict";
import {
  bankInvoiceStatus,
  payerAddress,
  bankReference,
  bankCharge,
} from "../src/lib/billing-rules";
test("Marcação manual e processamento no banco não comprovam pagamento", () => {
  for (const s of [
    "MARCADO_RECEBIDO",
    "EM_PROCESSAMENTO",
    "A_RECEBER",
    "ATRASADO",
  ])
    assert.equal(bankInvoiceStatus(s), "issued");
  assert.equal(bankInvoiceStatus("RECEBIDO"), "paid");
  assert.equal(bankInvoiceStatus("FALHA_EMISSAO"), "cancelled");
});
test("Endereço rejeita UF inválida, CEP incompleto e prazo fora do banco", () => {
  const valid = {
    endereco: "Rua Teste",
    numero: "10",
    bairro: "Centro",
    cidade: "São Paulo",
    cep: "01001-000",
    uf: "SP",
    numDiasAgenda: 30,
  };
  assert.equal(payerAddress.parse(valid).cep, "01001000");
  for (const patch of [{ uf: "XX" }, { cep: "123" }, { numDiasAgenda: 61 }])
    assert.equal(payerAddress.safeParse({ ...valid, ...patch }).success, false);
});
test("Referência estável e respostas incompletas não conciliam cobrança", () => {
  assert.equal(
    bankReference("12345678-1234-1234-1234-123456789012"),
    "123456781234123",
  );
  assert.equal(
    bankCharge.safeParse({ cobranca: { situacao: "RECEBIDO" } }).success,
    false,
  );
});
