import assert from "node:assert/strict";
import test from "node:test";
import {
  afterSignIn,
  returnPathFromCallback,
  safeReturnPath,
  withReturnPath,
} from "../src/lib/auth/return-path";

test("sign-in returns only to a Console path that opens an app", () => {
  for (const path of [
    "/abrir/x",
    "/abrir/espaco-absolut-cms",
    "/abrir/brastemp-base-pendente",
    "/apps/3f1c2b9e-8a4d-4c1e-9b7a-0d2e5f6a7b8c",
    `/abrir/${"a".repeat(64)}`,
  ])
    assert.equal(safeReturnPath(path), path, path);
});

test("anything else after sign-in is dropped: other hosts, tricks, queries, other pages", () => {
  for (const value of [
    "//evil.com",
    "//evil.com/abrir/x",
    "/\\evil.com",
    "/\\evil.com/abrir/x",
    "\\\\evil.com",
    "https://evil.com",
    "https://evil.com/abrir/x",
    "http://console.anuntech.com/abrir/x",
    "javascript:alert(1)",
    "/abrir/x?y",
    "/abrir/x?volta=//evil.com",
    "/abrir/x#y",
    "/abrir/x/",
    "/abrir/x/y",
    "/abrir/",
    "/abrir",
    "/apps/",
    "/painel",
    "/entrar",
    "/",
    "/abrir/../x",
    "/abrir/..",
    "/abrir/x/../../painel",
    "/abrir/%2e%2e",
    "%2F%2Fevil",
    "%2F%2Fevil.com",
    "/abrir/x%2F..%2F..%2Fpainel",
    "/%2F/evil.com",
    "/ABRIR/x",
    "/Apps/x",
    " /abrir/x",
    "/abrir/x ",
    "/abrir/x\n",
    "/abrir/x\r\nLocation: https://evil.com",
    "/abrir/x\u0000",
    "/abrir/café",
    "/abrir/x.y",
    "/abrir/x_y",
    `/abrir/${"a".repeat(65)}`,
    "",
  ])
    assert.equal(safeReturnPath(value), null, JSON.stringify(value));
  // Repeated query parameters arrive as arrays; nothing that is not a string passes.
  for (const value of [undefined, null, 0, ["/abrir/x"], { toString: () => "/abrir/x" }])
    assert.equal(safeReturnPath(value), null, String(value));
});

test("without a valid return path, the person goes to the dashboard as before", () => {
  assert.equal(afterSignIn("/abrir/espaco-absolut-cms"), "/abrir/espaco-absolut-cms");
  assert.equal(afterSignIn("//evil.com"), "/painel");
  assert.equal(afterSignIn(undefined), "/painel");
  assert.equal(afterSignIn(["/abrir/x", "/abrir/y"]), "/painel");
});

test("the return path rides along to the next sign-in screen only when it is valid", () => {
  assert.equal(withReturnPath("/verificar-acesso", "/abrir/x"), "/verificar-acesso?volta=/abrir/x");
  assert.equal(withReturnPath("/entrar?erro=acesso", "/apps/abc-123"), "/entrar?erro=acesso&volta=/apps/abc-123");
  assert.equal(withReturnPath("/verificar-acesso", "//evil.com"), "/verificar-acesso");
  assert.equal(withReturnPath("/verificar-acesso", null), "/verificar-acesso");
  assert.equal(
    withReturnPath("https://console.anuntech.com/verificar-acesso", "/abrir/x"),
    "https://console.anuntech.com/verificar-acesso?volta=/abrir/x",
  );
});

test("the return path is read back from a Google callbackURL on this origin only", () => {
  const origin = "https://console.anuntech.com";
  assert.equal(returnPathFromCallback("/abrir/x", origin), "/abrir/x");
  assert.equal(returnPathFromCallback(`${origin}/abrir/x`, origin), "/abrir/x");
  assert.equal(returnPathFromCallback(`${origin}/apps/abc`, `${origin}/`), "/apps/abc");
  for (const value of [
    "/painel",
    `${origin}/painel`,
    `${origin}/abrir/x?y`,
    "//evil.com/abrir/x",
    "https://evil.com/abrir/x",
    "https://console.anuntech.com.evil.com/abrir/x",
    "https://console.anuntech.com:8443/abrir/x",
    "http://console.anuntech.com/abrir/x",
    `${origin}//evil.com`,
    "",
    undefined,
    null,
  ])
    assert.equal(returnPathFromCallback(value, origin), null, String(value));
  assert.equal(returnPathFromCallback("https://x.test/abrir/x", ""), null);
});
