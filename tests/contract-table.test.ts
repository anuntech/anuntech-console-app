import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  contractListHref,
  contractQuery,
  contractTerm,
  contractTermLabel,
} from "../src/lib/contract-table";

test("contract list accepts the derived situations and rejects the rest", () => {
  assert.deepEqual(contractQuery({}), { status: "all", search: "", company: "", page: 1, pageSize: 25 });
  assert.equal(contractQuery({ status: "expiring" }).status, "expiring");
  assert.equal(contractQuery({ status: "expired" }).status, "expired");
  assert.equal(contractQuery({ status: "vencido" }).status, "all");
  assert.equal(contractQuery({ company: "abc" }).company, "");
  assert.equal(contractListHref({ status: "expiring", search: "", company: "" }), "/contratos?status=expiring");
});

test("a contract is expiring inside the warning window and expired after the end date", () => {
  const today = "2026-09-24";
  assert.deepEqual(contractTerm({ startsAt: null, endsAt: null }, today), { state: "none" });
  assert.deepEqual(contractTerm({ startsAt: "2026-01-01", endsAt: "2027-09-01" }, today), {
    state: "active",
    days: 342,
  });
  assert.deepEqual(contractTerm({ startsAt: null, endsAt: "2026-10-24" }, today), { state: "expiring", days: 30 });
  assert.deepEqual(contractTerm({ startsAt: null, endsAt: "2026-10-25" }, today), { state: "active", days: 31 });
  assert.deepEqual(contractTerm({ startsAt: null, endsAt: today }, today), { state: "expiring", days: 0 });
  assert.deepEqual(contractTerm({ startsAt: null, endsAt: "2026-09-21" }, today), { state: "expired", days: -3 });
  assert.deepEqual(contractTerm({ startsAt: "2026-10-01", endsAt: "2027-09-30" }, today), {
    state: "upcoming",
    days: 7,
  });
  // Ending soon outranks starting soon.
  assert.deepEqual(contractTerm({ startsAt: "2026-10-01", endsAt: "2026-10-12" }, today), {
    state: "expiring",
    days: 18,
  });
});

test("term labels read naturally around today", () => {
  assert.equal(contractTermLabel({ state: "expiring", days: 0 }), "Vence hoje");
  assert.equal(contractTermLabel({ state: "expiring", days: 1 }), "Vence amanhã");
  assert.equal(contractTermLabel({ state: "expiring", days: 12 }), "Vence em 12 dias");
  assert.equal(contractTermLabel({ state: "expired", days: -1 }), "Venceu ontem");
  assert.equal(contractTermLabel({ state: "expired", days: -40 }), "Vencido há 40 dias");
  assert.equal(contractTermLabel({ state: "active", days: 200 }), null);
  assert.equal(contractTermLabel({ state: "none" }), null);
});

test("day arithmetic stays on civil dates across month ends", () => {
  assert.equal(addDays("2026-09-24", 30), "2026-10-24");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});
