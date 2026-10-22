import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { Contract } from "@console/contract";
import { QueryClient } from "@tanstack/react-query";
import { authClient } from "./auth";
import { CONSOLE_URL, USER_AGENT } from "./config";

/** The signed-in person's session, as the Console expects it from the app (and who is asking). */
export async function sessionHeaders(): Promise<Record<string, string>> {
  const cookie = await authClient.getCookie();
  return { "User-Agent": USER_AGENT, ...(cookie ? { Cookie: cookie } : {}) };
}

const link = new RPCLink({
  url: `${CONSOLE_URL}/api/v1`,
  headers: sessionHeaders,
  // The cookie goes by hand; letting fetch add its own would mix sessions.
  fetch: (request, init) => fetch(request, { ...init, credentials: "omit" }),
});

/** The Console's API (src/lib/api/contract.ts), typed from the contract. */
export const api: ContractRouterClient<Contract> = createORPCClient(link);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        count < 2 && !(error instanceof ORPCError && error.status < 500),
    },
  },
});

/** The Console's message for a refusal, or a generic one for anything else. */
export function errorMessage(error: unknown) {
  if (error instanceof ORPCError && error.status < 500 && error.message) return error.message;
  return "Não foi possível conectar. Confira a internet e tente novamente.";
}
