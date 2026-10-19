import assert from "node:assert/strict";
import test from "node:test";
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
});

test("an icon model is tried again after a quick hiccup, or when no other model is left", () => {
  assert.equal(retryIcon(503, 1_000, false), true);
  assert.equal(retryIcon(0, 1_000, false), true);
  // A slow failure leaves the time to the fallback model.
  assert.equal(retryIcon(500, 50_000, false), false);
  assert.equal(retryIcon(500, 50_000, true), true);
  // A refusal is not retried.
  assert.equal(retryIcon(400, 1_000, true), false);
  assert.equal(retryIcon(402, 1_000, true), false);
});
