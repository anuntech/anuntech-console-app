import test from "node:test";
import assert from "node:assert/strict";
import {
  hasPermission,
  isAdministrator,
  moneyToCents,
} from "../src/lib/permissions";
test("permissões separam atendimento e financeiro", () => {
  assert.equal(hasPermission("support", "finance"), false);
  assert.equal(hasPermission("finance", "support"), false);
  for (const area of ["overview", "support", "finance"] as const)
    assert.equal(hasPermission("manager", area), true);
  assert.equal(hasPermission("support", "support"), true);
  assert.equal(hasPermission("finance", "finance"), true);
});
test("admin exige endereço exato e verificado", () => {
  assert.equal(
    isAdministrator("owner@example.com", true, "OWNER@example.com"),
    true,
  );
  assert.equal(
    isAdministrator("owner@example.com", false, "owner@example.com"),
    false,
  );
  assert.equal(
    isAdministrator("another@example.com", true, "owner@example.com"),
    false,
  );
  assert.equal(isAdministrator("owner@example.com", true, undefined), false);
  assert.equal(
    isAdministrator("owner+alias@example.com", true, "owner@example.com"),
    false,
  );
});
test("dinheiro convertido sem arredondamento de ponto flutuante", () => {
  assert.equal(moneyToCents("0,29"), 29);
  assert.equal(moneyToCents("1500.50"), 150050);
  assert.equal(moneyToCents("10"), 1000);
  for (const bad of [
    "-5",
    "0",
    "1.005",
    "1.500,00",
    "Infinity",
    "1e5",
    "10000000",
    "abc",
  ])
    assert.equal(moneyToCents(bad), null);
});
