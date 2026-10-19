import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { experimental_decide as decide, gateway, generateImage, generateText, isStepCount, jsonSchema, simulateReadableStream, streamText, tool, transcribe, wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { chatModel, inModelOrder, parsesSecurely, privateModel, providerFailure, roundState } from "../src/lib/assistant/chat-model";
import { askJev, neededAreas } from "../src/lib/assistant/jev-ask";
import { encodeWav, transcriptionOptions } from "../src/lib/voice/voice-rules";

/*
 * The AI Gateway stand-in the integration suite runs against
 * (scripts/ai-gateway-mock.cjs), checked here against the real AI SDK and the
 * real Gateway provider, in-process: if either drifts (the protocol, how the
 * stream is read, what the request carries), this fails before any server
 * starts. The mock answers 400 to a request without the key or the protocol
 * version it expects, and 599 to any other AI host.
 */
const dir = mkdtempSync(join(tmpdir(), "ai-gateway-mock-"));
const logFile = join(dir, "ai.log");
process.env.CONSOLE_TEST_ASSISTANT_FILE = logFile;
process.env.CONSOLE_TEST_NOTICE_FLAGS = join(dir, "flags.json");
writeFileSync(process.env.CONSOLE_TEST_NOTICE_FLAGS, "{}");
// The key wins over OIDC, so nothing here ever reads a Vercel login.
process.env.AI_GATEWAY_API_KEY = "test-only-key";
delete process.env.VERCEL_OIDC_TOKEN;
createRequire(join(process.cwd(), "package.json"))("./scripts/ai-gateway-mock.cjs");

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

test("every chat request streams to the model asked for, only to providers that keep nothing", async () => {
  await read(streamText({ model: model(), instructions: "Você é o assistente do Anuntech Console.", messages: [{ role: "user", content: "oi" }] }));
  const entry = lastCall();
  assert.equal(entry.stream, true);
  assert.equal(entry.model, "anthropic/claude-sonnet-5");
  assert.equal(entry.zeroDataRetention, true);
  assert.equal(entry.disallowPromptTraining, true);
  assert.equal(entry.reasoning, null);
  // A thinking model gets the short budget, as a call option.
  await read(streamText({ model: chatModel("anthropic/claude-sonnet-5", true), messages: [{ role: "user", content: "oi" }] }));
  assert.equal(lastCall().reasoning, "low");
});

test("a single answer is private too, and no caller can turn that off", async () => {
  const result = await generateText({
    model: privateModel("anthropic/claude-sonnet-5", false),
    instructions: "Você escreve a próxima resposta da equipe da Anuntech num chamado de suporte.",
    prompt: "Empresa: Teste",
    providerOptions: { gateway: { zeroDataRetention: false, disallowPromptTraining: false } },
  });
  assert.match(result.text, /^Rascunho de teste/);
  const entry = logged().filter((e) => e.draft).at(-1)!;
  assert.equal(entry.zeroDataRetention, true);
  assert.equal(entry.disallowPromptTraining, true);
});

test("tool arguments sent in pieces arrive whole, and the next round reads the result", async () => {
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

test("402 stops with the Gateway's status, without a retry", async () => {
  const before = logged().filter((e) => e.credits).length;
  const parts = await read(streamText({ ...quiet, model: model(), maxRetries: 1, messages: [{ role: "user", content: "sem-creditos" }] }));
  const error = parts.find((p) => p.type === "error")?.error;
  assert.equal(providerFailure(error)?.status, 402);
  assert.equal(logged().filter((e) => e.credits).length, before + 1);
});

test("a model with no provider that keeps nothing is refused in words the person can act on", async () => {
  const parts = await read(streamText({ ...quiet, model: model(), maxRetries: 0, messages: [{ role: "user", content: "sem-zdr" }] }));
  const failure = providerFailure(parts.find((p) => p.type === "error")?.error);
  assert.deepEqual(failure, { status: 400, detail: "No ZDR (Zero Data Retention) providers available for model: anthropic/claude-sonnet-5" });
});

test("an error in the middle of the stream reaches the turn with its code", async () => {
  const parts = await read(streamText({ ...quiet, model: model(), messages: [{ role: "user", content: "corte-no-meio por favor" }] }));
  const error = parts.find((p) => p.type === "error")?.error;
  assert.deepEqual(providerFailure(error), { status: 502, detail: "Provider disconnected" });
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
const order = async (content: string) => {
  const r = recorder();
  await read(streamText({ ...quiet, model: chatModel("m/x", false, r.round), messages: [{ role: "user", content: `${content} empresa ${B}` }], tools: r.tools }));
  return r.ran;
};

test("a call handed over last still runs in the order the model wrote it", async () => {
  // The mock finishes ler_empresa first (its arguments close first); the middleware puts listar_chamados back in front.
  assert.deepEqual((await order("sem argumentos primeiro")).map((c) => c.name), ["listar_chamados", "ler_empresa"]);
  assert.deepEqual((await order("inteira depois")).map((c) => c.name), ["listar_chamados", "ler_empresa"]);
  assert.deepEqual((await order("duas no fim")).map((c) => c.name), ["listar_chamados", "buscar_ajuda", "ler_empresa"]);
});

test("a call whose arguments never became JSON runs as {} and is flagged, so the turn refuses it", async () => {
  const r = recorder();
  const result = streamText({ ...quiet, model: chatModel("m/x", false, r.round), messages: [{ role: "user", content: "argumento quebrado" }], tools: r.tools });
  await read(result);
  const [call] = (await result.steps)[0].toolCalls;
  assert.deepEqual(r.ran, [{ name: "listar_faturas", input: {}, flagged: true }]);
  assert.deepEqual([...r.round.malformed], [call.toolCallId]);
});

test("arguments the SDK will not parse keep the order and are refused", async () => {
  const ran = await order("proto primeiro");
  assert.deepEqual(
    ran.map((c) => [c.name, c.input, c.flagged]),
    [
      ["listar_chamados", {}, true],
      ["ler_empresa", { companyId: B }, false],
    ],
  );
  assert.equal(parsesSecurely('{"__proto__":{"x":1}}'), false);
  assert.equal(parsesSecurely('{"a":{"constructor":{"prototype":{}}}}'), false);
  assert.equal(parsesSecurely('{"constructor":"x","limite":1}'), true);
});

test("a malformed call is refused in its own round only, even when the next round reuses its id", async () => {
  const r = recorder();
  await read(streamText({ ...quiet, model: chatModel("m/x", false, r.round), messages: [{ role: "user", content: "mesmo id" }], tools: r.tools, stopWhen: isStepCount(4) }));
  assert.deepEqual(
    r.ran.map((c) => [c.input, c.flagged]),
    [
      [{}, true],
      [{ limite: 1 }, false],
    ],
  );
});

test("a round cut by the output limit leaves its call unrun", async () => {
  const r = recorder();
  const result = streamText({ ...quiet, model: chatModel("m/x", false, r.round), messages: [{ role: "user", content: "corta no limite" }], tools: r.tools, stopWhen: isStepCount(3) });
  await read(result);
  const steps = await result.steps;
  // converse treats this round as no answer and asks again without it.
  assert.equal(r.ran.length, 0);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].finishReason, "length");
  assert.equal(steps[0].toolCalls.length, 1);
  assert.equal(r.round.unfinished, false);
});

test("a call the output limit cut before it was finished is reported", async () => {
  for (const content of ["corte no meio", "corte depois do nome"]) {
    const r = recorder();
    const result = streamText({ ...quiet, model: chatModel("m/x", false, r.round), messages: [{ role: "user", content }], tools: r.tools });
    await read(result);
    const [step] = await result.steps;
    // No call reaches the SDK at all, so only the middleware knows the round was cut.
    assert.equal(step.finishReason, "length", content);
    assert.equal(step.toolCalls.length, 0, content);
    assert.equal(r.round.unfinished, true, content);
    assert.equal(r.ran.length, 0, content);
  }
  const plain = recorder();
  await read(streamText({ ...quiet, model: chatModel("m/x", false, plain.round), messages: [{ role: "user", content: "oi" }], tools: plain.tools }));
  assert.equal(plain.round.unfinished, false);
});

test("Jev's answers pass the SDK's checks, and only TypeSafe's private endpoint is asked", async () => {
  const { answers } = await decide({
    model: gateway.decisionModel("typesafe-ai/jev"),
    state: { mensagem: "me leva para nova cobrança", tela_atual: "/painel" },
    questions: {
      intent: { type: "choice", instructions: "Intenção", criteria: { consultar: "ver", navegar: "ir", humano: "pessoa" } },
      destino: { type: "choice", instructions: "Tela", criteria: { nenhuma: "nenhuma", nova_cobranca: "Nova cobrança" } },
      area_financeiro: { type: "boolean", instructions: "Financeiro" },
    },
    providerOptions: { gateway: { zeroDataRetention: true, disallowPromptTraining: true, only: ["typesafe-ai"] } },
    maxRetries: 0,
  });
  assert.deepEqual(answers.intent, { type: "choice", choice: "navegar", probabilities: { consultar: 0, navegar: 1, humano: 0 } });
  assert.equal(answers.destino.type === "choice" && answers.destino.choice, "nova_cobranca");
  assert.deepEqual(answers.area_financeiro, { type: "boolean", probability: 0.9 });
  const entry = logged().filter((e) => e.jev).at(-1)!;
  assert.deepEqual([entry.zeroDataRetention, entry.disallowPromptTraining, entry.only], [true, true, ["typesafe-ai"]]);
});

test("Jev's own confidence wins over the chosen option's probability, and a refused question costs only its answer", async () => {
  const criteria = { consultar: "ver", navegar: "ir" };
  const own = await askJev({ mensagem: "me leva para a tela, confiança própria" }, { intent: { type: "choice", instructions: "Intenção", criteria } });
  assert.deepEqual(own?.intent, { type: "choice", choice: "navegar", confidence: 0.42 });
  const plain = await askJev({ mensagem: "me leva para a tela" }, { intent: { type: "choice", instructions: "Intenção", criteria } });
  assert.deepEqual(plain?.intent, { type: "choice", choice: "navegar", confidence: 1 });
  const before = logged().filter((e) => e.jev).length;
  const partial = await askJev(
    { mensagem: "qual meu boleto" },
    { intent: { type: "choice", instructions: "Intenção", criteria }, recusar_area: { type: "boolean", instructions: "Área" }, area_financeiro: { type: "boolean", instructions: "Financeiro" } },
  );
  // The SDK throws on any refusal; Jev is asked once more without the refused question.
  assert.deepEqual(Object.keys(partial ?? {}).sort(), ["area_financeiro", "intent"]);
  assert.equal(logged().filter((e) => e.jev).length, before + 2);
  // Both tries went private, and only to TypeSafe.
  for (const entry of logged().filter((e) => e.jev).slice(-2)) assert.deepEqual([entry.zeroDataRetention, entry.disallowPromptTraining, entry.only], [true, true, ["typesafe-ai"]]);
  assert.equal(await askJev({ mensagem: "x" }, { recusar_tudo: { type: "boolean", instructions: "x" } }), null);
  // A refused question the caller needs: no second, paid, useless try.
  const needed = logged().filter((e) => e.jev).length;
  assert.equal(await askJev({ mensagem: "x" }, { recusar_intent: { type: "boolean", instructions: "x" }, area_financeiro: { type: "boolean", instructions: "y" } }, ["recusar_intent"]), null);
  assert.equal(logged().filter((e) => e.jev).length, needed + 1);
  // A refused area stays in play (no opinion is not a "no"); a "no" leaves it out.
  assert.deepEqual(neededAreas(partial!, ["financeiro", "area"] as const), ["financeiro", "area"]);
  assert.deepEqual(neededAreas({ area_financeiro: { type: "boolean", probability: 0.1 }, area_chamados: { type: "boolean", probability: 0.9 } }, ["financeiro", "chamados"] as const), ["chamados"]);
});

test("a call that came whole, before any piece of the one written first, still runs in its own place", async () => {
  const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
  const model = wrapLanguageModel({
    model: new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "tool-call", toolCallId: "b", toolName: "ler_empresa", input: "{}" },
            { type: "tool-input-start", id: "a", toolName: "listar_chamados" },
            { type: "tool-input-end", id: "a" },
            { type: "tool-call", toolCallId: "a", toolName: "listar_chamados", input: "{}" },
            { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
          ],
        }),
      }),
    }),
    middleware: inModelOrder(roundState()),
  });
  const r = recorder();
  await read(streamText({ ...quiet, model, prompt: "oi", tools: r.tools }));
  // The whole call came first, so it is placed first.
  assert.deepEqual(r.ran.map((c) => c.name), ["ler_empresa", "listar_chamados"]);
});

