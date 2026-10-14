import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import {
  appById,
  appForUrl,
  appFrameSrc,
  appTenant,
  canOpenApp,
  chooseAppProduct,
  companyRole,
  decideAppOpening,
  protectedApps,
  type PassRole,
} from "../src/lib/apps/registry";
import {
  loadPassPrivateKey,
  passClaims,
  passClaimsProblem,
  PASS_ISSUER,
  PASS_TTL,
  publicJwk,
  signPass,
  type PassClaims,
  type PublicJwk,
} from "../src/lib/apps/pass-token";

const apps = protectedApps({});
const ALVITEK = "b0101b2f-4586-4533-964b-b3d8157b9378";

test("a product URL is an app only on the app's host and inside its protected entry", () => {
  const id = (url: string | null) => appForUrl(url, apps)?.id ?? null;
  assert.equal(id("https://www.espacoabsolut.com/admin"), "espaco-absolut-cms");
  assert.equal(id("https://www.espacoabsolut.com/admin/eventos?x=1"), "espaco-absolut-cms");
  assert.equal(id("https://espacoabsolut.com/admin/"), "espaco-absolut-cms");
  assert.equal(id("https://WWW.EspacoAbsolut.com/admin"), "espaco-absolut-cms");
  // The public site on the same host stays a plain link.
  assert.equal(id("https://www.espacoabsolut.com/"), null);
  assert.equal(id("https://www.espacoabsolut.com/agenda"), null);
  assert.equal(id("https://www.espacoabsolut.com/administrador"), null);
  assert.equal(id("https://mulheresfmanuntech.vercel.app/admin/posts"), "mulheresfm-cms");
  assert.equal(id("https://mulheresfm.com.br/admin"), "mulheresfm-cms");
  assert.equal(id("https://www.mulheresfm.com.br/"), null);
  // The whole app is protected when the entry is "/".
  assert.equal(id("https://brastemp-roteiro-digital.vercel.app/"), "brastemp-roteiro-digital");
  assert.equal(id("https://brastemp-roteiro-digital.vercel.app/rotas/12"), "brastemp-roteiro-digital");
  assert.equal(id("https://brastemp-base-pendente.vercel.app"), "brastemp-base-pendente");
  // Look-alike hosts, other schemes and junk never match.
  assert.equal(id("https://espacoabsolut.com.evil.test/admin"), null);
  assert.equal(id("https://evil.test/www.espacoabsolut.com/admin"), null);
  assert.equal(id("javascript:alert(1)//www.espacoabsolut.com/admin"), null);
  assert.equal(id("ftp://www.espacoabsolut.com/admin"), null);
  assert.equal(id("não é url"), null);
  assert.equal(id(""), null);
  assert.equal(id(null), null);
});

test("CONSOLE_APP_ORIGINS points an app at a local copy, never in Vercel production", () => {
  const env = { CONSOLE_APP_ORIGINS: JSON.stringify({ "espaco-absolut-cms": "http://localhost:4001/ignored", unknown: "http://localhost:1" }) };
  const local = protectedApps(env);
  const cms = local.find((app) => app.id === "espaco-absolut-cms")!;
  assert.equal(cms.origin, "http://localhost:4001");
  assert.ok(cms.hosts.includes("localhost:4001"));
  assert.ok(cms.hosts.includes("www.espacoabsolut.com"));
  assert.equal(appForUrl("http://localhost:4001/admin", local)?.id, "espaco-absolut-cms");
  assert.equal(appForUrl("http://localhost:4002/admin", local), null);
  // The constant registry is not changed by an override.
  assert.equal(protectedApps({}).find((app) => app.id === "espaco-absolut-cms")!.origin, "https://www.espacoabsolut.com");
  assert.equal(protectedApps({ ...env, VERCEL_ENV: "production" }).find((app) => app.id === "espaco-absolut-cms")!.origin, "https://www.espacoabsolut.com");
  for (const value of ["{", "[]", '"x"', JSON.stringify({ "espaco-absolut-cms": "javascript:alert(1)" })])
    assert.equal(protectedApps({ CONSOLE_APP_ORIGINS: value }).find((app) => app.id === "espaco-absolut-cms")!.origin, "https://www.espacoabsolut.com", value);
});

