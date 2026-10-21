import test from "node:test";
import assert from "node:assert/strict";
import { androidAssetLinks, appleAssociation, APP_LINK_PATHS } from "../src/lib/api/app-links";

test("the association files stay off until the store identifiers exist", () => {
  assert.equal(appleAssociation(undefined), null);
  assert.equal(appleAssociation("not-a-team"), null);
  assert.equal(androidAssetLinks(""), null);
  assert.equal(androidAssetLinks("AB:CD"), null);
});

test("they name the Console app and only the areas it shows", () => {
  const apple = appleAssociation("ABCDE12345")!;
  assert.deepEqual(apple.applinks.details[0].appIDs, ["ABCDE12345.com.anuntech.console"]);
  const fingerprint = Array.from({ length: 32 }, () => "ab").join(":");
  const android = androidAssetLinks(` ${fingerprint} `)!;
  assert.deepEqual(android[0].target.sha256_cert_fingerprints, [fingerprint.toUpperCase()]);
  for (const path of APP_LINK_PATHS)
    assert.ok(!/^\/(pagar|entrar|api|verificar-acesso)/.test(path), path);
});
