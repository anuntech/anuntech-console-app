import test from "node:test";
import assert from "node:assert/strict";
import {
  brazilDateToISO,
  isoToBrazilDate,
  saoPauloDate,
} from "../src/lib/dates";

test("Vencimento brasileiro preserva o dia e rejeita datas impossíveis", () => {
  assert.equal(brazilDateToISO("30/09/2026"), "2026-09-30");
  assert.equal(isoToBrazilDate("2026-09-30"), "30/09/2026");
  assert.equal(brazilDateToISO("29/02/2028"), "2028-02-29");
  for (const value of [
    "29/02/2026",
    "31/04/2026",
    "12/31/2026",
    "00/09/2026",
    "__/09/2026",
    "",
  ])
    assert.equal(brazilDateToISO(value), "");
});
test("Hoje muda à meia-noite de São Paulo, independentemente do fuso do servidor", () => {
  assert.equal(saoPauloDate(new Date("2026-09-19T02:59:59Z")), "2026-09-18");
  assert.equal(saoPauloDate(new Date("2026-09-19T03:00:00Z")), "2026-09-19");
});
