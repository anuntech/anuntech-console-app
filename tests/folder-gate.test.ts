import { test } from "node:test";
import assert from "node:assert/strict";
import { gateOpen, gateViewerOf, type GateViewer } from "../src/lib/bookmarks/folder-gate";

const A = "company-a";
const viewer = (role: "manager" | "member", engagements: "all" | string[] = "all"): GateViewer =>
  gateViewerOf({ admin: false, grants: [{ company: { id: A }, role, engagements: engagements === "all" ? "all" : new Set(engagements) }] });

test("a folder without a gate follows only who sees it", () => {
  assert.ok(gateOpen(viewer("member"), { companyId: A }));
  assert.ok(gateOpen(viewer("member"), { companyId: null }));
});

test("contracts: only who sees the company's finance", () => {
  const contracts = { companyId: A, area: "finance" as const };
  assert.ok(gateOpen(viewer("manager"), contracts));
  assert.ok(!gateOpen(viewer("member"), contracts));
  assert.ok(!gateOpen(gateViewerOf({ admin: false, grants: [] }), contracts));
  assert.ok(gateOpen(gateViewerOf({ admin: true, grants: [] }), contracts));
});

test("a project's deliveries: only who sees that project", () => {
  const deliveries = { companyId: A, engagementId: "p1" };
  assert.ok(gateOpen(viewer("member"), deliveries));
  assert.ok(gateOpen(viewer("member", ["p1"]), deliveries));
  assert.ok(!gateOpen(viewer("member", ["p2"]), deliveries));
  assert.ok(!gateOpen(viewer("member", []), deliveries));
  // Another company's grant opens nothing here.
  assert.ok(!gateOpen(gateViewerOf({ admin: false, grants: [{ company: { id: "b" }, role: "manager", engagements: "all" }] }), deliveries));
});
