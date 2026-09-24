import assert from "node:assert/strict";
import test from "node:test";
import { projectListHref, projectQuery } from "../src/lib/project-table";

test("project list defaults to active work and rejects malformed parameters", () => {
  assert.deepEqual(projectQuery({}), { status: "active", search: "", company: "" });
  assert.equal(projectQuery({ status: "completed" }).status, "completed");
  assert.equal(projectQuery({ status: "inventado" }).status, "active");
  assert.equal(projectQuery({ company: "abc" }).company, "");
  assert.equal(
    projectQuery({ company: "0352E874-BF22-4F3A-8590-CCE8170B86DC" }).company,
    "0352e874-bf22-4f3a-8590-cce8170b86dc",
  );
  assert.equal(projectQuery({ q: ` ${"a".repeat(200)} ` }).search.length, 160);
});

test("project list links keep only what differs from the defaults", () => {
  assert.equal(projectListHref({ status: "active", search: "", company: "" }), "/produtos");
  assert.equal(
    projectListHref({
      status: "all",
      search: "site",
      company: "0352e874-bf22-4f3a-8590-cce8170b86dc",
    }),
    "/produtos?status=all&company=0352e874-bf22-4f3a-8590-cce8170b86dc&q=site",
  );
});
