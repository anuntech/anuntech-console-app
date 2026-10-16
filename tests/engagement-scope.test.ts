import assert from "node:assert/strict";
import test from "node:test";
import { mergeScopes, scopeIncludes, scopeOfCompany, type ScopedMembership } from "../src/lib/access/engagement-scope";

const member = (companyId: string, engagementAccess: "all" | "selected", engagementIds: string[] = []): ScopedMembership => ({
  companyId,
  role: "member",
  engagementAccess,
  engagementIds,
});

test("a Membro sees everything by default, or only what was selected", () => {
  const scopes = mergeScopes([member("a", "all"), member("b", "selected", ["p1"])]);
  assert.equal(scopes.get("a"), "all");
  assert.ok(scopeIncludes(scopes.get("a"), "anything"));
  assert.ok(scopeIncludes(scopes.get("b"), "p1"));
  assert.ok(!scopeIncludes(scopes.get("b"), "p2"));
});

test("an empty selection shows nothing, never everything", () => {
  const scopes = mergeScopes([member("a", "selected", [])]);
  assert.notEqual(scopes.get("a"), "all");
  assert.ok(!scopeIncludes(scopes.get("a"), "p1"));
});

test("an Administrador sees everything, even with an old selection left on the row", () => {
  const scopes = mergeScopes([{ companyId: "a", role: "manager", engagementAccess: "selected", engagementIds: ["p1"] }]);
  assert.equal(scopes.get("a"), "all");
});

test("aliases in the same company: the widest wins, selections add up", () => {
  assert.equal(mergeScopes([member("a", "selected", ["p1"]), member("a", "all")]).get("a"), "all");
  assert.equal(mergeScopes([member("a", "all"), member("a", "selected", ["p1"])]).get("a"), "all");
  const union = mergeScopes([member("a", "selected", ["p1"]), member("a", "selected", ["p2"])]).get("a");
  assert.ok(scopeIncludes(union, "p1") && scopeIncludes(union, "p2") && !scopeIncludes(union, "p3"));
});

test("no grant for a company means no access", () => {
  assert.equal(scopeOfCompany([{ company: { id: "a" }, engagements: "all" }], "b"), undefined);
  assert.ok(!scopeIncludes(undefined, "p1"));
});
