import test from "node:test";
import assert from "node:assert/strict";
import {
  billingSendTime,
  brazilDateToISO,
  isoToBrazilDate,
  saoPauloDate,
  saoPauloTime,
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

test("Horário de São Paulo respeita o fuso da data, inclusive horário de verão antigo", () => {
  assert.equal(
    saoPauloTime("2026-09-23", 8).toISOString(),
    "2026-09-23T11:00:00.000Z",
  );
  // Dezembro de 2018 ainda tinha horário de verão (UTC-2).
  assert.equal(
    saoPauloTime("2018-12-01", 8).toISOString(),
    "2018-12-01T10:00:00.000Z",
  );
});

test("Avisos automáticos da madrugada esperam as 8h de São Paulo", () => {
  const at = (iso: string) => billingSendTime(new Date(iso)).toISOString();
  // 00:05 e 07:59 em São Paulo aguardam as 08:00 do mesmo dia.
  assert.equal(at("2026-09-23T03:05:00Z"), "2026-09-23T11:00:00.000Z");
  assert.equal(at("2026-09-23T10:59:59Z"), "2026-09-23T11:00:00.000Z");
  // A partir das 08:00 o envio é imediato, inclusive à noite.
  assert.equal(at("2026-09-23T11:00:00Z"), "2026-09-23T11:00:00.000Z");
  assert.equal(at("2026-09-23T20:00:00Z"), "2026-09-23T20:00:00.000Z");
  assert.equal(at("2026-09-24T02:30:00Z"), "2026-09-24T02:30:00.000Z");
});
