import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  phoneNumberClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { CONSOLE_URL } from "./config";

/**
 * Sign-in for the app: the same codes as the web (e-mail, WhatsApp and the
 * second step). The session cookies live in SecureStore and go out in the
 * Cookie header; the server reads expo-origin as the request's origin.
 */
export const authClient = createAuthClient({
  baseURL: CONSOLE_URL,
  plugins: [
    expoClient({
      scheme: "anuntech",
      storagePrefix: "anuntech",
      cookiePrefix: "anuntech-console",
      storage: SecureStore,
    }),
    emailOTPClient(),
    phoneNumberClient(),
    twoFactorClient(),
  ],
});

/** The second step's channel and the masked contact (GET /security/challenge). */
export async function securityChallenge() {
  const result = await authClient.$fetch<{ channel: "email" | "whatsapp"; destination: string }>(
    "/security/challenge",
    { method: "GET" },
  );
  if (result.error || !result.data) throw new Error("expired");
  return result.data;
}

/** Brazilian numbers get the country code; anything starting with + is kept (as on the web). */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("+") ? `+${digits}` : `+55${digits}`;
}
