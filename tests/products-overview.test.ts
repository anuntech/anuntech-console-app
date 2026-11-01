import { test } from "node:test";
import assert from "node:assert/strict";
import { PROTECTED_APPS } from "../src/lib/apps/registry";
import { mailPageOf, productOpening, webUrl } from "../src/lib/products/product-opening";
import { suspensionNotice } from "../src/lib/suspensions/suspension-notice";

test("a service opens its page, a protected app opens with a pass, any other product its own link", () => {
  assert.deepEqual(productOpening("service", "https://example.com", PROTECTED_APPS), { opensAs: "service", url: null });
  assert.deepEqual(productOpening("product", "https://www.espacoabsolut.com/admin/posts", PROTECTED_APPS), { opensAs: "app", url: null });
  // The public site on the app's host stays a plain link.
  assert.deepEqual(productOpening("product", "https://www.espacoabsolut.com/", PROTECTED_APPS), { opensAs: "link", url: "https://www.espacoabsolut.com/" });
  assert.deepEqual(productOpening("product", null, PROTECTED_APPS), { opensAs: "none", url: null });
  assert.deepEqual(productOpening("project", "https://example.com", PROTECTED_APPS), { opensAs: "none", url: null });
});

test("the e-mail product opens the company's mailboxes inside the Console", () => {
  assert.equal(mailPageOf("product", "email", "b0101b2f-4586-4533-964b-b3d8157b9378"), "/email?empresa=b0101b2f-4586-4533-964b-b3d8157b9378");
  assert.equal(mailPageOf("product", "app", "x"), null);
  assert.equal(mailPageOf("product", null, "x"), null);
  assert.equal(mailPageOf("service", "email", "x"), null);
});

test("only web links leave the app", () => {
  assert.equal(webUrl("javascript:alert(1)"), null);
  assert.equal(webUrl("ftp://example.com"), null);
  assert.equal(webUrl("not a url"), null);
  assert.equal(webUrl("http://example.com/x"), "http://example.com/x");
});

test("the suspension notice says why and offers Pagar agora only for a late payment the person can pay", () => {
  assert.equal(suspensionNotice([]), null);
  const one = suspensionNotice([{ name: "VM", since: "2026-10-01T15:00:00.000Z", reason: "overdue", canPay: true }]);
  assert.equal(one?.title, "VM está suspenso desde 01/10/2026, por atraso no pagamento.");
  assert.equal(one?.text, "Nenhum dado foi apagado. Assim que as faturas vencidas forem pagas, a equipe reativa. O Console e os chamados continuam funcionando.");
  assert.equal(one?.canPay, true);
  assert.equal(suspensionNotice([{ name: "VM", since: null, reason: "overdue", canPay: false }])?.canPay, false);
  const terms = suspensionNotice([{ name: "Site", since: null, reason: "terms", canPay: true }]);
  assert.equal(terms?.title, "Site está suspenso.");
  assert.equal(terms?.canPay, false);
  assert.match(terms?.text ?? "", /Para reativar, fale com a equipe\./);
  const many = suspensionNotice([
    { name: "A", since: null, reason: "terms", canPay: false },
    { name: "B", since: null, reason: "overdue", canPay: true },
  ]);
  assert.equal(many?.title, "2 produtos estão suspensos: A, B.");
  assert.equal(many?.canPay, true);
});
