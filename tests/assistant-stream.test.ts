import assert from "node:assert/strict";
import test from "node:test";
import { APICallError, RetryError, StreamProviderError } from "ai";
import { failureText } from "../src/lib/assistant/assistant-errors";
import { assistantDataSchemas, assistantMetadataSchema, messageText, refusalText } from "../src/lib/assistant/assistant-stream";
import { providerFailure } from "../src/lib/assistant/openrouter-chat";

const model = "anthropic/claude-sonnet-5";
const apiError = (statusCode: number, message: string) =>
  new APICallError({ message, url: "https://openrouter.ai/api/v1/chat/completions", requestBodyValues: {}, statusCode });

test("OpenRouter's refusals read in Portuguese, with the next step", () => {
  assert.match(failureText({ status: 401, detail: "No auth" }, model), /^A chave do OpenRouter foi recusada\./);
  assert.match(failureText({ status: 402, detail: "can only afford 2000" }, model), /sem créditos/);
  assert.match(failureText({ status: 429, detail: "Rate limited" }, model), /limite de uso do OpenRouter/);
  assert.match(failureText({ status: 404, detail: "No endpoints found matching your data policy" }, model), /atende sem guardar os dados/);
  assert.match(failureText({ status: 400, detail: "anthropic/x is not a valid model ID" }, model), /^O modelo "anthropic\/claude-sonnet-5" não foi aceito/);
  assert.equal(failureText({ status: 502, detail: "Provider disconnected" }, model), "O OpenRouter não respondeu (Provider disconnected). Tente de novo em instantes.");
  assert.match(failureText({ detail: "", timeout: true }, model), /demorou demais/);
});

test("no English from the SDK reaches the person through the generic text", () => {
  // Without a status (not an API answer), "model" in the detail does not make it a model refusal.
  assert.doesNotMatch(failureText({ detail: "model stream ended" }, model), /não foi aceito/);
});

test("a failure is read from what the AI SDK reports", () => {
  assert.deepEqual(providerFailure(apiError(402, "can only afford 2000")), { status: 402, detail: "can only afford 2000" });
  const retried = new RetryError({ message: "Failed after 2 attempts", reason: "maxRetriesExceeded", errors: [apiError(503, "busy"), apiError(429, "Rate limited")] });
  assert.deepEqual(providerFailure(retried), { status: 429, detail: "Rate limited" });
  assert.deepEqual(providerFailure(new StreamProviderError({ message: "Provider disconnected", statusCode: 502 })), { status: 502, detail: "Provider disconnected" });
  assert.deepEqual(providerFailure({ code: 503, message: "busy" }), { status: 503, detail: "busy" });
  assert.equal(providerFailure(new DOMException("late", "TimeoutError"))?.timeout, true);
  // A bug or a database fault is not the provider's: the route logs it and says something generic.
  assert.equal(providerFailure(new Error("relation does not exist")), null);
  assert.equal(providerFailure("x"), null);
});

test("a refusal before the turn shows the server's own words, never its raw body", () => {
  assert.equal(refusalText('{"error":"Muitas mensagens nesta hora. Espere um pouco e tente de novo."}'), "Muitas mensagens nesta hora. Espere um pouco e tente de novo.");
  assert.equal(refusalText("<html>504 Gateway Timeout</html>"), null);
  assert.equal(refusalText('{"error":""}'), null);
  assert.equal(refusalText(undefined), null);
});

test("the text of a message is its text parts, in order", () => {
  assert.equal(
    messageText({ parts: [{ type: "data-steps", id: "steps", data: ["Consultei as faturas"] }, { type: "text", text: "Aqui " }, { type: "text", text: "está." }] }),
    "Aqui está.",
  );
  assert.equal(messageText(undefined), "");
});

test("page actions only take the person somewhere inside the Console", () => {
  const actions = assistantDataSchemas.actions;
  assert.ok(actions.safeParse([{ type: "navigate", href: "/financeiro?companyId=1" }]).success);
  for (const href of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])
    assert.equal(actions.safeParse([{ type: "navigate", href }]).success, false, href);
  assert.equal(actions.safeParse([{ type: "run_script", code: "x" }]).success, false);
  assert.ok(actions.safeParse([{ type: "fill", form: "f1", fields: [{ campo: "a", valor: "b" }], submit: false }, { type: "refresh" }]).success);
});

test("a card without its nonce, or a phase this build does not know, is refused", () => {
  const card = { id: "p1", nonce: "n".repeat(43), title: "Abrir um chamado", details: [], tainted: false, path: null, expiresAt: new Date().toISOString() };
  assert.ok(assistantDataSchemas.proposal.safeParse(card).success);
  assert.equal(assistantDataSchemas.proposal.safeParse({ ...card, nonce: "" }).success, false);
  assert.ok(assistantDataSchemas.phase.safeParse({ phase: "reading", tokens: 10 }).success);
  assert.equal(assistantDataSchemas.phase.safeParse({ phase: "thinking", tokens: 10 }).success, false);
  assert.equal(assistantMetadataSchema.safeParse({ conversationId: "not-a-uuid" }).success, false);
});
