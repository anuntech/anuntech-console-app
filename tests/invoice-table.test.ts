import assert from "node:assert/strict";
import test from "node:test";
import {
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
    });
    assert.equal(query.page, 1);
    assert.equal(query.pageSize, 10);
    assert.equal(query.status, "all");
    assert.equal(query.search, "Parcela 1");
  }
});
test("pagination links preserve search and status without injecting URL parameters", () => {
  const input = {
    status: "paid" as const,
    search: "Cliente & page=99",
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
      page: 1,
      pageSize: 10,
    }),
    "/financeiro",
  );
});
