import assert from "node:assert/strict";
import test from "node:test";
import {
  noticeDate,
  noticeIsCurrent,
  payableUntil,
  reminderKindFor,
  resolveBankDueDate,
} from "../src/lib/billing-notice-rules";

const today = "2026-09-24";

test("a past-due obligation needs a future date for the bank; a future one does not", () => {
  assert.deepEqual(resolveBankDueDate({ dueDate: "2026-10-09", bankDueDate: "", recurring: false }, today), {
    bankDueDate: null,
  });
  // A bank date typed for a future due date is ignored: the boleto is due on the due date itself.
  assert.deepEqual(resolveBankDueDate({ dueDate: "2026-10-09", bankDueDate: "2026-10-20", recurring: false }, today), {
    bankDueDate: null,
  });
  assert.deepEqual(resolveBankDueDate({ dueDate: "2026-08-09", bankDueDate: "2026-10-09", recurring: false }, today), {
    bankDueDate: "2026-10-09",
  });
  assert.ok("error" in resolveBankDueDate({ dueDate: "2026-08-09", bankDueDate: "", recurring: false }, today));
  assert.ok("error" in resolveBankDueDate({ dueDate: "2026-08-09", bankDueDate: today, recurring: false }, today));
  assert.ok("error" in resolveBankDueDate({ dueDate: today, bankDueDate: "", recurring: false }, today));
  assert.ok("error" in resolveBankDueDate({ dueDate: "2026-08-09", bankDueDate: "2026-10-09", recurring: true }, today));
});

test("notices judge the first notice and 'due today' by the payable date, arrears by the real one", () => {
  const migrated = { dueDate: "2026-08-09", bankDueDate: "2026-10-09" };
  const regular = { dueDate: "2026-09-24", bankDueDate: null };
  assert.equal(payableUntil(migrated), "2026-10-09");
  assert.equal(payableUntil(regular), "2026-09-24");
  assert.equal(noticeDate("initial", migrated), "2026-10-09");
  assert.equal(noticeDate("due", migrated), "2026-10-09");
  assert.equal(noticeDate("overdue_5", migrated), "2026-08-09");
  // The first notice of a migrated debt is still current while the boleto can be paid.
  assert.equal(noticeIsCurrent("initial", noticeDate("initial", migrated), today), true);
  assert.equal(noticeIsCurrent("initial", migrated.dueDate, today), false);
});

test("reminders: 'due' on the payable date, arrears from the real due date, nothing after 30 days", () => {
  assert.equal(reminderKindFor({ dueDate: "2026-09-24", bankDueDate: null }, today), "due");
  assert.equal(reminderKindFor({ dueDate: "2026-09-19", bankDueDate: null }, today), "overdue_5");
  assert.equal(reminderKindFor({ dueDate: "2026-08-09", bankDueDate: "2026-10-09" }, today), null);
  assert.equal(reminderKindFor({ dueDate: "2026-08-09", bankDueDate: "2026-10-09" }, "2026-10-09"), "due");
  assert.equal(reminderKindFor({ dueDate: "2026-09-14", bankDueDate: "2026-10-09" }, today), "overdue_10");
  // The real due date today, but a later boleto: no "due today" until the boleto's day.
  assert.equal(reminderKindFor({ dueDate: today, bankDueDate: "2026-10-09" }, today), null);
});
