import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { documentHash } from "../src/lib/document-hash";
import { contractHash, contractHashMatches } from "../src/lib/contracts/contract-hash";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

test("a document's hash does not depend on the order JSONB gives the keys back", () => {
  const sent = { title: "Site", phases: [{ name: "Fase 1", hoursMax: 20, hoursMin: 10 }], number: "2026-001" };
  const stored = { number: "2026-001", phases: [{ hoursMin: 10, name: "Fase 1", hoursMax: 20 }], title: "Site" };
  assert.equal(documentHash(sent), documentHash(stored));
  assert.equal(documentHash(sent), sha('{"number":"2026-001","phases":[{"hoursMax":20,"hoursMin":10,"name":"Fase 1"}],"title":"Site"}'));
  assert.notEqual(documentHash(sent), documentHash({ ...sent, title: "Site novo" }));
});

test("a contract's stored hash is checked against the canonical text and the legacy key orders", () => {
  const publication = { title: "Contrato", body: "Cláusula 1.", companyName: "A", companyDocument: "123" };
  assert.ok(contractHashMatches(publication, contractHash(publication)));
  // Sent before the canonical hash: hashed in insertion order.
  assert.ok(contractHashMatches(publication, sha(JSON.stringify(publication))));
  assert.ok(!contractHashMatches({ ...publication, body: "Cláusula 2." }, contractHash(publication)));
  assert.ok(!contractHashMatches(publication, sha(JSON.stringify({ body: "Cláusula 1.", title: "Contrato", companyName: "A", companyDocument: "123", extra: 1 }))));
});