test("the team and Administrators open every app; Members only the apps meant for members", () => {
  const byRole = (role: PassRole) => apps.filter((app) => canOpenApp(role, app)).map((app) => app.id).sort();
  const all = apps.map((app) => app.id).sort();
  assert.deepEqual(byRole("staff"), all);
  assert.deepEqual(byRole("manager"), all);
  assert.deepEqual(byRole("member"), ["brastemp-base-pendente", "brastemp-roteiro-digital"]);
});

test("with two memberships in the same company, the pass carries the strongest role", () => {
  const grant = (id: string, role: "manager" | "member") => ({ company: { id }, role });
  // The order the database returns them in does not matter.
  assert.equal(companyRole([grant("a", "member"), grant("a", "manager")], "a"), "manager");
  assert.equal(companyRole([grant("a", "manager"), grant("a", "member")], "a"), "manager");
  assert.equal(companyRole([grant("a", "member"), grant("b", "manager")], "a"), "member");
  assert.equal(companyRole([grant("b", "manager")], "a"), null);
  assert.equal(companyRole([], "a"), null);
});

test("opening a product as an app checks kind, URL, status, role and tenant", () => {
  const product = (url: string, extra: Partial<{ kind: string; status: string; companyId: string }> = {}) => ({
    kind: "product",
    status: "active",
    companyId: "company-1",
    url,
    ...extra,
  });
  const cms = "https://www.espacoabsolut.com/admin";
  const base = "https://brastemp-base-pendente.vercel.app/";
  const blocked = (result: ReturnType<typeof decideAppOpening>) => ("blocked" in result ? result.blocked : null);
  assert.equal(blocked(decideAppOpening(product(cms), "manager", apps)), null);
  assert.equal(blocked(decideAppOpening(product(cms), "staff", apps)), null);
  assert.equal(blocked(decideAppOpening(product(cms), "member", apps)), "role");
  assert.equal(blocked(decideAppOpening(product("https://brastemp-roteiro-digital.vercel.app/"), "member", apps)), null);
  assert.equal(blocked(decideAppOpening(product(cms, { kind: "service" }), "manager", apps)), "not_product");
  assert.equal(blocked(decideAppOpening(product(cms, { status: "paused" }), "manager", apps)), "inactive");
  assert.equal(blocked(decideAppOpening(product(cms, { status: "completed" }), "staff", apps)), "inactive");
  assert.equal(blocked(decideAppOpening(product("https://www.espacoabsolut.com/"), "manager", apps)), "not_protected");
  // Base Pendente needs the company's tenant; the team does not get around it.
  assert.equal(blocked(decideAppOpening(product(base), "staff", apps)), "no_tenant");
  const alvitek = decideAppOpening(product(base, { companyId: ALVITEK }), "member", apps);
  assert.ok(!("blocked" in alvitek));
  assert.equal(alvitek.tenant, "dfbi2Hn3rypBVlFSpKdKAfMd5BjXYQoY");
  const cmsOpening = decideAppOpening(product(cms), "manager", apps);
  assert.ok(!("blocked" in cmsOpening) && cmsOpening.tenant === undefined);
  // An inherited property is not a tenant.
  assert.equal(appTenant({ tenants: {} }, "toString"), null);
});

test("a link to an app knows only the apps in the registry", () => {
  assert.equal(appById("espaco-absolut-cms", apps)?.name, "CMS Espaço Absolut");
  assert.equal(appById("brastemp-base-pendente", apps)?.id, "brastemp-base-pendente");
  for (const id of ["", "nao-existe", "ESPACO-ABSOLUT-CMS", "espaco-absolut-cms ", "toString", "__proto__"])
    assert.equal(appById(id, apps), null, id);
});

