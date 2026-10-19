import assert from "node:assert/strict";
import test from "node:test";
import { AISDKError, APICallError, JSONParseError, RetryError, StreamProviderError, TypeValidationError } from "ai";
import { GatewayInternalServerError, GatewayModelNotFoundError, GatewayRateLimitError, GatewayResponseError } from "@ai-sdk/gateway";
import { failureText } from "../src/lib/assistant/assistant-errors";
import { assistantMetadataSchema, messageText, readActions, readCard, readPhase, refusalText } from "../src/lib/assistant/assistant-stream";
import { providerFailure, sdkError } from "../src/lib/assistant/chat-model";

const model = "anthropic/claude-sonnet-5";
const apiError = (statusCode: number, message: string) =>
  new APICallError({ message, url: "https://ai-gateway.vercel.sh/v4/ai/language-model", requestBodyValues: {}, statusCode });

test("the Gateway's refusals read in Portuguese, with the next step", () => {
  assert.match(failureText({ status: 401, detail: "credencial recusada" }, model), /^O AI Gateway recusou o acesso do Console\./);
  assert.match(failureText({ status: 402, detail: "Insufficient funds" }, model), /sem créditos/);
  assert.match(failureText({ status: 403, detail: "Model not available on the free tier" }, model), /não liberou o modelo "anthropic\/claude-sonnet-5"/);
  assert.match(failureText({ status: 429, detail: "Rate limited" }, model), /^O modelo está no limite de uso agora/);
  assert.match(failureText({ status: 400, detail: "No ZDR (Zero Data Retention) providers available for model: x" }, model), /atende sem guardar os dados/);
  assert.match(failureText({ status: 400, detail: "no_providers_available" }, model), /atende sem guardar os dados/);
  assert.match(failureText({ status: 404, detail: "Model not found" }, model), /^O modelo "anthropic\/claude-sonnet-5" não foi aceito pelo AI Gateway/);
  assert.equal(failureText({ status: 502, detail: "Provider disconnected" }, model), "O AI Gateway não respondeu (Provider disconnected). Tente de novo em instantes.");
  assert.match(failureText({ detail: "", timeout: true }, model), /demorou demais/);
});

test("no English from the SDK reaches the person through the generic text", () => {
  // Without a status (not an API answer), "model" in the detail does not make it a model refusal.
  assert.doesNotMatch(failureText({ detail: "model stream ended" }, model), /não foi aceito/);
});

test("a failure is read from what the Gateway reports", () => {
  assert.deepEqual(providerFailure(new GatewayInternalServerError({ message: "Insufficient funds", statusCode: 402 })), { status: 402, detail: "Insufficient funds" });
  assert.deepEqual(providerFailure(new GatewayModelNotFoundError({ message: "Model x not found" })), { status: 404, detail: "Model x not found" });
  const busy = new RetryError({ message: "Failed after 2 attempts", reason: "maxRetriesExceeded", errors: [new GatewayRateLimitError({ message: "Rate limited" })] });
  assert.deepEqual(providerFailure(busy), { status: 429, detail: "Rate limited" });
  // The documented refusal when no provider keeps nothing does not fit the SDK's error shape: its words stay in `response`.
  const noPrivate = new GatewayResponseError({ statusCode: 400, response: { error: "No ZDR (Zero Data Retention) providers available for model: x", type: "no_providers_available" } });
  assert.deepEqual(providerFailure(noPrivate), { status: 400, detail: "No ZDR (Zero Data Retention) providers available for model: x" });
  // A deadline that cut the request: the Gateway wraps the abort as a 500.
  const cut = new GatewayInternalServerError({ message: "Gateway request failed: aborted due to timeout", cause: new DOMException("late", "TimeoutError") });
  assert.equal(providerFailure(cut)?.timeout, true);
  // A missing credential, as the SDK rewraps it in production: no status, only the name.
  const unauthenticated = new AISDKError({ name: "GatewayError", message: "Unauthenticated. Configure AI_GATEWAY_API_KEY or use a provider module." });
  assert.equal(providerFailure(unauthenticated)?.status, 401);
  assert.equal(providerFailure(Object.assign(new Error("Unauthenticated request"), { name: "GatewayAuthenticationError" }))?.status, 401);
  // Their message or cause may carry the request: the route logs only the name.
  for (const error of [noPrivate, cut, unauthenticated, apiError(500, "x")]) assert.equal(sdkError(error), true);
  assert.equal(sdkError(new Error("relation does not exist")), false);
});

test("a failure is read from what the AI SDK reports", () => {
  assert.deepEqual(providerFailure(apiError(402, "can only afford 2000")), { status: 402, detail: "can only afford 2000" });
  const retried = new RetryError({ message: "Failed after 2 attempts", reason: "maxRetriesExceeded", errors: [apiError(503, "busy"), apiError(429, "Rate limited")] });
  assert.deepEqual(providerFailure(retried), { status: 429, detail: "Rate limited" });
  assert.deepEqual(providerFailure(new StreamProviderError({ message: "Provider disconnected", statusCode: 502 })), { status: 502, detail: "Provider disconnected" });
  assert.deepEqual(providerFailure({ code: 503, message: "busy" }), { status: 503, detail: "busy" });
  assert.equal(providerFailure(new DOMException("late", "TimeoutError"))?.timeout, true);
  // A piece of the stream that could not be read: a fixed detail, never the piece (it may quote the answer).
  const unreadable = new TypeValidationError({ value: { choices: [{ delta: { content: "A fatura da Acme venceu" } }] }, cause: new Error("bad") });
  assert.deepEqual(providerFailure(unreadable), { detail: "resposta ilegível do provedor" });
  assert.deepEqual(providerFailure(new JSONParseError({ text: "data: {\"content\":\"segredo\"", cause: new Error("bad") })), { detail: "resposta ilegível do provedor" });
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

test("the panel's page actions only take the person somewhere inside the Console", () => {
  assert.deepEqual(readActions([{ type: "navigate", href: "/financeiro?companyId=1" }]), [{ type: "navigate", href: "/financeiro?companyId=1" }]);
  for (const href of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) assert.deepEqual(readActions([{ type: "navigate", href }]), [], href);
  // One bad action is dropped, the rest of the answer's actions stay.
  assert.deepEqual(readActions([{ type: "run_script", code: "x" }, { type: "refresh" }]), [{ type: "refresh" }]);
  assert.deepEqual(readActions({ type: "refresh" }), []);
  assert.equal(readActions([{ type: "fill", form: "f1", fields: [{ campo: "a", valor: "b" }], submit: false }]).length, 1);
});

test("the panel drops a card without its nonce and reads an unknown phase as plain thinking", () => {
  const card = { id: "p1", nonce: "n".repeat(43), title: "Abrir um chamado", details: [], tainted: false, path: null, expiresAt: new Date().toISOString() };
  assert.deepEqual(readCard(card), card);
  assert.equal(readCard({ ...card, nonce: "" }), null);
  assert.equal(readCard({ ...card, details: undefined }), null);
  assert.deepEqual(readPhase({ phase: "reading", tokens: 10 }), { phase: "reading", tokens: 10 });
  // A newer server's phase: thinking, with the tokens still counted.
  assert.deepEqual(readPhase({ phase: "planning", tokens: 12 }), { phase: null, tokens: 12 });
  assert.deepEqual(readPhase({ phase: "answer", tokens: "x" }), { phase: "answer", tokens: null });
  assert.deepEqual(readPhase(null), { phase: null, tokens: null });
  assert.equal(assistantMetadataSchema.safeParse({ conversationId: "not-a-uuid" }).success, false);
});
