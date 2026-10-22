import assert from "node:assert/strict";
import test from "node:test";
import {
  companyDisplayName,
  companyNameInitials,
  readableCase,
  stripLegalSuffix,
  stripMeiNumbers,
} from "../src/lib/companies/display-name";

const MEI = "46.301.732 ALINE DE SOUZA BEZERRA";
const MEI_CNPJ = "46301732000112";

test("MEI: a raiz do CNPJ sai do nome só quando é a raiz do próprio CNPJ", () => {
  assert.equal(stripMeiNumbers(MEI, MEI_CNPJ), "ALINE DE SOUZA BEZERRA");
  assert.equal(stripMeiNumbers(MEI, "46.301.732/0001-12"), "ALINE DE SOUZA BEZERRA");
  assert.equal(stripMeiNumbers("46301732 - ALINE DE SOUZA BEZERRA", MEI_CNPJ), "ALINE DE SOUZA BEZERRA");
  // Another company's root, no document, or a CPF: the name stays whole.
  assert.equal(stripMeiNumbers(MEI, "28114567000190"), MEI);
  assert.equal(stripMeiNumbers(MEI, null), MEI);
  assert.equal(stripMeiNumbers(MEI, "39053344705"), MEI);
  // Older MEIs carry the owner's CPF at the end.
  assert.equal(stripMeiNumbers("ALINE DE SOUZA BEZERRA 123.456.789-01", MEI_CNPJ), "ALINE DE SOUZA BEZERRA");
  // A name made only of the root is not erased.
  assert.equal(stripMeiNumbers("46.301.732", MEI_CNPJ), "46.301.732");
});

test("Sufixo de natureza jurídica sai do nome de tela", () => {
  assert.equal(stripLegalSuffix("CLINICA VIDA PLENA LTDA"), "CLINICA VIDA PLENA");
  assert.equal(stripLegalSuffix("PADARIA BOM GRAO ME"), "PADARIA BOM GRAO");
  assert.equal(stripLegalSuffix("PADARIA BOM GRAO LTDA - ME"), "PADARIA BOM GRAO");
  assert.equal(stripLegalSuffix("Anuntech Tecnologia Ltda."), "Anuntech Tecnologia");
  assert.equal(stripLegalSuffix("ACME S.A."), "ACME");
  assert.equal(stripLegalSuffix("ACME S/A"), "ACME");
  assert.equal(stripLegalSuffix("SOLUCOES EIRELI"), "SOLUCOES");
  // Only a whole trailing word counts, and the name never disappears.
  assert.equal(stripLegalSuffix("CASA"), "CASA");
  assert.equal(stripLegalSuffix("ME"), "ME");
});

test("Caixa alta do registro vira caixa normal; nome digitado fica como está", () => {
  assert.equal(readableCase("ALINE DE SOUZA BEZERRA"), "Aline de Souza Bezerra");
  assert.equal(readableCase("ASSOCIACAO DOS PRODUTORES E AGRICULTORES"), "Associacao dos Produtores e Agricultores");
  assert.equal(readableCase("DA VINCI ARQUITETURA"), "Da Vinci Arquitetura");
  assert.equal(readableCase("AUTO-PEÇAS D'ÁVILA"), "Auto-Peças D'Ávila");
  assert.equal(readableCase("BRF COMERCIO SP III"), "BRF Comercio SP III");
  assert.equal(readableCase("Anuntech Tecnologia"), "Anuntech Tecnologia");
  assert.equal(readableCase("iFood Parceiros"), "iFood Parceiros");
});

test("Nome de tela junta as três regras e guarda o sufixo quando pedido", () => {
  assert.equal(companyDisplayName(MEI, MEI_CNPJ), "Aline de Souza Bezerra");
  assert.equal(companyDisplayName("CLINICA VIDA PLENA LTDA", "28114567000190"), "Clinica Vida Plena");
  assert.equal(companyDisplayName("CLINICA VIDA PLENA LTDA", "28114567000190", { keepSuffix: true }), "Clinica Vida Plena Ltda");
  assert.equal(companyDisplayName("MARCOS VINICIUS ANDRADE", "39053344705"), "Marcos Vinicius Andrade");
  assert.equal(companyDisplayName("  Escola   Pequeno Saber  ", undefined), "Escola Pequeno Saber");
  assert.equal(companyDisplayName("", undefined), "");
});

test("Iniciais ignoram números e palavras de ligação", () => {
  assert.equal(companyNameInitials(MEI), "AS");
  assert.equal(companyNameInitials("CLINICA VIDA PLENA LTDA"), "CV");
  assert.equal(companyNameInitials("Casa da Moeda"), "CM");
  assert.equal(companyNameInitials("123 456"), "14");
  assert.equal(companyNameInitials(""), "•");
});