test("a call the provider ran itself goes on at once and does not read as cut", async () => {
  const round = roundState();
  const model = wrapLanguageModel({
    model: new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "tool-input-start", id: "p1", toolName: "busca", providerExecuted: true },
            { type: "tool-input-end", id: "p1" },
            { type: "tool-call", toolCallId: "p1", toolName: "busca", input: "{}", providerExecuted: true },
            { type: "tool-result", toolCallId: "p1", toolName: "busca", result: { ok: true } },
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "Pronto." },
            { type: "text-end", id: "t" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } } },
          ],
        }),
      }),
    }),
    middleware: inModelOrder(round),
  });
  const types = (await read(streamText({ ...quiet, model, prompt: "oi" }))).map((p) => p.type);
  assert.ok(types.indexOf("tool-call") < types.indexOf("tool-result"), types.join());
  assert.equal(round.unfinished, false);
});

test("dictation sends WAV with Portuguese to MAI, privately", async () => {
  const wav = new Uint8Array(encodeWav(new Float32Array(3000).fill(0.1), 16000));
  const text = new TextDecoder().decode(wav.subarray(0, 4)) + new TextDecoder().decode(wav.subarray(8, 12));
  assert.equal(text, "RIFFWAVE");
  const result = await transcribe({
    model: gateway.transcriptionModel("microsoft/mai-transcribe-2"),
    audio: wav,
    providerOptions: transcriptionOptions("microsoft/mai-transcribe-2"),
    maxRetries: 0,
  });
  assert.equal(result.text, "Texto ditado de teste");
  assert.equal(result.language, "pt");
  const entry = logged().filter((e) => e.transcription).at(-1)!;
  assert.deepEqual([entry.mediaType, entry.bytes, entry.locales], ["audio/wav", 44 + 6000, ["pt-BR"]]);
  assert.deepEqual([entry.zeroDataRetention, entry.disallowPromptTraining], [true, true]);
});

test("icons come back as images, and a model that takes one at a time answers 400", async () => {
  const { images } = await generateImage({ model: gateway.imageModel("recraft/recraft-v4.1-flash"), prompt: "Um ícone", n: 4, aspectRatio: "1:1", maxRetries: 0 });
  assert.equal(images.length, 4);
  assert.equal(images[0].mediaType, "image/png");
  const entry = logged().filter((e) => e.images).at(-1)!;
  assert.deepEqual([entry.n, entry.aspectRatio], [4, "1:1"]);
  await assert.rejects(
    generateImage({ model: gateway.imageModel("recraft/recraft-v4.1-flash"), prompt: "UM-POR-VEZ", n: 4, maxRetries: 0 }),
    (error: unknown) => providerFailure(error)?.status === 400,
  );
});

test("no request leaves for another AI host, and every one speaks the protocol the mock knows", async () => {
  const refused = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: "{}" });
  assert.equal(refused.status, 599);
  const entries = logged();
  assert.deepEqual(
    entries.filter((e) => e.unexpected).map((e) => e.unexpected),
    ["https://openrouter.ai/api/v1/chat/completions"],
  );
  assert.equal(entries.filter((e) => e.drift).length, 0);
});
