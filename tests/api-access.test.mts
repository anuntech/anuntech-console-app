// Run with: node --experimental-test-module-mocks --import tsx --test tests/api-access.test.mts
// (server-only is mocked: the router pulls next/navigation, which needs the full React).
// Every procedure of the app's API checks who is calling before it runs, and
// every input goes through a schema. A procedure written without guard() or
// without .input() turns this red.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { isProcedure } from "@orpc/server";

mock.module("server-only", { namedExports: {} });
const { router } = await import("../src/lib/api/router");
const { contract } = await import("../src/lib/api/contract");
const { isGuard } = await import("../src/lib/api/access");

type Tree = { [key: string]: unknown };
function leaves(tree: Tree, path: string[] = []): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    isProcedure(value) || (value as { "~orpc"?: unknown })?.["~orpc"]
      ? [[[...path, key].join("."), value] as [string, unknown]]
      : leaves(value as Tree, [...path, key]),
  );
}
type Def = { middlewares: readonly unknown[]; inputSchema?: unknown; outputSchema?: unknown };
const def = (value: unknown) => (value as { "~orpc": Def })["~orpc"];

const procedures = leaves(router as unknown as Tree);
const declared = leaves(contract as unknown as Tree);

test("the router implements exactly the contract", () => {
  assert.deepEqual(
    procedures.map(([path]) => path).sort(),
    declared.map(([path]) => path).sort(),
  );
  assert.ok(procedures.length > 0);
});

test("every procedure runs guard() first", () => {
  for (const [path, procedure] of procedures) {
    const [first] = def(procedure).middlewares;
    assert.ok(isGuard(first), `${path} precisa começar com guard({ ... })`);
  }
});

test("every input and output has a schema", () => {
  for (const [path, procedure] of procedures) {
    assert.ok(def(procedure).inputSchema, `${path} precisa de .input(z...) no contrato`);
    assert.ok(def(procedure).outputSchema, `${path} precisa de .output(z...) no contrato`);
  }
});

test("the contract has no server code", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/lib/api/contract.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["@orpc/contract", "zod"]);
});
