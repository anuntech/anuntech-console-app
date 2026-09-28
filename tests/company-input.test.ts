import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDocument,
  formatPhone,
  companyIdentity,
  companyPhone,
  companyEmail,
} from "../src/lib/companies/company-input";
test("Máscaras preservam CPF, CNPJ e telefone fixo/celular", () => {
  assert.equal(formatDocument("43619917000181"), "43.619.917/0001-81");
  assert.equal(formatDocument("12345678901"), "123.456.789-01");
  assert.equal(formatPhone("11999991234"), "(11) 99999-1234");
  assert.equal(formatPhone("1133334444"), "(11) 3333-4444");
  assert.equal(formatPhone("+55 (11) 99999-1234"), "(11) 99999-1234");
});
test("Telefone obrigatório no servidor e e-mail normalizado", () => {
  for (const value of ["", "11999", "00123456789"])
    assert.equal(companyPhone.safeParse(value).success, false);
  assert.equal(companyPhone.parse("+55 (11) 99999-1234"), "11999991234");
  assert.equal(
    companyEmail.parse(" Financeiro@Example.COM "),
    "financeiro@example.com",
  );
  assert.equal(companyEmail.safeParse("a b@example.com").success, false);
  const parsed = companyIdentity.parse({
    name: " Exemplo ",
    document: "43.619.917/0001-81",
    billingEmail: " CONTATO@EXAMPLE.COM ",
    phone: "(11) 3333-4444",
    admin: true,
  });
  assert.deepEqual(parsed, {
    name: "Exemplo",
    document: "43619917000181",
    billingEmail: "contato@example.com",
    phone: "1133334444",
  });
});
