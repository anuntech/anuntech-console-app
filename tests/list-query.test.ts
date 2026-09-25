import assert from "node:assert/strict";
import test from "node:test";
import { clampPage, DEFAULT_PAGE_SIZE, listHref, offsetOf, pageCountOf, pageQuery, setPageParams } from "../src/lib/list-query";

test("page and size come from the URL, with safe defaults", () => {
  assert.deepEqual(pageQuery({}), { page: 1, pageSize: DEFAULT_PAGE_SIZE });
  assert.deepEqual(pageQuery({ page: "3", size: "50" }), { page: 3, pageSize: 50 });
  assert.deepEqual(pageQuery({ page: "0", size: "7" }), { page: 1, pageSize: 25 });
  assert.deepEqual(pageQuery({ page: "-2", size: "abc" }), { page: 1, pageSize: 25 });
  assert.deepEqual(pageQuery({ page: ["2", "3"] }), { page: 1, pageSize: 25 });
  assert.deepEqual(pageQuery({ page: "1.5" }), { page: 1, pageSize: 25 });
});

test("defaults stay out of the URL", () => {
  assert.equal(listHref("/contratos", setPageParams(new URLSearchParams(), { page: 1, pageSize: 25 })), "/contratos");
  assert.equal(
    listHref("/contratos", setPageParams(new URLSearchParams({ q: "site" }), { page: 2, pageSize: 50 })),
    "/contratos?q=site&page=2&size=50",
  );
});

test("a page past the end falls back to the last page", () => {
  assert.equal(pageCountOf(0, 25), 1);
  assert.equal(pageCountOf(51, 25), 3);
  assert.deepEqual(clampPage({ page: 9, pageSize: 25, status: "all" }, 30), { page: 2, pageSize: 25, status: "all" });
  assert.equal(offsetOf({ page: 3, pageSize: 25 }), 50);
});
