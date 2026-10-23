import assert from "node:assert/strict";
import test from "node:test";
import { companyParam, customPeriod } from "../mobile/src/lib/list-filters";

test("a link's company counts only when it is an id", () => {
  assert.equal(companyParam("4F1C2D3E-1111-4222-8333-944455556666"), "4f1c2d3e-1111-4222-8333-944455556666");
  assert.equal(companyParam(""), "");
  assert.equal(companyParam(undefined), "");
  assert.equal(companyParam(["4f1c2d3e-1111-4222-8333-944455556666"]), "");
  assert.equal(companyParam("empresa"), "");
});

test("Personalizado sends only complete, real dates", () => {
  assert.deepEqual(customPeriod("", ""), { from: undefined, to: undefined, fromError: undefined, toError: undefined });
  assert.deepEqual(customPeriod("01/10/2026", "31/10/2026"), {
    from: "2026-10-01",
    to: "2026-10-31",
    fromError: undefined,
    toError: undefined,
  });
  // Still typing: no date yet, and no complaint.
  assert.deepEqual(customPeriod("01/1", ""), { from: undefined, to: undefined, fromError: undefined, toError: undefined });
  // Only one side: no limit on the other.
  assert.equal(customPeriod("", "15/11/2026").to, "2026-11-15");
  assert.equal(customPeriod("", "15/11/2026").from, undefined);
});

test("Personalizado says which date is wrong", () => {
  const wrong = customPeriod("31/02/2026", "");
  assert.equal(wrong.from, undefined);
  assert.equal(wrong.fromError, "Informe uma data válida.");
  const reversed = customPeriod("10/10/2026", "01/10/2026");
  assert.equal(reversed.toError, "Use uma data depois do início.");
  // Both still go, as on the web: the list is empty and the field says why.
  assert.equal(reversed.from, "2026-10-10");
  assert.equal(reversed.to, "2026-10-01");
});
