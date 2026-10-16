import assert from "node:assert/strict";
import test from "node:test";
import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError } from "pg";
import { databaseFault, errorText } from "../src/lib/action-errors";

/** The failure seen in production on 16/10/2026: the unique index of 0026, before 0042. */
function signatureClash() {
  const cause = Object.assign(new Error('duplicate key value violates unique constraint "console_contract_signature_party_unique"'), {
    code: "23505",
    constraint: "console_contract_signature_party_unique",
    table: "console_contract_signatures",
    detail: "Key (contract_id, party)=(f3cec612-e6e2-4d31-a464-8f0d0fba3854, anuntech) already exists.",
  });
  return new DrizzleQueryError(
    'insert into "console_contract_signatures" ("id", "contract_id", "party", "email", "ip") values ($1, $2, $3, $4, $5)',
    ["668c50af", "f3cec612", "anuntech", "pessoa@empresa.com.br", "170.79.209.117"],
    cause,
  );
}

test("a database failure keeps what failed and drops every value sent", () => {
  const fault = databaseFault(signatureClash());
  assert.deepEqual(fault, {
    code: "23505",
    constraint: "console_contract_signature_party_unique",
    table: "console_contract_signatures",
    column: undefined,
  });
  const text = JSON.stringify(fault);
  for (const value of ["pessoa@empresa.com.br", "170.79.209.117", "f3cec612", "insert into", "Key ("])
    assert.ok(!text.includes(value), value);
});

test("a query that never reached Postgres still counts as a database failure", () => {
  assert.equal(databaseFault(new DrizzleQueryError("select 1", [], new Error("Connection terminated")))?.code, "no_code");
  // A transaction takes its connection outside Drizzle, so the pool's and the socket's errors arrive bare.
  assert.equal(databaseFault(new Error("timeout exceeded when trying to connect"))?.code, "connection");
  assert.equal(databaseFault(new Error("Connection terminated unexpectedly"))?.code, "connection");
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://console@ep-quiet-sky-pooler.sa-east-1.aws.neon.tech/console";
  try {
    const refused = Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432"), {
      code: "ECONNREFUSED",
      syscall: "connect",
      address: "10.0.0.5",
      port: 5432,
    });
    assert.deepEqual(databaseFault(refused), { code: "ECONNREFUSED", constraint: undefined, table: undefined, column: undefined });
    const unknown = Object.assign(new Error("getaddrinfo ENOTFOUND ep-quiet-sky-pooler.sa-east-1.aws.neon.tech"), {
      code: "ENOTFOUND",
      syscall: "getaddrinfo",
      hostname: "ep-quiet-sky-pooler.sa-east-1.aws.neon.tech",
    });
    assert.equal(databaseFault(unknown)?.code, "ENOTFOUND");
    // The bank's host refusing is the bank's problem, not the database's.
    const bank = Object.assign(new Error("connect ECONNREFUSED 200.1.2.3:443"), { code: "ECONNREFUSED", syscall: "connect", address: "200.1.2.3", port: 443 });
    assert.equal(databaseFault(bank), null);
  } finally {
    process.env.DATABASE_URL = previous;
  }
  const login = Object.assign(new DatabaseError('password authentication failed for user "console"', 100, "error"), { code: "28P01" });
  assert.equal(databaseFault(login)?.code, "28P01");
});

test("what the team reads later names the database code, never the query", () => {
  assert.equal(errorText(signatureClash(), "Falha."), "Falha no banco de dados (23505, console_contract_signature_party_unique).");
  assert.equal(errorText(new Error("timeout exceeded when trying to connect"), "Falha."), "Falha no banco de dados (connection).");
  assert.equal(errorText(new Error("O Inter recusou o CPF."), "Falha."), "O Inter recusou o CPF.");
  assert.equal(errorText("x", "Falha."), "Falha.");
});

test("messages written for the person are not database failures", () => {
  assert.equal(databaseFault(new Error("Esta parte já assinou esta versão do contrato.")), null);
  assert.equal(databaseFault("stale"), null);
  // A failed call to another service is not the database, even when its cause is a refused socket.
  assert.equal(databaseFault(new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } })), null);
  assert.equal(databaseFault(undefined), null);
});
