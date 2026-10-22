import "server-only";
import { headers } from "next/headers";
import { auth } from "../auth/auth";
import { answersForClient, type Actor } from "./access";

/** Which side of the table the viewer sits on for a company's contract or quote. */
export type DecisionParty = "anuntech" | "client";

/**
 * The team signs and records answers for Anuntech; the company's
 * Administradores decide for the client (answersForClient, never the team).
 * Anyone else decides nothing.
 */
export function partyFor(actor: Actor, companyId: string): DecisionParty | null {
  if (actor.admin) return "anuntech";
  return answersForClient(actor, companyId) ? "client" : null;
}

/**
 * What a signature or an answer keeps as evidence: where it came from and
 * when the session that made it was opened (the session is the identity
 * proof, opened with a code). The web reads it from the action's request,
 * the app's API from the procedure's.
 */
export type DecisionEvidence = { ip: string | null; userAgent: string | null; sessionStartedAt: Date | null };

export function decisionEvidence(
  requestHeaders: Headers,
  session: { session: { createdAt: Date | string } } | null | undefined,
): DecisionEvidence {
  return {
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
    sessionStartedAt: session ? new Date(session.session.createdAt) : null,
  };
}

/** The evidence of the server action being handled. */
export async function requestEvidence(): Promise<DecisionEvidence> {
  const requestHeaders = await headers();
  return decisionEvidence(requestHeaders, await auth.api.getSession({ headers: requestHeaders }));
}
