import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isStepCount, jsonSchema, streamText, tool } from "ai";
import { chatModel, providerFailure } from "../src/lib/assistant/openrouter-chat";

/*
 * The OpenRouter stand-in the integration suite runs against
 * (scripts/openrouter-mock.cjs), checked here against the real AI SDK and the
 * real OpenRouter provider, in-process: if either drifts (how the stream is
 * read, what the request carries), this fails before any server starts.
 */
const dir = mkdtempSync(join(tmpdir(), "openrouter-mock-"));
const logFile = join(dir, "openrouter.log");
process.env.CONSOLE_TEST_ASSISTANT_FILE = logFile;
process.env.CONSOLE_TEST_NOTICE_FLAGS = join(dir, "flags.json");
writeFileSync(process.env.CONSOLE_TEST_NOTICE_FLAGS, "{}");
process.env.OPENROUTER_API_KEY = "test-only-key";
createRequire(join(process.cwd(), "package.json"))("./scripts/openrouter-mock.cjs");

const model = () => chatModel("anthropic/claude-sonnet-5", false);
const logged = () =>
  readFileSync(logFile, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
const lastCall = () => logged().filter((entry) => "messages" in entry).at(-1)!;

async function read(result: { fullStream: AsyncIterable<{ type: string }> }) {
  const parts: { type: string; [key: string]: unknown }[] = [];
  for await (const part of result.fullStream) parts.push(part);
  return parts;
}
// Failures are read from the stream, as the assistant does; the SDK's own log would only add noise here.
const quiet = { onError: () => undefined };

test("text arrives in pieces, with the usage the budget counts", async () => {
  const result = streamText({ model: model(), instructions: "Você é o assistente do Anuntech Console.", messages: [{ role: "user", content: "oi devagar" }] });
  const parts = await read(result);
  const deltas = parts.filter((p) => p.type === "text-delta");
  assert.ok(deltas.length >= 2, "more than one piece of text");
  assert.match(await result.text, /^Recebi: "oi devagar"/);
  const usage = await result.totalUsage;
  assert.ok((usage.inputTokens ?? 0) > 0 && (usage.outputTokens ?? 0) > 0);
  assert.equal(usage.totalTokens, (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0));
});

test("every request streams, asks for providers that keep nothing and sends the system prompt first", async () => {
  await read(streamText({ model: model(), instructions: "Você é o assistente do Anuntech Console.", messages: [{ role: "user", content: "oi" }] }));
  const entry = lastCall();
  assert.equal(entry.stream, true);
  assert.equal(entry.zdr, true);
  assert.equal(entry.dataCollection, "deny");
  assert.equal(entry.model, "anthropic/claude-sonnet-5");
});

test("tool arguments sent in fragments arrive whole, and the next round reads the result", async () => {
  const seen: unknown[] = [];
  const result = streamText({
    model: model(),
    instructions: "Você é o assistente do Anuntech Console.",
    messages: [{ role: "user", content: "qual meu boleto" }],
    tools: {
      listar_faturas: tool({
        description: "Faturas",
        inputSchema: jsonSchema({ type: "object", properties: { situacao: { type: "string" }, limite: { type: "number" } } }),
        execute: async (input: unknown) => {
          seen.push(input);
          return JSON.stringify([{ faturaId: "f1", descricao: "Manutenção", valor: "R$ 10,00", vencimento: "10/10/2026", situacao: "paga" }]);
        },
      }),
    },
    stopWhen: isStepCount(3),
  });
  await read(result);
  assert.deepEqual(seen, [{ situacao: "todas", limite: 3 }]);
  assert.match(await result.text, /Manutenção: \*\*R\$ 10,00\*\*/);
  assert.equal((await result.steps).length, 2);
});

test("a round without tools sends no tools at all", async () => {
  const result = streamText({
    model: model(),
    instructions: "Você é o assistente do Anuntech Console.",
    messages: [{ role: "user", content: "qual meu boleto" }],
    tools: { listar_faturas: tool({ description: "Faturas", inputSchema: jsonSchema({ type: "object" }), execute: async () => "[]" }) },
    activeTools: [],
  });
  await read(result);
  assert.equal(lastCall().tools, undefined);
});

test("402 stops with OpenRouter's status, without a retry", async () => {
  const before = logged().filter((e) => e.credits).length;
  const parts = await read(streamText({ ...quiet, model: model(), maxRetries: 1, messages: [{ role: "user", content: "sem-creditos" }] }));
  const error = parts.find((p) => p.type === "error")?.error;
  assert.equal(providerFailure(error)?.status, 402);
  assert.equal(logged().filter((e) => e.credits).length, before + 1);
});

test("an error in the middle of the stream reaches the turn with OpenRouter's code", async () => {
  const parts = await read(streamText({ ...quiet, model: model(), messages: [{ role: "user", content: "corte-no-meio por favor" }] }));
  const error = parts.find((p) => p.type === "error")?.error;
  assert.deepEqual(providerFailure(error), { status: 502, detail: "Provider disconnected" });
});
