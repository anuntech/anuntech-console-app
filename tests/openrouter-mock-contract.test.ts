import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isStepCount, jsonSchema, streamText, tool } from "ai";
import { chatModel, parsesLikeProvider, providerFailure, roundState } from "../src/lib/assistant/openrouter-chat";

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

test("a call whose arguments stream last still runs in the model's order", async () => {
  const ran: string[] = [];
  const record = (name: string) =>
    tool({
      description: name,
      inputSchema: jsonSchema({ type: "object" }),
      execute: async () => {
        ran.push(name);
        return "[]";
      },
    });
  const b = "00000000-0000-4000-8000-00000000000b";
  await read(
    streamText({
      ...quiet,
      model: model(),
      messages: [{ role: "user", content: `sem argumentos primeiro empresa ${b}` }],
      tools: { listar_chamados: record("listar_chamados"), ler_empresa: record("ler_empresa") },
    }),
  );
  // Without the reordering the provider hands over ler_empresa first: its arguments parse first.
  assert.deepEqual(ran, ["listar_chamados", "ler_empresa"]);
});

test("a call whose arguments never became JSON is flagged instead of running with none", async () => {
  const round = roundState();
  const { malformed } = round;
  let input: unknown;
  const result = streamText({
    ...quiet,
    model: chatModel("anthropic/claude-sonnet-5", false, round),
    messages: [{ role: "user", content: "argumento quebrado" }],
    tools: {
      listar_faturas: tool({
        description: "Faturas",
        inputSchema: jsonSchema({ type: "object" }),
        execute: async (value: unknown) => {
          input = value;
          return "[]";
        },
      }),
    },
  });
  await read(result);
  const [call] = (await result.steps)[0].toolCalls;
  // The provider still sends {}; the flag is what lets the turn refuse it.
  assert.deepEqual(input, {});
  assert.deepEqual([...malformed], [call.toolCallId]);
});

test("a round cut by the output limit leaves its call unrun", async () => {
  let ran = false;
  const result = streamText({
    ...quiet,
    model: model(),
    messages: [{ role: "user", content: "corta no limite" }],
    tools: { listar_faturas: tool({ description: "Faturas", inputSchema: jsonSchema({ type: "object" }), execute: async () => ((ran = true), "[]") }) },
    stopWhen: isStepCount(3),
  });
  await read(result);
  const steps = await result.steps;
  // converse treats this round as no answer and asks again without it.
  assert.equal(ran, false);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].finishReason, "length");
  assert.equal(steps[0].toolCalls.length, 1);
});

/** Tools that only record what ran, in which order, and whether the turn would refuse the call. */
function recorder(round = roundState()) {
  const { malformed } = round;
  const ran: { name: string; input: unknown; flagged: boolean }[] = [];
  const make = (name: string) =>
    tool({
      description: name,
      inputSchema: jsonSchema({ type: "object" }),
      execute: async (input: unknown, { toolCallId }) => {
        ran.push({ name, input, flagged: malformed.has(toolCallId) });
        return "[]";
      },
    });
  return { ran, round, tools: { listar_chamados: make("listar_chamados"), ler_empresa: make("ler_empresa"), buscar_ajuda: make("buscar_ajuda"), listar_faturas: make("listar_faturas") } };
}
const B = "00000000-0000-4000-8000-00000000000b";

test("calls without an id keep the model's order", async () => {
  const r = recorder();
  await read(streamText({ ...quiet, model: chatModel("m", false, r.round), messages: [{ role: "user", content: `sem id primeiro empresa ${B}` }], tools: r.tools }));
  assert.deepEqual(r.ran.map((c) => c.name), ["listar_chamados", "ler_empresa"]);
});

test("calls that repeat an id keep the model's order", async () => {
  const r = recorder();
  await read(streamText({ ...quiet, model: chatModel("m", false, r.round), messages: [{ role: "user", content: `id repetido empresa ${B}` }], tools: r.tools }));
  assert.deepEqual(r.ran.map((c) => c.name), ["listar_chamados", "ler_empresa", "buscar_ajuda"]);
});

test("a malformed call is refused in its own round only, even when the next round reuses its id", async () => {
  const r = recorder();
  await read(
    streamText({ ...quiet, model: chatModel("m", false, r.round), messages: [{ role: "user", content: "mesmo id" }], tools: r.tools, stopWhen: isStepCount(4) }),
  );
  assert.deepEqual(
    r.ran.map((c) => [c.input, c.flagged]),
    [
      [{}, true],
      [{ limite: 1 }, false],
    ],
  );
});

const order = async (content: string) => {
  const r = recorder();
  await read(streamText({ ...quiet, model: chatModel("m", false, r.round), messages: [{ role: "user", content: `${content} empresa ${B}` }], tools: r.tools }));
  return r.ran;
};

test("a call complete in its first piece waits for the call written before it", async () => {
  assert.deepEqual((await order("inteira depois")).map((c) => c.name), ["listar_chamados", "ler_empresa"]);
});

test("calls the provider finishes only at the end keep the model's order", async () => {
  assert.deepEqual((await order("duas no fim")).map((c) => c.name), ["listar_chamados", "buscar_ajuda", "ler_empresa"]);
});

test("several complete calls in one piece keep the model's order", async () => {
  assert.deepEqual((await order("todas juntas")).map((c) => c.name), ["listar_chamados", "ler_empresa", "buscar_ajuda"]);
});

test("arguments the provider will not parse keep the order and are refused", async () => {
  const ran = await order("proto primeiro");
  assert.deepEqual(
    ran.map((c) => [c.name, c.input, c.flagged]),
    [
      ["listar_chamados", {}, true],
      ["ler_empresa", { companyId: B }, false],
    ],
  );
  assert.equal(parsesLikeProvider('{"__proto__":{"x":1}}'), false);
  assert.equal(parsesLikeProvider('{"a":{"constructor":{"prototype":{}}}}'), false);
  assert.equal(parsesLikeProvider('{"constructor":"x","limite":1}'), true);
});

test("a call cut by the output limit before it was handed over is reported", async () => {
  for (const content of ["corte no meio", "corte depois do nome"]) {
    const r = recorder();
    const result = streamText({ ...quiet, model: chatModel("m", false, r.round), messages: [{ role: "user", content }], tools: r.tools });
    await read(result);
    const [step] = await result.steps;
    // No call reaches the SDK at all, so only the middleware knows the round was cut.
    assert.equal(step.finishReason, "length", content);
    assert.equal(step.toolCalls.length, 0, content);
    assert.equal(r.round.unfinished, true, content);
    assert.equal(r.ran.length, 0, content);
  }
  const plain = recorder();
  await read(streamText({ ...quiet, model: chatModel("m", false, plain.round), messages: [{ role: "user", content: "oi" }], tools: plain.tools }));
  assert.equal(plain.round.unfinished, false);
});
