import assert from "node:assert/strict";
import test from "node:test";
import {
  hoursLabel,
  quoteContentSchema,
  quoteExpired,
  quoteListHref,
  quoteNumberLabel,
  quoteQuery,
  quoteTotals,
  quoteValidity,
  quoteValidityLabel,
  taskCode,
} from "../src/lib/quote-model";

const phase = (hoursMin: number, hoursMax: number, tasks: number) => ({
  name: "Fase",
  description: "",
  hoursMin,
  hoursMax,
  tasks: Array.from({ length: tasks }, (_, i) => ({ title: `Tarefa ${i + 1}`, description: "" })),
});

test("the proposal prices the top of the estimate and splits the up-front share", () => {
  // Kauan's example: six phases, 48–60h, R$ 40/h, 50% up front.
  const totals = quoteTotals({
    phases: [phase(8, 9, 5), phase(8, 9, 5), phase(10, 10, 5), phase(7, 9, 5), phase(8, 12, 6), phase(7, 11, 6)],
    hourlyRateCents: 4000,
    upfrontPercent: 50,
  });
  assert.deepEqual(totals, {
    hoursMin: 48,
    hoursMax: 60,
    phases: 6,
    tasks: 32,
    totalCents: 240000,
    upfrontCents: 120000,
    balanceCents: 120000,
  });
});

test("an uneven split rounds the up-front share and keeps the balance exact", () => {
  const totals = quoteTotals({ phases: [phase(1, 3, 0)], hourlyRateCents: 3333, upfrontPercent: 30 });
  assert.equal(totals.totalCents, 9999);
  assert.equal(totals.upfrontCents, 3000);
  assert.equal(totals.balanceCents, 6999);
});

test("labels read like the proposal", () => {
  assert.equal(hoursLabel(48, 60), "48–60h");
  assert.equal(hoursLabel(10, 10), "10h");
  assert.equal(quoteNumberLabel(2026, 7), "2026-007");
  assert.equal(taskCode(4, 0), "P5-01");
});

test("validity counts to the date and only a waiting proposal expires", () => {
  assert.deepEqual(quoteValidity(null, "2026-09-24"), { state: "none" });
  assert.deepEqual(quoteValidity("2026-10-06", "2026-09-24"), { state: "open", days: 12 });
  assert.equal(quoteValidityLabel(quoteValidity("2026-10-06", "2026-09-24")), "Válido por 12 dias");
  assert.equal(quoteValidityLabel(quoteValidity("2026-09-24", "2026-09-24")), "Válido até hoje");
  assert.equal(quoteValidityLabel(quoteValidity("2026-09-21", "2026-09-24")), "Expirou há 3 dias");
  assert.equal(quoteExpired("sent", "2026-09-21", "2026-09-24"), true);
  assert.equal(quoteExpired("accepted", "2026-09-21", "2026-09-24"), false);
  assert.equal(quoteExpired("sent", null, "2026-09-24"), false);
});

test("the content schema rejects a phase whose range is reversed", () => {
  const ok = quoteContentSchema.safeParse({
    summary: "Resumo",
    stack: ["Next.js"],
    phases: [phase(8, 9, 1)],
    hourlyRateCents: 4000,
    upfrontPercent: 50,
    notes: "",
  });
  assert.equal(ok.success, true);
  const reversed = quoteContentSchema.safeParse({
    phases: [phase(9, 8, 1)],
    hourlyRateCents: 4000,
    upfrontPercent: 50,
  });
  assert.equal(reversed.success, false);
});

test("the list query keeps only known situations and builds the same URL back", () => {
  assert.deepEqual(quoteQuery({}), { status: "all", search: "", company: "" });
  assert.equal(quoteQuery({ status: "bogus" }).status, "all");
  const query = quoteQuery({ status: "expired", q: " site ", company: "8E5A6C7B-1C2D-4E3F-8A9B-0C1D2E3F4A5B" });
  assert.equal(quoteListHref(query), "/orcamentos?status=expired&company=8e5a6c7b-1c2d-4e3f-8a9b-0c1d2e3f4a5b&q=site");
  assert.equal(quoteListHref(quoteQuery({})), "/orcamentos");
});