test("a link to an app opens the one product pointing at it, lists several, and refuses none", () => {
  const cms = appById("espaco-absolut-cms", apps)!;
  const product = (id: string, url: string | null, extra: Partial<{ kind: string; status: string }> = {}) => ({
    id,
    kind: "product",
    status: "active",
    url,
    ...extra,
  });
  // Exactly one: that product's page in the Console, which checks the role.
  assert.deepEqual(chooseAppProduct(cms, [product("p1", "https://www.espacoabsolut.com/admin")], apps), {
    kind: "one",
    id: "p1",
    href: "/apps/p1",
  });
  // Products that are not this app, not active, not a product, or the public site do not count.
  const noise = [
    product("site", "https://www.espacoabsolut.com/"),
    product("paused", "https://www.espacoabsolut.com/admin", { status: "paused" }),
    product("done", "https://espacoabsolut.com/admin", { status: "completed" }),
    product("service", "https://www.espacoabsolut.com/admin", { kind: "service" }),
    product("other-app", "https://www.mulheresfm.com.br/admin"),
    product("no-url", null),
    product("look-alike", "https://espacoabsolut.com.evil.test/admin"),
  ];
  assert.deepEqual(chooseAppProduct(cms, [...noise, product("p1", "https://espacoabsolut.com/admin/eventos")], apps), {
    kind: "one",
    id: "p1",
    href: "/apps/p1",
  });
  // The same product twice (two memberships) is still one.
  assert.equal(
    chooseAppProduct(cms, [product("p1", "https://www.espacoabsolut.com/admin"), product("p1", "https://www.espacoabsolut.com/admin")], apps).kind,
    "one",
  );
  // Several: the product list, searched by the app's name.
  assert.deepEqual(
    chooseAppProduct(cms, [product("p1", "https://www.espacoabsolut.com/admin"), product("p2", "https://espacoabsolut.com/admin")], apps),
    { kind: "many", href: "/produtos?q=CMS%20Espa%C3%A7o%20Absolut" },
  );
  // None: nothing that is this app, or nothing at all.
  assert.deepEqual(chooseAppProduct(cms, noise, apps), { kind: "none" });
  assert.deepEqual(chooseAppProduct(cms, [], apps), { kind: "none" });
});

test("the iframe opens the app's canonical entry with the pass", () => {
  const cms = apps.find((app) => app.id === "espaco-absolut-cms")!;
  const roteiro = apps.find((app) => app.id === "brastemp-roteiro-digital")!;
  assert.equal(appFrameSrc(cms, "a.b.c"), "https://www.espacoabsolut.com/admin?console_pass=a.b.c");
  assert.equal(appFrameSrc(roteiro, "a.b.c"), "https://brastemp-roteiro-digital.vercel.app/?console_pass=a.b.c");
});

// The app's side of the contract, written here to prove the round trip.
function verifyAsApp(token: string, jwks: { keys: PublicJwk[] }, aud: string, now = Math.floor(Date.now() / 1000)) {
  const [h, p, s] = token.split(".");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  if (header.alg !== "RS256" || header.typ !== "JWT") throw new Error("alg");
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = createPublicKey({ key: jwk, format: "jwk" });
  if (!verify("sha256", Buffer.from(`${h}.${p}`), key, Buffer.from(s, "base64url"))) throw new Error("assinatura");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString()) as PassClaims;
  if (claims.iss !== PASS_ISSUER || claims.aud !== aud) throw new Error("iss/aud");
  if (claims.exp < now - 30 || claims.nbf > now + 30) throw new Error("validade");
  if (!claims.sub || !claims.company) throw new Error("claims");
  return claims;
}

const rsa = (bits = 2048) => generateKeyPairSync("rsa", { modulusLength: bits }).privateKey;

