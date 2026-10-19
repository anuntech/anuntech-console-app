import assert from "node:assert/strict";
import test from "node:test";
import { APICallError } from "ai";
import { GatewayInternalServerError, GatewayRateLimitError, GatewayResponseError } from "@ai-sdk/gateway";
import { gatewayStatus, stoppedBy } from "../src/lib/ai/gateway-errors";
import { retryIcon } from "../src/lib/catalog/icon-rules";

// A deadline as the Gateway provider really returns it: a 500 around the abort, with no body.
const deadline = () =>
  new GatewayResponseError({
    message: "Invalid error response format: Gateway request failed: The operation was aborted due to timeout",
    statusCode: 500,
    response: {},
    cause: new DOMException("The operation was aborted due to timeout", "TimeoutError"),
  });

test("a deadline reads as one, wrapped or not", () => {
  assert.equal(stoppedBy(deadline()), "TimeoutError");
  assert.equal(stoppedBy(new DOMException("x", "AbortError")), "AbortError");
  assert.equal(stoppedBy(new GatewayInternalServerError({ message: "busy" })), null);
  assert.deepEqual(gatewayStatus(deadline()), { status: 500, detail: "timeout (TimeoutError)" });
});

test("the Gateway's status and words go to the fallback rule; never the cause", () => {
  assert.deepEqual(gatewayStatus(new GatewayRateLimitError({ message: "Rate limited" })), { status: 429, detail: "Rate limited" });
  assert.deepEqual(gatewayStatus(Object.assign(new Error("Unauthenticated request"), { name: "GatewayAuthenticationError" })), { status: 401, detail: "GatewayAuthenticationError" });
  assert.deepEqual(gatewayStatus(new TypeError("fetch failed")), { status: 0, detail: "TypeError" });
  // The network, as the SDK wraps it: no status and no body inside a 500.
  const unreachable = new APICallError({ message: "Cannot connect to API: getaddrinfo ENOTFOUND ai-gateway.vercel.sh", url: "https://ai-gateway.vercel.sh/v4/ai/image-model", requestBodyValues: {}, isRetryable: true });
  assert.deepEqual(gatewayStatus(new GatewayResponseError({ statusCode: 500, response: {}, cause: unreachable })), { status: 0, detail: "Cannot connect to API: getaddrinfo ENOTFOUND ai-gateway.vercel.sh" });
  // A refusal in the flat shape keeps its own words.
  const flat = new GatewayResponseError({ statusCode: 400, response: { error: "No ZDR (Zero Data Retention) providers available for model: x", type: "no_providers_available" } });
  assert.deepEqual(gatewayStatus(flat), { status: 400, detail: "No ZDR (Zero Data Retention) providers available for model: x" });
});

test("an icon model is tried again after a quick hiccup, or when it is the last and there is time for it", () => {
  assert.equal(retryIcon(503, 1_000, false, 70_000), true);
  assert.equal(retryIcon(0, 1_000, false, 70_000), true);
  // A slow failure leaves the time to the fallback model.
  assert.equal(retryIcon(500, 50_000, false, 23_500), false);
  // The last model is tried again only when another attempt as slow could still fit in the route's time.
  assert.equal(retryIcon(500, 30_000, true, 43_500), true);
  assert.equal(retryIcon(500, 50_000, true, 23_500), false);
  // A refusal is not retried.
  assert.equal(retryIcon(400, 1_000, true, 70_000), false);
  assert.equal(retryIcon(402, 1_000, true, 70_000), false);
});
