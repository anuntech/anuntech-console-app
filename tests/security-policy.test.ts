import assert from "node:assert/strict";
import test from "node:test";
import { isPrimarySignIn, secondaryChannel } from "../src/lib/auth/security-policy";

test("a second passwordless step always uses the other verified contact", () => {
  for (const preference of ["email", "whatsapp"] as const) {
    assert.equal(
      secondaryChannel("/sign-in/email-otp", preference),
      "whatsapp",
    );
    assert.equal(secondaryChannel("/phone-number/verify", preference), "email");
    assert.equal(secondaryChannel("/callback/google", preference), preference);
    assert.equal(secondaryChannel("/sign-in/social", preference), preference);
  }
});

test("only primary sign-in endpoints gate a newly created session", () => {
  for (const path of [
    "/sign-in/email-otp",
    "/phone-number/verify",
    "/callback/google",
    "/callback/:id",
    "/sign-in/social",
  ])
    assert.equal(isPrimarySignIn(path), true, path);
  // Better Auth also calls setSessionCookie on session refresh and profile edits.
  // Treating these as primary sign-ins would revoke an already proven session.
  for (const path of [
    "/get-session",
    "/update-user",
    "/two-factor/verify-otp",
    "/security/verify-change",
  ])
    assert.equal(isPrimarySignIn(path), false, path);
});