test("a pass signed with the Console key verifies with the published JWK", () => {
  const key = { privateKey: rsa(), kid: "console-test-1" };
  const jwks = { keys: [publicJwk(key)] };
  assert.deepEqual(Object.keys(jwks.keys[0]).sort(), ["alg", "e", "kid", "kty", "n", "use"]);
  assert.equal(jwks.keys[0].alg, "RS256");
  assert.equal(jwks.keys[0].use, "sig");
  const now = Date.UTC(2026, 9, 13, 15, 0, 0);
  const claims = passClaims(
    {
      app: "brastemp-base-pendente",
      user: { id: "user-1", email: "pessoa@alvitek.test", name: "Pessoa" },
      company: ALVITEK,
      role: "member",
      tenant: "dfbi2Hn3rypBVlFSpKdKAfMd5BjXYQoY",
    },
    now,
  );
  assert.equal(claims.exp - claims.iat, PASS_TTL);
  assert.equal(claims.iat, now / 1000);
  assert.match(claims.jti, /^[0-9a-f-]{36}$/);
  const token = signPass(claims, key);
  const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  assert.deepEqual(header, { alg: "RS256", typ: "JWT", kid: "console-test-1" });
  const read = verifyAsApp(token, jwks, "brastemp-base-pendente", now / 1000);
  assert.deepEqual(read, claims);
  // Another app, another key or an expired pass are refused by the app.
  assert.throws(() => verifyAsApp(token, jwks, "espaco-absolut-cms", now / 1000), /iss\/aud/);
  assert.throws(() => verifyAsApp(token, { keys: [publicJwk({ privateKey: rsa(), kid: "console-test-1" })] }, "brastemp-base-pendente", now / 1000), /assinatura/);
  assert.throws(() => verifyAsApp(token, jwks, "brastemp-base-pendente", now / 1000 + PASS_TTL + 31), /validade/);
  // No tenant claim at all when the app does not use one.
  const cms = passClaims({ app: "espaco-absolut-cms", user: { id: "u", email: "e@x.test", name: "" }, company: "c", role: "manager" });
  assert.equal("tenant" in cms, false);
  assert.equal(verifyAsApp(signPass(cms, key), jwks, "espaco-absolut-cms").role, "manager");
});

test("the Console refuses to sign a pass with missing or odd claims", () => {
  const key = { privateKey: rsa(), kid: "k" };
  const good = passClaims({ app: "mulheresfm-cms", user: { id: "u", email: "e@x.test", name: "N" }, company: "c", role: "staff" });
  assert.equal(passClaimsProblem(good), null);
  const broken: [string, Partial<PassClaims>][] = [
    ["sub", { sub: "" }],
    ["company", { company: undefined }],
    ["aud", { aud: " " }],
    ["email", { email: "" }],
    ["jti", { jti: "" }],
    ["role", { role: "owner" as PassRole }],
    ["iss", { iss: "https://outro.test" }],
    ["tenant", { tenant: "" }],
    ["exp", { exp: good.iat + PASS_TTL + 1 }],
    ["exp", { exp: good.iat }],
    ["nbf", { nbf: undefined }],
  ];
  for (const [label, patch] of broken)
    assert.throws(() => signPass({ ...good, ...patch } as PassClaims, key), /Passe recusado/, label);
  assert.throws(() => signPass(good, { ...key, kid: "" }), /kid/);
});

test("the pass key loads from a base64 PKCS#8 PEM and must be RSA of 2048 bits or more", () => {
  const privateKey = rsa();
  const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const fromBase64 = loadPassPrivateKey(Buffer.from(pem).toString("base64"));
  assert.equal(fromBase64.asymmetricKeyType, "rsa");
  assert.equal(loadPassPrivateKey(pem).asymmetricKeyType, "rsa");
  const ec = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  assert.throws(() => loadPassPrivateKey(Buffer.from(ec).toString("base64")), /RSA/);
  const small = rsa(1024).export({ format: "pem", type: "pkcs8" }).toString();
  assert.throws(() => loadPassPrivateKey(Buffer.from(small).toString("base64")), /2048/);
  assert.throws(() => loadPassPrivateKey("bm90IGEga2V5"));
});
