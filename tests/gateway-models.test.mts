// Run with: node --conditions=react-server --import tsx --test tests/gateway-models.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { gatewayModels, offeredModels, usableModel, type Raw } from "../src/lib/assistant/gateway-models";

const entry = (id: string, zdr?: string, extra: Partial<Raw> = {}): Raw => ({
  id,
  type: "language",
  tags: ["tool-use"],
  pricing: { input: "0.000003", output: "0.000015" },
  ...(zdr === undefined ? {} : { zdr }),
  ...extra,
});

test("only models with a provider that keeps nothing are offered, while the catalog says which", () => {
  const ids = offeredModels([
    entry("anthropic/claude-sonnet-5", "all", { tags: ["tool-use", "reasoning"] }),
    entry("google/gemini-3.8-flash", "some"),
    entry("cohere/command-a", "none"),
    entry("x/no-field"),
    entry("x/no-tools", "all", { tags: [] }),
    entry("x/image", "all", { type: "image" }),
    entry("~deepseek/alias", "all"),
  ]).map((m) => [m.id, m.reasoning, m.promptPerMillion]);
  assert.deepEqual(ids, [
    ["anthropic/claude-sonnet-5", true, 3],
    ["google/gemini-3.8-flash", false, 3],
  ]);
  // Without the field anywhere, nothing is filtered by it (the request itself still asks for zero retention).
  assert.deepEqual(offeredModels([entry("cohere/command-a"), entry("anthropic/claude-sonnet-5")]).map((m) => m.id), ["anthropic/claude-sonnet-5", "cohere/command-a"]);
});

test("requests that arrive while the catalog loads share one fetch, and a saved id the Gateway lacks falls back", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return Response.json({ data: [entry("anthropic/claude-sonnet-5", "all")] });
  }) as typeof fetch;
  try {
    const [a, b] = await Promise.all([gatewayModels(), gatewayModels()]);
    assert.equal(calls, 1);
    assert.equal(a, b);
    assert.equal(await usableModel("anthropic/claude-sonnet-5", "d/default"), "anthropic/claude-sonnet-5");
    assert.equal(await usableModel("cohere/command-a", "d/default"), "d/default");
    assert.equal(await usableModel("~deepseek/deepseek-flash-latest", "d/default"), "d/default");
    assert.equal(calls, 1, "the catalog is cached");
  } finally {
    globalThis.fetch = original;
  }
});
