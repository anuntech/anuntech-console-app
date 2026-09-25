import assert from "node:assert/strict";
import test from "node:test";
import {
  invoicePeriodRange,
  invoiceDisplayStatus,
  invoiceQuery,
  invoiceListHref,
} from "../src/lib/invoice-table";

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

test("pagination rejects malformed query parameters and limits page size", () => {
  for (const page of [
    "-1",
    "1.5",
    "Infinity",
    "9007199254740992",
    ["1", "2"],
  ]) {
    const query = invoiceQuery({
      page,
      size: "100000",
      status: "unknown",
      q: "  Parcela 1  ",
      company: "not-a-uuid",
    });
    assert.equal(query.page, 1);
    assert.equal(query.pageSize, 25);
    assert.equal(query.status, "all");
    assert.equal(query.search, "Parcela 1");
    assert.equal(query.company, "");
  }
  assert.equal(
    invoiceQuery({ company: "0352E874-BF22-4F3A-8590-CCE8170B86DC" }).company,
    "0352e874-bf22-4f3a-8590-cce8170b86dc",
  );
});
test("pagination links preserve search, status and company without injecting URL parameters", () => {
  const input = {
    status: "paid" as const,
    search: "Cliente & page=99",
    company: "0352e874-bf22-4f3a-8590-cce8170b86dc",
    period: "custom" as const,
    from: "2026-09-01",
    to: "2026-09-30",
    page: 2,
    pageSize: 25,
  };
  const url = new URL(invoiceListHref(input), "https://console.anuntech.com");
  assert.deepEqual(invoiceQuery(Object.fromEntries(url.searchParams)), input);
  assert.equal(
    invoiceListHref({
      ...input,
      status: "all",
      search: "",
      company: "",
      period: "all",
      from: "",
      to: "",
      page: 1,
      pageSize: 25,
    }),
    "/financeiro",
  );
});

test("invoice period presets resolve to due-date windows", () => {
  const today = "2026-09-24";
  assert.deepEqual(invoicePeriodRange({ period: "this_month", from: "", to: "" }, today), {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  assert.deepEqual(invoicePeriodRange({ period: "last_month", from: "", to: "" }, today), {
    from: "2026-08-01",
    to: "2026-08-31",
  });
  assert.deepEqual(invoicePeriodRange({ period: "next_30", from: "", to: "" }, today), {
    from: "2026-09-24",
    to: "2026-10-24",
  });
  assert.deepEqual(invoicePeriodRange({ period: "last_month", from: "", to: "" }, "2026-01-15"), {
    from: "2025-12-01",
    to: "2025-12-31",
  });
  assert.deepEqual(
    invoicePeriodRange({ period: "custom", from: "2026-03-01", to: "" }, today),
    { from: "2026-03-01", to: null },
  );
  assert.deepEqual(invoicePeriodRange({ period: "all", from: "", to: "" }, today), {
    from: null,
    to: null,
  });
});
