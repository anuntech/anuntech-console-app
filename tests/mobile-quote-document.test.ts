import assert from "node:assert/strict";
import test from "node:test";
import { documentLine, preparedLine, rateLine } from "../mobile/src/lib/quote-document";
import { currency, dateLabel, longDateLabel } from "../src/lib/format";

const nbsp = (text: string) => text.replace(/\s/g, " ");

test("the proposal header names the company's document by its length", () => {
  assert.equal(documentLine("12345678000190"), "CNPJ 12.345.678/0001-90");
  assert.equal(documentLine("123.456.789-09"), "CPF 123.456.789-09");
  assert.equal(documentLine(""), null);
  assert.equal(documentLine(null), null);
  assert.equal(documentLine(undefined), null);
});

test("the total box reads hours times the rate, and the discount when there is one", () => {
  assert.equal(nbsp(rateLine(60, 15000, 0)), nbsp(`60h × ${currency(15000)}/h`));
  assert.equal(nbsp(rateLine(60, 15000, 90000)), nbsp(`60h × ${currency(15000)}/h, com ${currency(90000)} de desconto`));
});

test("the footer says when it was prepared and until when it holds, as the web", () => {
  const sent = "2026-10-23T02:30:00.000Z"; // still the 22nd in São Paulo
  assert.equal(
    preparedLine(sent, "2026-11-10"),
    `Proposta preparada pela Anuntech · ${dateLabel(new Date(sent))} · válida até ${longDateLabel("2026-11-10")}`,
  );
  assert.equal(preparedLine(sent, null), `Proposta preparada pela Anuntech · ${dateLabel(new Date(sent))}`);
  assert.match(preparedLine(sent, null), /22\/10\/2026$/);
});
