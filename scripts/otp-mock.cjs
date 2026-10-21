/* eslint-disable @typescript-eslint/no-require-imports -- Test-only Node preload. */
const fs = require("node:fs");
const original = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (
    url === "https://api.resend.com/emails" ||
    url === "https://api.wts.chat/chat/v1/send/otp"
  ) {
    const body = JSON.parse(options.body);
    const record = url.includes("resend")
      ? {
          channel: "email",
          to: body.to[0],
          subject: body.subject,
          // Notices without a code (an account deletion) are recorded too.
          code: body.text.match(/\b\d{6}\b/)?.[0],
        }
      : { channel: "whatsapp", to: `+${body.to}`, code: body.code };
    fs.appendFileSync(
      process.env.CONSOLE_TEST_OTP_FILE,
      JSON.stringify(record) + "\n",
      { mode: 0o600 },
    );
    return Response.json({ id: crypto.randomUUID(), status: "PENDING" });
  }
  // No unexpected outbound requests are allowed in the authentication suite.
  if (!url.startsWith("http://127.0.0.1:"))
    throw Error("Unexpected external request in OTP test");
  return original(input, options);
};
