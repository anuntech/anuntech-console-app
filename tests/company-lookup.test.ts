import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCnpj,
  normalizeCep,
  mergeLookupFields,
} from "../src/lib/companies/company-lookup";
const cnpj = "12345678000199";
const company = {
  razao_social: "Empresa Teste",
  socios: [{ segredo: "omitido" }],
  estabelecimento: {
    cnpj,
    tipo_logradouro: "Rua",
    logradouro: "Teste",
    numero: "34",
    complemento: "Sala 4",
    bairro: "Centro",
    cep: "07700-665",
    email: "publico@example.com",
    estado: { sigla: "SP" },
    cidade: { nome: "Caieiras", ibge_id: 3509007 },
  },
};
const address = {
  cep: "01001-000",
  logradouro: "Praça da Sé",
  bairro: "Sé",
  localidade: "São Paulo",
  uf: "SP",
  ibge: "3550308",
  complemento: "lado ímpar",
};
test("CNPJ retorna somente identificação e endereço normalizados", () => {
  assert.deepEqual(normalizeCnpj(company, cnpj), {
    name: "Empresa Teste",
    endereco: "Rua Teste",
    numero: "34",
    complemento: "Sala 4",
    bairro: "Centro",
    cep: "07700665",
    uf: "SP",
    cidade: "Caieiras",
    codigoMunicipio: "3509007",
  });
  assert.throws(() => normalizeCnpj(company, "00000000000000"));
});
test("CEP não substitui número ou complemento do cliente", () => {
  const fields = normalizeCep(address, "01001000");
  assert.equal(fields.complemento, undefined);
  assert.equal(fields.numero, undefined);
  assert.equal(fields.codigoMunicipio, "3550308");
  assert.throws(() => normalizeCep(address, "07700665"));
  assert.throws(() => normalizeCep({ erro: true }, "01001000"));
});
test("CEP geral preserva rua e bairro manuais", () => {
  const fields = normalizeCep(
    { ...address, logradouro: "", bairro: "" },
    "01001000",
  );
  const merged = mergeLookupFields(
    {
      endereco: "Rua manual",
      bairro: "Bairro manual",
      numero: "10",
      complemento: "Sala 2",
    },
    fields,
    {},
    {},
  );
  assert.equal(merged.endereco, "Rua manual");
  assert.equal(merged.bairro, "Bairro manual");
  assert.equal(merged.numero, "10");
  assert.equal(merged.complemento, "Sala 2");
});
test("Resposta atrasada preserva edições, inclusive valor editado e restaurado", () => {
  const merged = mergeLookupFields(
    { endereco: "Original", cidade: "Manual", uf: "" },
    { endereco: "API", cidade: "API", uf: "SP" },
    { endereco: 1 },
    { endereco: 3, cidade: 1 },
  );
  assert.deepEqual(merged, {
    endereco: "Original",
    cidade: "Manual",
    uf: "SP",
  });
});
