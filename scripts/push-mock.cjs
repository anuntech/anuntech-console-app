/* eslint-disable @typescript-eslint/no-require-imports -- Test-only Node preload. */
// The Expo Push Service, in the test server's process. Every message posted
// to /push/send is recorded in CONSOLE_TEST_PUSH_FILE (one JSON line each)
// and answered with an "ok" ticket, except a token with "NotRegistered" in
// it, which answers DeviceNotRegistered as Expo does for an uninstalled app.
// /push/getReceipts answers "ok" for every id and records the ids it was
// asked. Load it last in NODE_OPTIONS, so it wraps the other mocks' fetch.
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const original = globalThis.fetch;
const base = (process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send").replace(/\/send$/, "");
const record = (line) => {
  if (!process.env.CONSOLE_TEST_PUSH_FILE) throw TypeError("Unexpected push without CONSOLE_TEST_PUSH_FILE");
  fs.appendFileSync(process.env.CONSOLE_TEST_PUSH_FILE, JSON.stringify(line) + "\n", { mode: 0o600 });
};
globalThis.fetch = async (input, options = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === `${base}/send`) {
    const body = JSON.parse(options.body);
    const messages = Array.isArray(body) ? body : [body];
    const data = messages.map((message) => {
      const gone = String(message.to).includes("NotRegistered");
      const id = gone ? null : randomUUID();
      record({
        kind: "send",
        to: message.to,
        title: message.title,
        body: message.body,
        url: message.data?.url ?? null,
        ticket: id,
        authorized: !!options.headers?.Authorization,
      });
      return gone
        ? { status: "error", message: `"${message.to}" is not a registered push notification recipient`, details: { error: "DeviceNotRegistered" } }
        : { status: "ok", id };
    });
    return Response.json({ data });
  }
  if (url === `${base}/getReceipts`) {
    const { ids } = JSON.parse(options.body);
    record({ kind: "receipts", ids });
    return Response.json({ data: Object.fromEntries(ids.map((id) => [id, { status: "ok" }])) });
  }
  return original(input, options);
};
