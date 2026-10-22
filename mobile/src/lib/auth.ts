import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  phoneNumberClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { CONSOLE_URL, USER_AGENT } from "./config";

/**
 * Sign-in for the app: the same codes as the web (e-mail, WhatsApp and the
 * second step). The session cookies live in SecureStore and go out in the
 * Cookie header; the server reads expo-origin as the request's origin.
 */
export const authClient = createAuthClient({
  baseURL: CONSOLE_URL,
  // The session list on the web names the device from this ("App Anuntech · iPhone").
  fetchOptions: { headers: { "User-Agent": USER_AGENT } },
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

/** A refusal from Better Auth, with the Console's message (or a generic one). */
export class AuthRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The message for a failed auth call: the server's words, or "no connection". */
export function authErrorMessage(error: unknown) {
  return error instanceof AuthRequestError
    ? error.message
    : "Não foi possível conectar. Confira a internet e tente novamente.";
}

type Channel = "email" | "whatsapp";
/** A two-step change in progress: which contact confirms now, masked. */
export type SecurityProof = { changeId: string; stage: Channel; destination: string };

/** POST /api/auth/security/<path> (plugin consoleTwoStep), throwing the server's message. */
async function securityRequest<T>(path: string, body: Record<string, string>) {
  const result = await authClient.$fetch<T>(`/security/${path}`, { method: "POST", body });
  if (result.error)
    throw new AuthRequestError(
      result.error.status,
      result.error.message || "Não foi possível concluir. Tente novamente.",
    );
  return result.data as T;
}

/**
 * Turning the second step on or off, or moving it to the other channel: a
 * code on the e-mail, then one on WhatsApp. The last code ends every other session.
 */
export const securityChange = {
  start: (action: "enable" | "disable" | "channel", channel: Channel) =>
    securityRequest<SecurityProof>("start-change", { action, channel }),
  send: (changeId: string) => securityRequest<unknown>("send-change", { changeId }),
  verify: (changeId: string, code: string) =>
    securityRequest<{ complete?: true; stage?: Channel; destination?: string }>("verify-change", {
      changeId,
      code,
    }),
};
