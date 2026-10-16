import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError } from "pg";

/**
 * A database failure, described without the values that went with it.
 * Drizzle's own message is the SQL plus every parameter (e-mails, IPs,
 * documents), and pg's `detail` and message can quote input too, so neither
 * reaches the screen, the logs nor a stored error.
 */
export type DatabaseFault = {
  /**
   * SQLSTATE ("23505" for a unique index), the socket's code ("ECONNREFUSED"),
   * "connection" when the pool gave up, or "no_code".
   */
  code: string;
  constraint?: string;
  table?: string;
  column?: string;
};

const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/**
 * A socket error on the way to Postgres (refused, unknown host, reset): it
 * names the database host, never query values. Only one aimed at the
 * database's own host or port counts, so a failed call to the bank does not.
 */
function databaseSocket(error: Error) {
  const socket = error as { code?: unknown; syscall?: unknown; hostname?: unknown; address?: unknown; port?: unknown };
  if (typeof socket.code !== "string" || !["connect", "getaddrinfo", "read", "write"].includes(String(socket.syscall))) return false;
  let target: URL;
  try {
    target = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    return false;
  }
  const host = target.hostname.replace("-pooler.", ".");
  return (
    [socket.hostname, socket.address].some((value) => typeof value === "string" && value.replace("-pooler.", ".") === host) ||
    Number(socket.port) === Number(target.port || 5432)
  );
}

function describe(error: { code?: unknown; constraint?: unknown; table?: unknown; column?: unknown }): DatabaseFault {
  return {
    code: text(error.code) ?? "no_code",
    constraint: text(error.constraint),
    table: text(error.table),
    column: text(error.column),
  };
}

/** What failed in the database, or null when `error` did not come from it. */
export function databaseFault(error: unknown): DatabaseFault | null {
  // Every query goes through Drizzle, which wraps pg's error (or the socket's) as its cause.
  if (error instanceof DrizzleQueryError) return describe((error.cause ?? {}) as Record<string, unknown>);
  // A transaction takes its connection outside Drizzle's wrapper, so these arrive bare.
  if (error instanceof DatabaseError) return describe(error);
  if (!(error instanceof Error)) return null;
  if (databaseSocket(error)) return describe({ code: (error as { code?: unknown }).code });
  if (/^(timeout exceeded when trying to connect|Connection terminated)/.test(error.message)) return { code: "connection" };
  return null;
}

/** Logs a database failure under `scope` and returns it; null, and nothing logged, for any other error. */
export function logDatabaseFault(scope: string, error: unknown) {
  const fault = databaseFault(error);
  if (fault) console.error(`[${scope}] database error`, fault);
  return fault;
}

/** What the person reads when the database refused something they could not have caused. */
export const DATABASE_FAILURE = "Não foi possível concluir agora. Tente de novo em alguns minutos; se continuar, abra um chamado.";

/**
 * An error as the team reads it later (a paused recurrence, a routine that
 * failed): the message, or the database code and index instead of the query.
 */
export function errorText(error: unknown, fallback: string) {
  const fault = databaseFault(error);
  if (fault) return `Falha no banco de dados (${[fault.code, fault.constraint].filter(Boolean).join(", ")}).`;
  return error instanceof Error && error.message ? error.message : fallback;
}
