import assert from "node:assert/strict";
import test from "node:test";
import { invoiceDisplayStatus } from "../src/lib/invoice-table";

test("only unpaid issued invoices become overdue after their civil due date", () => {
  assert.equal(
    invoiceDisplayStatus(
      { status: "issued", dueDate: "2026-09-18" },
      "2026-09-19",
    ),
    "overdue",
  );
  assert.equal(
    invoiceDisplayStatus(
      { status: "issued", dueDate: "2026-09-19" },
      "2026-09-19",
    ),
    "issued",
  );
  assert.equal(
    invoiceDisplayStatus(
      { status: "issued", dueDate: "2026-09-20" },
      "2026-09-19",
    ),
    "issued",
  );
  for (const status of ["draft", "paid", "cancelled"] as const) {
    assert.equal(
      invoiceDisplayStatus({ status, dueDate: "2026-09-18" }, "2026-09-19"),
      status,
    );
  }
});
