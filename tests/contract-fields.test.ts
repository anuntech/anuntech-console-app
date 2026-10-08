import assert from "node:assert/strict";
import test from "node:test";
import { applyContractFields, contractFields, fieldLabel, fieldRange, removeContractField } from "../src/lib/contracts/contract-fields";

const body = [
  "CLÁUSULA 1 — OBJETO",
  "Proposta {{numero_proposta}}, de {{ data_proposta }}, no valor de {{valor}}.",
  "1.2. Escopo funcional: {{escopo_funcional}}",
  "1.3. Valor total: {{valor}}, pago em parcelas.",
].join("\n");

test("open fields come in the order they first appear, with counts", () => {
  const fields = contractFields(body);
  assert.deepEqual(
    fields.map((f) => [f.key, f.count]),
    [["numero_proposta", 1], ["data_proposta", 1], ["valor", 2], ["escopo_funcional", 1]],
  );
});

test("each field shows where it sits in its own paragraph, other placeholders elided", () => {
  const [numero, , valor] = contractFields(body);
  assert.equal(numero.before, "Proposta ");
  assert.equal(numero.after, ", de …, no valor de ….");
  assert.equal(valor.before, "Proposta …, de …, no valor de ");
  assert.equal(valor.after, ".");
});

test("labels read like Portuguese and keep the Console's own", () => {
  assert.equal(fieldLabel("numero_proposta"), "Número proposta");
  assert.equal(fieldLabel("email_responsavel_cliente"), "E-mail responsável cliente");
  assert.equal(fieldLabel("criterios_de_aceite"), "Critérios de aceite");
  assert.equal(fieldLabel("valor"), "Valor do vínculo");
  assert.equal(contractFields("{{escopo_funcional}}")[0].long, true);
  assert.equal(contractFields("{{numero_proposta}}")[0].long, false);
});

test("applying fills every occurrence and leaves empty fields alone", () => {
  const result = applyContractFields(body, { valor: "R$ 31.900,00", numero_proposta: "  ", escopo_funcional: "Portal web" });
  assert.equal(result.applied, 2);
  assert.ok(!result.body.includes("{{valor}}"));
  assert.equal(result.body.split("R$ 31.900,00").length - 1, 2);
  assert.ok(result.body.includes("{{numero_proposta}}"));
  assert.ok(result.body.includes("Escopo funcional: Portal web"));
});

test("a value with $ or regex characters is written as is", () => {
  assert.equal(applyContractFields("Total {{valor}}.", { valor: "R$ 1.000,00 ($& $1)" }).body, "Total R$ 1.000,00 ($& $1).");
});

test("removing a field takes it and the space before it out", () => {
  assert.equal(removeContractField("Opção {{escolha_opcao_a_ou_b}}, conforme.", "escolha_opcao_a_ou_b"), "Opção, conforme.");
  assert.equal(removeContractField("{{fim}}", "fim"), "");
});

test("the first occurrence can be selected in the text", () => {
  const range = fieldRange(body, "valor");
  assert.ok(range);
  assert.equal(body.slice(range[0], range[1]), "{{valor}}");
  assert.equal(fieldRange(body, "nada"), null);
});
