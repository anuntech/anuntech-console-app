import assert from "node:assert/strict";
import test from "node:test";
import { companyQuery, companyListHref } from "../src/lib/companies/company-table";

test("company list defaults to active and rejects malformed query parameters", () => {
  assert.deepEqual(companyQuery({}), {
    status: "active",
    search: "",
    page: 1,
    pageSize: 25,
  });
  assert.equal(companyQuery({ status: "archived" }).status, "archived");
  assert.equal(companyQuery({ status: "all" }).status, "all");
  assert.equal(companyQuery({ status: "inventado" }).status, "active");
  assert.equal(companyQuery({ status: ["all", "archived"] }).status, "active");
  assert.equal(companyQuery({ page: "-3" }).page, 1);
  assert.equal(companyQuery({ page: "abc" }).page, 1);
  assert.equal(companyQuery({ page: "1.5" }).page, 1);
  assert.equal(companyQuery({ page: "9007199254740993" }).page, 1);
  assert.equal(companyQuery({ size: "9999" }).pageSize, 25);
  assert.equal(companyQuery({ size: "50" }).pageSize, 50);
  assert.equal(companyQuery({ q: `  ${"a".repeat(200)}  ` }).search.length, 160);
});

test("company list links keep the filter and search without extra parameters", () => {
  assert.equal(
    companyListHref({ status: "active", search: "", page: 1, pageSize: 25 }),
    "/empresas",
  );
  assert.equal(
    companyListHref({
      status: "archived",
      search: "anun tech",
      page: 3,
      pageSize: 50,
    }),
    "/empresas?status=archived&q=anun+tech&page=3&size=50",
  );
  assert.equal(
    companyListHref({
      status: "active",
      search: "a&b=c",
      page: 1,
      pageSize: 25,
    }),
    "/empresas?q=a%26b%3Dc",
  );
});
