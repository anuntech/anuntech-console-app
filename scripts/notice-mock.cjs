/* eslint-disable @typescript-eslint/no-require-imports -- Test-only Node preload. */
const fs = require("node:fs");
const original = globalThis.fetch;
const accepted = new Map();
const templateId = process.env.FLW_TICKET_TEMPLATE_ID;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  if (["api.resend.com", "api.wts.chat"].includes(url.hostname)) {
    const flags = JSON.parse(
      fs.readFileSync(process.env.CONSOLE_TEST_NOTICE_FLAGS, "utf8"),
    );
    if (url.pathname === "/chat/v1/template")
      return Response.json({
        items: [
          {
            id: templateId,
            active: true,
            archived: false,
            status: flags.approved ? "APPROVED" : "INREVISION",
          },
        ],
      });
    if (url.pathname.startsWith("/chat/v1/send/message/"))
      return Response.json({
        id: url.pathname.split("/").at(-1),
        status: flags.deliveryFailed ? "FAILED" : "DELIVERED",
      });
    if (
      url.pathname === "/emails" ||
      url.pathname === "/chat/v1/send/template"
    ) {
      const channel = url.pathname === "/emails" ? "email" : "whatsapp";
      const payload = JSON.parse(options.body);
      const key =
        channel === "email"
          ? options.headers["Idempotency-Key"]
          : payload.senderId;
      const id = accepted.get(key) || crypto.randomUUID();
      fs.appendFileSync(
        process.env.CONSOLE_TEST_NOTICE_FILE,
        JSON.stringify({ channel, key, payload }) + "\n",
        { mode: 0o600 },
      );
      if (channel === "email" && flags.email503)
        return Response.json({ error: "unavailable" }, { status: 503 });
      if (channel === "whatsapp" && flags.whatsappTimeout)
        throw Error("Mock timeout");
      accepted.set(key, id);
      return Response.json({ id, status: "QUEUED" });
    }
    throw Error("Unexpected provider operation in notification suite");
  }
  return original(input, options);
};
