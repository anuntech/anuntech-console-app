/* eslint-disable @typescript-eslint/no-require-imports -- Test-only provider transport. */
require("./otp-mock.cjs");
const fs = require("node:fs");
const crypto = require("node:crypto");
const fixture = JSON.parse(
  fs.readFileSync(process.env.CONSOLE_TEST_GOOGLE_FILE, "utf8"),
);
const fallback = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (url === "https://www.googleapis.com/oauth2/v3/certs")
    return Response.json({ keys: [fixture.jwk] });
  if (url === "https://oauth2.googleapis.com/token") {
    const code = new URLSearchParams(options.body).get("code");
    const payload = {
      iss: "https://accounts.google.com",
      aud: "console-security-test",
      sub: fixture.sub,
      email: fixture.email,
      email_verified: true,
      name: "Security Test",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      ...(code && code !== "test" ? { nonce: code } : {}),
    };
    const value = [
      Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString(
        "base64url",
      ),
      Buffer.from(JSON.stringify(payload)).toString("base64url"),
    ].join(".");
    const signature = crypto
      .sign("RSA-SHA256", Buffer.from(value), fixture.privateKey)
      .toString("base64url");
    return Response.json({
      access_token: "test",
      token_type: "Bearer",
      expires_in: 300,
      id_token: `${value}.${signature}`,
    });
  }
  return fallback(input, options);
};
