// The native app's API (/api/v1) and sign-in, called the way the app calls
// them: no browser, no Origin, the session cookie set by hand and the app's
// scheme in expo-origin. Runs in a disposable database (test-isolated).
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { settingsChecks } from "./api-smoke-settings.mjs";
import { pushChecks } from "./api-smoke-push.mjs";
import { ticketsChecks } from "./api-smoke-tickets.mjs";
import { helpChecks } from "./api-smoke-help.mjs";
import { financeChecks } from "./api-smoke-finance.mjs";
import { contractsChecks } from "./api-smoke-contracts.mjs";
import { projectsChecks } from "./api-smoke-projects.mjs";
import { bookmarksChecks } from "./api-smoke-bookmarks.mjs";
import { homeChecks } from "./api-smoke-home.mjs";
import { f8Checks } from "./api-smoke-f8.mjs";
import { lac5Checks } from "./api-smoke-lac5.mjs";
import { lac2Checks } from "./api-smoke-lac2.mjs";
import { lac4Checks } from "./api-smoke-lac4.mjs";
import { lac3Checks } from "./api-smoke-lac3.mjs";
import { lac1Checks } from "./api-smoke-lac1.mjs";
import { arquivosAppChecks } from "./api-smoke-arquivos-app.mjs";
import { arquivosCardsChecks } from "./api-smoke-arquivos-cards.mjs";
import { startR2Mock } from "./r2-mock.mjs";

assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /^\/console_test_[a-f0-9]+$/,
  "Use test-isolated; never run against customer data",
);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = "http://127.0.0.1:3107",
  marker = randomUUID();
const address = (name) => `api-${name}-${marker}@example.invalid`;
const owner = address("owner"),
  companies = { a: randomUUID(), b: randomUUID() },
  people = {},
  userIds = [];
const dir = mkdtempSync(join(tmpdir(), "console-api-test-")),
  capture = join(dir, "otp.jsonl");
const app = { "expo-origin": "anuntech://" };
let server,
  r2,
  count = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  count++;
  console.log("PASS", message);
};
const messages = () => {
  try {
    return readFileSync(capture, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  } catch {
    return [];
  }
};
const limits = async () => {
  await db.query("delete from console_otp_limits");
  await db.query("delete from console_rate_limit");
};
// What the app's cookie storage does: keep the latest value of each cookie.
function jar(previous, response) {
  const cookies = new Map(
    (previous || "").split("; ").filter(Boolean).map((pair) => [pair.split("=")[0], pair]),
  );
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";")[0];
    const [name, value] = [pair.split("=")[0], pair.slice(pair.indexOf("=") + 1)];
    if (value && !/max-age=0/i.test(header)) cookies.set(name, pair);
    else cookies.delete(name);
  }
  return [...cookies.values()].join("; ");
}
async function auth(path, body, cookie, headers = app) {
  const response = await fetch(`${base}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    headers: {
      ...headers,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
    cookie: jar(cookie, response),
  };
}
async function rpc(path, input, cookie, headers = {}) {
  const response = await fetch(`${base}/api/v1/${path.replaceAll(".", "/")}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: JSON.stringify(input === undefined ? {} : { json: input }),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body: body?.json ?? body };
}
async function makePerson(name, email, company, role = "manager") {
  const id = randomUUID();
  await db.query(
    "insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)",
    [id, `API ${name}`, email],
  );
  if (company)
    await db.query(
      "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)",
      [randomUUID(), company, email, role],
    );
  userIds.push(id);
  people[name] = { id, email };
}
async function emailSignIn(email, headers = app) {
  await limits();
  await auth("/email-otp/send-verification-otp", { email, type: "sign-in" });
  const code = messages().filter((m) => m.to === email).at(-1)?.code;
  return auth("/sign-in/email-otp", { email, otp: code }, undefined, headers);
}
const token = (n) => `ExponentPushToken[api${n}${marker.slice(0, 12)}]`;
// The Console's document hash (lib/document-hash.ts): SHA-256 of the JSON with the keys sorted.
const canonicalJson = (value) =>
  Array.isArray(value)
    ? value.map(canonicalJson)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]))
      : value;
const hashOf = (value) => createHash("sha256").update(JSON.stringify(canonicalJson(value))).digest("hex");
const device = async (value) =>
  (await db.query("select * from console_push_devices where token=$1", [value])).rows[0];

try {
  for (const [key, id] of Object.entries(companies))
    await db.query(
      "insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)",
      [id, `API ${key} ${marker}`, id.replaceAll("-", "").slice(0, 14), address(`company-${key}`)],
    );
  await makePerson("owner", owner, null);
  await makePerson("member", address("member"), companies.a);
  await makePerson("outsider", address("outsider"), companies.b, "member");
  await makePerson("guarded", address("guarded"), companies.a);
  await makePerson("profile", address("profile"), companies.a, "member");
  await db.query(
    "update console_user set phone_number='+5511988880001',phone_number_verified=true where id=$1",
    [people.guarded.id],
  );
  await db.query("update console_user set two_factor_enabled=true where id=$1", [people.guarded.id]);
  await db.query(
    "insert into console_two_factor(id,user_id,secret,backup_codes,verified) values($1,$2,'','',false)",
    [randomUUID(), people.guarded.id],
  );
  // Arquivos talks to a local stand-in for R2 (scripts/r2-mock.mjs), never to the real bucket in .env.local.
  r2 = await startR2Mock();
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3107"],
    {
      env: {
        ...process.env,
        CONSOLE_ADMIN_EMAIL: owner,
        BETTER_AUTH_URL: base,
        // The AI Gateway mock goes last so it wraps otp-mock's fetch (which refuses anything outside this Mac).
        // Blob is in memory (blob-mock answers @vercel/blob's undici calls), for the profile photo.
        NODE_OPTIONS: `--require=${process.cwd()}/scripts/blob-mock.cjs --require=${process.cwd()}/scripts/otp-mock.cjs --require=${process.cwd()}/scripts/ai-gateway-mock.cjs --require=${process.cwd()}/scripts/push-mock.cjs`,
        AI_GATEWAY_API_KEY: "test",
        CONSOLE_TEST_ASSISTANT_FILE: join(dir, "ai.jsonl"),
        CONSOLE_TEST_MODELS_FILE: `${process.cwd()}/scripts/fixtures/gateway-models.json`,
        CONSOLE_TEST_OTP_FILE: capture,
        // Invites and resends are read back by the settings checks.
        CONSOLE_TEST_MAIL_FILE: join(dir, "mail.jsonl"),
        // Expo push is answered by push-mock (last, so it wraps the others' fetch) and logged here.
        CONSOLE_TEST_PUSH_FILE: join(dir, "push.jsonl"),
        CRON_SECRET: "test-cron-secret",
        RESEND_API_KEY: "test",
        EMAIL_FROM: "Console <test@example.invalid>",
        FLW_SYNOVA: "test",
        FLW_SENDER_NUMBER: "5511000000000",
        FLW_OTP_TEMPLATE_ID: randomUUID(),
        R2_ENDPOINT: r2.endpoint,
        R2_ACCOUNT_ID: "",
        R2_BUCKET: "console-test",
        R2_ACCESS_KEY_ID: "test",
        R2_SECRET_ACCESS_KEY: "test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.resume();
  server.stderr.resume();
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++)
    try {
      await fetch(base + "/entrar");
      ready = true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  assert.ok(ready, "API test server starts");

  ok((await rpc("me.get")).status === 401, "The API refuses a call without a session");
  ok(
    (await rpc("nothing.here", {})).status === 404,
    "An unknown procedure answers 404",
  );
  ok(
    (await rpc("me.get", undefined, undefined, { "Sec-Fetch-Site": "cross-site" })).status === 403,
    "A browser on another site never reaches the API",
  );
  const proxy = await fetch(
    `${base}/api/auth/expo-authorization-proxy?authorizationURL=${encodeURIComponent("https://evil.example/x?state=1")}`,
    { redirect: "manual" },
  );
  ok(proxy.status === 400, "The Expo authorization proxy cannot redirect anywhere");

  // Sign-in as the app does it.
  let r = await emailSignIn(people.member.email, { ...app, "x-forwarded-for": "203.0.113.7" });
  ok(
    r.status === 200 && r.cookie.includes("session_token="),
    "The app signs in by e-mail code with its scheme and no Origin",
  );
  const member = r.cookie;
  const access = (
    await db.query(
      "select details from console_audit_events where actor_id=$1 and action='account.session.started' order by created_at desc limit 1",
      [people.member.id],
    )
  ).rows[0]?.details;
  ok(access?.ip === "203.0.113.7", "The sign-in record keeps the IP the Marco Civil asks for");
  r = await rpc("me.get", undefined, member);
  ok(
    r.status === 200 &&
      r.body.id === people.member.id &&
      !r.body.staff &&
      r.body.companies.length === 1 &&
      r.body.companies[0].id === companies.a &&
      r.body.companies[0].role === "manager",
    "me.get shows the person and only their company",
  );
  await limits();
  r = await auth(
    "/email-otp/send-verification-otp",
    { email: people.member.email, type: "sign-in" },
    undefined,
    { Origin: "https://evil.invalid" },
  );
  ok(r.status === 403, "Sign-in from an untrusted origin is refused");

  // Two-step verification, with only cookies and headers.
  r = await emailSignIn(people.guarded.email);
  ok(
    r.status === 200 && r.body.twoFactorRedirect && !r.body.token,
    "Two-step accounts get a challenge in the app too",
  );
  let pending = r.cookie;
  ok((await rpc("me.get", undefined, pending)).status === 401, "A pending challenge is not a session");
  await limits();
  r = await auth("/two-factor/send-otp", {}, pending);
  const second = messages().filter((m) => m.to === "+5511988880001").at(-1)?.code;
  ok(r.status === 200 && !!second, "The second code goes to the other contact");
  r = await auth("/two-factor/verify-otp", { code: second }, pending);
  pending = r.cookie;
  r = await rpc("me.get", undefined, pending);
  ok(r.status === 200 && r.body.id === people.guarded.id, "The second code opens the API");

  // The team: assisted access never applies to the app.
  r = await emailSignIn(owner);
  const staff = r.cookie;
  r = await rpc("me.get", undefined, `${staff}; console_assist=${companies.a}`);
  ok(
    r.status === 200 && r.body.staff && r.body.owner && r.body.companies.length === 0,
    "The API ignores the assisted-access cookie",
  );

  // Minha conta and Segurança: the web's rules and words, through the app's API.
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  const photo = (cookie, body, type = "image/png", headers = {}) =>
    fetch(`${base}/api/v1/conta/foto`, {
      method: "POST",
      headers: { ...(type ? { "Content-Type": type } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body,
    });
  const blobLog = () => {
    try {
      return readFileSync(join(dir, "ai.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter((e) => e.blob);
    } catch {
      return [];
    }
  };
  const imageOf = async (id) => (await db.query("select image from console_user where id=$1", [id])).rows[0]?.image;
  const catalog = /^\/brand\/avatars\/marca-\d{2}\.(svg|png)$/;
  let refused = true;
  for (const [path, input] of [
    ["profile.rename", { name: "Sem sessão" }],
    ["profile.avatars", undefined],
    ["profile.setAvatar", { image: "/brand/avatars/marca-01.svg" }],
    ["profile.removePhoto", undefined],
    ["profile.startEmailChange", { email: address("nobody") }],
    ["profile.confirmEmailChange", { challengeId: randomUUID(), sourceCode: "123456", targetCode: "123456" }],
    ["security.overview", undefined],
  ])
  {
    const status = (await rpc(path, input)).status;
    if (status !== 401) console.error(`  ${path} answered ${status} without a session`);
    refused &&= status === 401;
  }
  ok(refused, "Profile and security procedures need a session");
  r = await photo(undefined, tinyPng);
  ok(r.status === 401 && /no-store/.test(r.headers.get("cache-control") || ""), "The app's photo upload needs a session");
  r = await emailSignIn(people.profile.email, { ...app, "User-Agent": "AnuntechApp/1.0.0 (Android 15; Pixel 9)" });
  const profileOld = r.cookie;
  r = await emailSignIn(people.profile.email, { ...app, "User-Agent": "AnuntechApp/1.0.0 (iPhone; iOS 18.4)" });
  let profile = r.cookie;
  ok(r.status === 200 && profile !== profileOld, "The app signs in twice with its own user agent");
  ok(
    (await photo(profile, tinyPng, "image/png", { "Sec-Fetch-Site": "cross-site" })).status === 403,
    "A browser on another site never uploads a photo",
  );

  r = await rpc("me.get", undefined, profile);
  ok(
    r.status === 200 &&
      r.body.avatar?.kind === "initials" &&
      r.body.avatar.path === null &&
      r.body.twoFactorEnabled === false &&
      r.body.twoStepChannel === "whatsapp" &&
      r.body.recentSignIn === true &&
      r.body.managedCompanyId === null,
    "me.get brings the avatar, the two-step state and a recent sign-in",
  );
  r = await rpc("me.get", undefined, member);
  ok(r.status === 200 && r.body.managedCompanyId === companies.a, "me.get names the one company an Administrador manages");
  r = await rpc("me.get", undefined, staff);
  ok(r.status === 200 && r.body.managedCompanyId === null, "The team manages no single company in me.get");
  r = await rpc("me.get", undefined, pending);
  ok(r.status === 200 && r.body.twoFactorEnabled === true, "me.get shows two-step verification on");

  // Name.
  r = await rpc("profile.rename", { name: " A " }, profile);
  ok(r.status === 400 && r.body?.message === "Informe um nome entre 2 e 100 caracteres.", "profile.rename refuses a name under 2 characters");
  r = await rpc("profile.rename", { name: "x".repeat(101) }, profile);
  ok(r.status === 400 && r.body?.message === "Informe um nome entre 2 e 100 caracteres.", "profile.rename refuses a name over 100 characters");
  r = await rpc("profile.rename", { name: "  API Perfil Renomeado  " }, profile);
  ok(
    r.status === 200 &&
      r.body.message === "Nome atualizado." &&
      (await db.query("select name from console_user where id=$1", [people.profile.id])).rows[0]?.name === "API Perfil Renomeado",
    "profile.rename saves the trimmed name",
  );

  // Illustrations.
  r = await rpc("profile.avatars", undefined, profile);
  ok(
    r.status === 200 &&
      // 24 of the brand first, then the 89 illustrations.
      r.body.avatars.length === 48 &&
      r.body.avatars[0].image === "/brand/avatars/marca-01.svg" &&
      r.body.avatars.every((a) => catalog.test(a.image) && a.path === a.image && /^#[0-9A-F]{6}$/i.test(a.color)),
    "profile.avatars lists the catalog with each background",
  );
  refused = true;
  for (const image of ["/brand/avatars/avatar-90.svg", "/brand/avatars/avatar-05.svg", "/brand/avatars/../x.svg", "https://evil.invalid/a.png", "profile-avatars/x.webp"])
    refused &&=
      (r = await rpc("profile.setAvatar", { image }, profile)).status === 400 && r.body?.message === "Selecione um avatar válido.";
  ok(refused && (await imageOf(people.profile.id)) === null, "profile.setAvatar takes only the catalog's illustrations");
  r = await rpc("profile.setAvatar", { image: "/brand/avatars/marca-30.png" }, profile);
  ok(
    r.status === 200 &&
      r.body.message === "Avatar atualizado." &&
      r.body.avatar.kind === "illustration" &&
      r.body.avatar.path === "/brand/avatars/marca-30.png" &&
      /^#[0-9A-F]{6}$/i.test(r.body.avatar.color) &&
      (await imageOf(people.profile.id)) === "/brand/avatars/marca-30.png",
    "profile.setAvatar picks an illustration",
  );

  // Uploaded photo.
  r = await photo(profile, tinyPng, "image/gif");
  ok(r.status === 415 && (await r.json()).error === "Use uma imagem PNG, JPEG ou WebP.", "The photo route refuses another type");
  r = await photo(profile, Buffer.from("not an image at all"), "image/png");
  ok(r.status === 422 && (await r.json()).error === "O arquivo não é uma imagem válida.", "The photo route refuses a file that is not the image it says");
  r = await photo(profile, Buffer.alloc(0));
  ok(r.status === 400 && (await r.json()).error === "Selecione uma foto para enviar.", "The photo route refuses an empty upload");
  r = await photo(profile, Buffer.alloc(20 * 1024 * 1024 + 1));
  ok(r.status === 413 && (await r.json()).error === "A foto deve ter até 20 MB.", "The photo route refuses more than 20 MB");
  ok(
    (await imageOf(people.profile.id)) === "/brand/avatars/marca-30.png",
    "A refused photo leaves the picture as it was",
  );
  r = await photo(profile, tinyPng);
  const body = await r.json();
  const uploaded = await imageOf(people.profile.id);
  const photoPath = body.avatar?.path;
  ok(
    r.status === 200 &&
      /no-store/.test(r.headers.get("cache-control") || "") &&
      body.message === "Foto de perfil atualizada." &&
      body.avatar.kind === "photo" &&
      body.avatar.color === null &&
      /^\/api\/conta\/foto\?v=[a-f0-9-]{36}\.webp$/.test(photoPath) &&
      /^profile-avatars\/[a-f0-9]{64}\/[a-f0-9-]{36}\.webp$/.test(uploaded || "") &&
      uploaded.endsWith(photoPath.slice(photoPath.indexOf("=") + 1)),
    "The app uploads a photo by its session, without Origin",
  );
  r = await fetch(`${base}${photoPath}`, { headers: { Cookie: profile } });
  ok(r.status === 200 && r.headers.get("content-type") === "image/webp", "The app reads its photo with the session cookie");
  r = await rpc("me.get", undefined, profile);
  ok(r.status === 200 && r.body.avatar.kind === "photo" && r.body.avatar.path === photoPath, "me.get shows the uploaded photo by its private route");
  r = await fetch(`${base}/api/conta/foto`, { method: "POST", headers: { Cookie: profile, "Content-Type": "image/png" }, body: tinyPng });
  ok(r.status === 403, "The web's photo route still takes only the Console's own pages");
  r = await rpc("profile.removePhoto", undefined, profile);
  const removedImage = await imageOf(people.profile.id);
  ok(
    r.status === 200 &&
      r.body.message === "Foto removida." &&
      r.body.avatar.kind === "illustration" &&
      catalog.test(r.body.avatar.path) &&
      removedImage === r.body.avatar.path &&
      blobLog().some((e) => e.blob === "delete" && e.pathname === uploaded),
    "profile.removePhoto goes back to an illustration and deletes the stored photo",
  );

  // Security overview.
  await db.query("delete from console_session where user_id=$1 and user_agent like '%Android%'", [people.profile.id]);
  r = await rpc("security.overview", undefined, profile);
  const [here, ended] = [r.body?.sessions?.[0], r.body?.sessions?.find((s) => s.status === "ended")];
  ok(
    r.status === 200 &&
      r.body.twoFactorEnabled === false &&
      r.body.channel === "whatsapp" &&
      r.body.phone === null &&
      here?.status === "current" &&
      here.statusLabel === "Esta sessão" &&
      here.device === "App Anuntech · iPhone" &&
      !!here.expiresAt,
    "security.overview shows this session as the app on an iPhone",
  );
  ok(
    ended?.statusLabel === "Encerrada" && ended.device === "App Anuntech · Android" && ended.expiresAt === null,
    "security.overview keeps an ended session from the sign-in record",
  );
  ok(
    r.body.sessions.every((s) => !("token" in s) && !("ipAddress" in s) && !("ip" in s)),
    "security.overview never shows a token or an IP",
  );
  r = await rpc("security.overview", undefined, pending);
  ok(
    r.status === 200 && r.body.twoFactorEnabled === true && r.body.phone === "+5511988880001",
    "security.overview shows two-step verification and the verified WhatsApp",
  );

  // Main e-mail.
  const newEmail = address("profile-new");
  await limits();
  r = await rpc("profile.startEmailChange", { email: address("guarded-new") }, pending);
  ok(
    r.status === 400 && r.body?.message === "Desative a verificação em duas etapas antes de alterar os contatos de acesso.",
    "profile.startEmailChange refuses while two-step verification is on",
  );
  r = await rpc("profile.startEmailChange", { email: "não é e-mail" }, profile);
  ok(r.status === 400 && r.body?.message === "Informe um e-mail válido.", "profile.startEmailChange refuses an invalid address");
  r = await rpc("profile.startEmailChange", { email: people.profile.email.toUpperCase() }, profile);
  ok(r.status === 400 && r.body?.message === "Este já é seu e-mail principal.", "profile.startEmailChange refuses the current address");
  r = await rpc("profile.startEmailChange", { email: people.member.email }, profile);
  ok(
    r.status === 400 && r.body?.message === "Este e-mail não está disponível para esta conta.",
    "profile.startEmailChange refuses another account's address",
  );
  await db.query("update console_session set created_at=now()-interval '11 minutes' where user_id=$1", [people.profile.id]);
  r = await rpc("profile.startEmailChange", { email: newEmail }, profile);
  const stale = await rpc("me.get", undefined, profile);
  ok(
    r.status === 401 &&
      r.body?.message === "Entre novamente para alterar os dados de acesso da sua conta." &&
      stale.status === 200 &&
      stale.body.recentSignIn === false,
    "profile.startEmailChange needs a sign-in less than 10 minutes old",
  );
  await db.query("update console_session set created_at=now() where user_id=$1", [people.profile.id]);
  await limits();
  r = await rpc("profile.startEmailChange", { email: newEmail }, profile);
  const sourceCode = messages().filter((m) => m.to === people.profile.email).at(-1)?.code;
  const targetCode = messages().filter((m) => m.to === newEmail).at(-1)?.code;
  const emailChallenge = r.body?.challengeId;
  ok(
    r.status === 200 && !!emailChallenge && r.body.email === newEmail && !!r.body.message && !!sourceCode && !!targetCode,
    "profile.startEmailChange sends a code to each address",
  );
  const wrong = String((Number(targetCode) + 1) % 1e6).padStart(6, "0");
  r = await rpc("profile.confirmEmailChange", { challengeId: emailChallenge, sourceCode, targetCode: wrong }, profile);
  ok(
    r.status === 400 && r.body?.message === "Confira os dois códigos recebidos. Eles valem por 5 minutos.",
    "profile.confirmEmailChange refuses a wrong code",
  );
  const memberFresh = (await emailSignIn(people.member.email)).cookie;
  r = await rpc("profile.confirmEmailChange", { challengeId: emailChallenge, sourceCode, targetCode }, memberFresh);
  ok(
    r.status === 400 && r.body?.message === "Esta solicitação não pertence à sua sessão.",
    "Another person's session cannot confirm the change",
  );
  r = await rpc("profile.confirmEmailChange", { challengeId: emailChallenge, sourceCode, targetCode }, profile);
  const changed = (await db.query("select email from console_user where id=$1", [people.profile.id])).rows[0];
  const audited = await db.query(
    "select 1 from console_audit_events where actor_id=$1 and action='account.email.primary_changed'",
    [people.profile.id],
  );
  ok(
    r.status === 200 &&
      r.body.message === "E-mail principal atualizado. Entre novamente com o novo endereço." &&
      changed?.email === newEmail &&
      audited.rowCount === 1,
    "profile.confirmEmailChange moves the main e-mail and records it",
  );
  ok(
    (await rpc("me.get", undefined, profile)).status === 401 &&
      Number((await db.query("select count(*) from console_session where user_id=$1", [people.profile.id])).rows[0].count) === 0,
    "Confirming the new e-mail ends every session, this one too",
  );
  r = await emailSignIn(newEmail);
  profile = r.cookie;
  r = await rpc("me.get", undefined, profile);
  ok(r.status === 200 && r.body.email === newEmail, "The app signs in again with the new address");

  // Tickets: the same rules as /chamados, through the app's API.
  r = await emailSignIn(people.outsider.email);
  const outsiderEarly = r.cookie;
  r = await rpc("tickets.choices", {}, member);
  ok(
    r.status === 200 &&
      r.body.companies.length === 1 &&
      r.body.companies[0].id === companies.a &&
      r.body.kinds.some((k) => k.value === "problem" && k.label),
    "Ticket choices list only the person's companies, with the kinds' labels",
  );
  ok(
    (await rpc("tickets.create", { companyId: companies.b, kind: "question", subject: "x", body: "y" }, member)).status === 404,
    "Nobody opens a ticket for another company",
  );
  r = await rpc(
    "tickets.create",
    { companyId: companies.a, kind: "problem", impact: "workaround", subject: `App ticket ${marker}`, body: "Aberto pelo app." },
    member,
  );
  const ticketId = r.body?.id;
  const [opened] = (await db.query("select * from console_tickets where id=$1", [ticketId ?? randomUUID()])).rows;
  ok(
    r.status === 200 && opened?.company_id === companies.a && opened.channel === "console" && opened.author_id === people.member.id,
    "A client opens a ticket from the app",
  );
  r = await rpc("tickets.list", { status: "all" }, member);
  const listed = r.body?.rows?.find((row) => row.id === ticketId);
  ok(
    r.status === 200 && listed?.statusLabel === "Aguardando atendimento" && listed.assignee === null,
    "The app's list shows the ticket without the team's assignee",
  );
  r = await rpc("tickets.list", { status: "all" }, outsiderEarly);
  ok(r.status === 200 && !r.body.rows.some((row) => row.id === ticketId), "Another company's ticket stays out of the list");
  ok((await rpc("tickets.get", { id: ticketId }, outsiderEarly)).status === 404, "Another company's ticket answers 404");
  ok((await rpc("tickets.get", { id: randomUUID() }, member)).status === 404, "An unknown ticket answers 404");
  r = await rpc("tickets.get", { id: ticketId }, member);
  ok(
    r.status === 200 &&
      r.body.entries.length === 1 &&
      r.body.entries[0].kind === "message" &&
      r.body.entries[0].mine &&
      r.body.canReply,
    "The ticket opens with its first message, marked as the person's",
  );
  ok(
    (await rpc("tickets.reply", { id: ticketId, body: "Intruso" }, outsiderEarly)).status === 404,
    "Nobody replies on another company's ticket",
  );
  r = await rpc("tickets.reply", { id: ticketId, body: "Mais detalhes pelo app." }, member);
  ok(
    r.status === 200 &&
      Number((await db.query("select count(*) from console_messages where ticket_id=$1", [ticketId])).rows[0].count) === 2,
    "A reply from the app joins the conversation",
  );
  r = await rpc("tickets.get", { id: ticketId }, staff);
  ok(r.status === 200 && r.body.entries.length === 2, "The team opens any ticket");
  await db.query("update console_tickets set status='closed' where id=$1", [ticketId]);
  r = await rpc("tickets.reply", { id: ticketId, body: "Depois de encerrado" }, member);
  ok(r.status === 400 && /encerrado/.test(r.body?.message ?? ""), "A closed ticket refuses replies with the reason");
  await db.query("delete from console_ticket_notices where ticket_id=$1", [ticketId]).catch(() => undefined);
  await db.query("delete from console_messages where ticket_id=$1", [ticketId]);
  await db.query("delete from console_tickets where id=$1", [ticketId]);

  // Finance and overview: the web's rules, through the app's API.
  const publicId = "p".repeat(31) + marker.replaceAll("-", "").slice(0, 12);
  const invoice = (company, status, values = {}) => {
    const id = randomUUID();
    return db
      .query(
        "insert into console_invoices(id,company_id,description,amount_cents,due_date,status,public_id,public_enabled,pix_copy_paste,boleto_line) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [id, company, `API ${status} ${marker}`, 12345, values.due ?? "2099-01-10", status, values.publicId ?? null, !!values.publicId, values.pix ?? null, values.line ?? null],
      )
      .then(() => id);
  };
  const ownIssued = await invoice(companies.a, "issued", { publicId, pix: "00020126PIXCOPIAECOLA", line: "23790.00000 00000.000000 00000.000000 0 00000000000000" });
  const ownOverdue = await invoice(companies.a, "issued", { due: "2020-01-10" });
  const ownDraft = await invoice(companies.a, "draft");
  const otherIssued = await invoice(companies.b, "issued");
  r = await rpc("finance.list", {}, member);
  ok(
    r.status === 200 &&
      r.body.rows.some((row) => row.id === ownIssued && row.statusLabel === "Em aberto" && row.payPath === `/pagar/${publicId}`) &&
      r.body.rows.some((row) => row.id === ownOverdue && row.display === "overdue") &&
      !r.body.rows.some((row) => row.id === ownDraft || row.id === otherIssued),
    "An Administrador lists the company's invoices, never drafts or another company's",
  );
  r = await rpc("finance.list", {}, outsiderEarly);
  ok(r.status === 200 && r.body.rows.length === 0, "A Membro sees no invoices");
  ok((await rpc("finance.get", { id: ownDraft }, member)).status === 404, "A draft answers 404 to the client");
  ok((await rpc("finance.get", { id: otherIssued }, member)).status === 404, "Another company's invoice answers 404");
  ok((await rpc("finance.get", { id: ownIssued }, outsiderEarly)).status === 404, "A Membro opens no invoice");
  r = await rpc("finance.get", { id: ownIssued }, member);
  ok(
    r.status === 200 &&
      r.body.pix === "00020126PIXCOPIAECOLA" &&
      r.body.boletoPath === `/pagar/${publicId}/boleto` &&
      r.body.amountCents === 12345,
    "The invoice brings Pix copia e cola and the boleto",
  );
  r = await rpc("finance.list", { status: "all" }, staff);
  ok(r.status === 200 && r.body.rows.some((row) => row.id === otherIssued), "The team lists every company's invoices");
  r = await rpc("overview.get", {}, member);
  ok(
    r.status === 200 && r.body.canFinance && r.body.toPay[0]?.id === ownOverdue && r.body.toPay.some((row) => row.id === ownIssued),
    "The start screen shows what is due, overdue first",
  );
  r = await rpc("overview.get", {}, outsiderEarly);
  ok(r.status === 200 && !r.body.canFinance && r.body.toPay.length === 0, "A Membro's start screen has no money");
  await db.query("delete from console_invoices where id=any($1::text[])", [[ownIssued, ownOverdue, ownDraft, otherIssued]]);

  // Projects, contracts, quotes and bookmarks: the web's rules, through the app's API.
  const projectA = randomUUID(), projectB = randomUUID(), taskA = randomUUID();
  for (const [id, company, name] of [[projectA, companies.a, `API project A ${marker}`], [projectB, companies.b, `API project B ${marker}`]])
    await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'project')", [id, company, name]);
  await db.query(
    "insert into console_tasks(id,engagement_id,company_id,title,status,created_by) values($1,$2,$3,'Revisar a home','review',$4)",
    [taskA, projectA, companies.a, people.owner.id],
  );
  r = await rpc("projects.list", {}, member);
  ok(
    r.status === 200 && r.body.rows.some((p) => p.id === projectA && p.tasks.total === 1) && !r.body.rows.some((p) => p.id === projectB),
    "Projects list the company's projects with their progress, never another company's",
  );
  r = await rpc("projects.get", { id: projectA }, member);
  ok(
    r.status === 200 && r.body.columns.find((c) => c.status === "review")?.tasks[0]?.title === "Revisar a home",
    "A project opens as its board, column by column",
  );
  ok((await rpc("projects.get", { id: projectB }, member)).status === 404, "Another company's project answers 404");
  const contractSent = randomUUID(), contractDraft = randomUUID();
  await db.query(
    "insert into console_contracts(id,company_id,title,body,author_id,status,published_at,published_version,publication,document_hash) values($1,$2,'Rascunho interno','x',$3,'sent',now(),1,$4,'h1')",
    [contractSent, companies.a, people.owner.id, JSON.stringify({ title: "Contrato de manutenção", body: "Cláusula 1. O site.", companyName: "A", companyDocument: "0" })],
  );
  await db.query("insert into console_contracts(id,company_id,title,body,author_id) values($1,$2,'Rascunho','y',$3)", [contractDraft, companies.a, people.owner.id]);
  r = await rpc("contracts.list", {}, member);
  ok(
    r.status === 200 && r.body.rows.some((c) => c.id === contractSent && c.title === "Rascunho interno") && !r.body.rows.some((c) => c.id === contractDraft),
    "An Administrador lists the contracts that went out, never drafts",
  );
  r = await rpc("contracts.get", { id: contractSent }, member);
  ok(
    r.status === 200 && r.body.title === "Contrato de manutenção" && r.body.body === "Cláusula 1. O site." && r.body.pdfPath === `/api/contratos/${contractSent}/pdf`,
    "A contract opens with the text that was sent and its PDF",
  );
  ok((await rpc("contracts.get", { id: contractDraft }, member)).status === 404, "A draft contract answers 404 to the client");
  ok(
    (await rpc("contracts.list", {}, outsiderEarly)).body?.rows?.length === 0 && (await rpc("contracts.get", { id: contractSent }, outsiderEarly)).status === 404,
    "A Membro sees no contracts",
  );
  const quoteSent = randomUUID();
  await db.query(
    `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash)
     values($1,$2,2097,$3,'Site novo',$4,$5,'sent',1,'2099-01-01',now(),$6,'q1')`,
    [
      quoteSent,
      companies.a,
      Math.floor(Math.random() * 1e6),
      JSON.stringify({ summary: "", stack: [], phases: [], hourlyRateCents: 0, discountCents: 0, upfrontPercent: 50, notes: "" }),
      people.owner.id,
      JSON.stringify({ number: "2097-001", title: "Site novo", companyName: "A", companyDocument: "0", validUntil: "2099-01-01", summary: "", stack: [], phases: [{ name: "Fase 1", description: "", hoursMin: 10, hoursMax: 20, tasks: [] }], hourlyRateCents: 15000, discountCents: 0, upfrontPercent: 50, notes: "" }),
    ],
  );
  r = await rpc("quotes.list", {}, member);
  ok(r.status === 200 && r.body.rows.some((q) => q.id === quoteSent && q.statusLabel), "An Administrador lists the quotes that went out");
  r = await rpc("quotes.get", { id: quoteSent }, member);
  ok(r.status === 200 && r.body.number === "2097-001" && r.body.hoursMin === 10 && r.body.pdfPath === `/api/orcamentos/${quoteSent}/pdf`, "A quote opens with its figures and PDF");
  ok((await rpc("quotes.get", { id: quoteSent }, outsiderEarly)).status === 404, "A Membro opens no quote");

  // Deciding from the app: signing a contract, answering a quote, reviewing a delivery. The web's
  // rules, messages and evidence; the person's own session (opened with a code) is the proof.
  await makePerson("viewer", address("viewer"), companies.a, "member");
  const viewer = (await emailSignIn(people.viewer.email)).cookie;
  const phone = { "User-Agent": "AnuntechApp/1.0.0 (iPhone; iOS 18.4)", "x-forwarded-for": "198.51.100.23, 10.0.0.1" };
  const mails = () => {
    try {
      return readFileSync(join(dir, "mail.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
    } catch {
      return [];
    }
  };
  const taskA2 = randomUUID(), taskB = randomUUID();
  await db.query(
    "insert into console_tasks(id,engagement_id,company_id,title,status,created_by,review_since) values($1,$2,$3,'Formulário de contato','review',$4,now()),($5,$6,$7,'Entrega de outra empresa','review',$4,now())",
    [taskA2, projectA, companies.a, people.owner.id, taskB, projectB, companies.b],
  );
  const signable = randomUUID(), foreignContract = randomUUID();
  const contractText = (key) => ({
    title: "Contrato de suporte",
    body: "CLÁUSULA 1 — OBJETO\n1.1. Suporte mensal ao site.",
    companyName: `API ${key} ${marker}`,
    companyDocument: "12345678000190",
    kind: "contract",
    version: 1,
  });
  for (const [id, company, key] of [[signable, companies.a, "a"], [foreignContract, companies.b, "b"]]) {
    const publication = contractText(key);
    await db.query(
      "insert into console_contracts(id,company_id,title,body,author_id,status,published_at,published_version,publication,document_hash) values($1,$2,'Contrato de suporte',$3,$4,'sent',now(),1,$5,$6)",
      [id, company, publication.body, people.owner.id, JSON.stringify(publication), hashOf(publication)],
    );
  }
  const quoteAccept = randomUUID(), quoteDecline = randomUUID(), quoteLapsed = randomUUID(), foreignQuote = randomUUID();
  const proposal = (number, title, validUntil) => ({
    number,
    title,
    companyName: "A",
    companyDocument: "0",
    validUntil,
    version: 1,
    summary: "Um site novo para a empresa.",
    stack: ["Next.js"],
    phases: [{ name: "Descoberta", description: "Entender o negócio.", hoursMin: 10, hoursMax: 20, tasks: [{ title: "Reunião de descoberta", description: "" }] }],
    hourlyRateCents: 15000,
    discountCents: 0,
    upfrontPercent: 40,
    notes: "Estimativa de esforço.",
  });
  const quoteFixtures = [
    [quoteAccept, companies.a, proposal("2098-001", "Site do app", "2099-01-01")],
    [quoteDecline, companies.a, proposal("2098-002", "Loja do app", "2099-01-01")],
    [quoteLapsed, companies.a, proposal("2098-003", "Proposta vencida", "2020-01-01")],
    [foreignQuote, companies.b, proposal("2098-004", "Outra empresa", "2099-01-01")],
  ];
  const firstSeq = Math.floor(Math.random() * 1e6);
  for (const [index, [id, company, publication]] of quoteFixtures.entries()) {
    const { title, validUntil } = publication;
    // What the editor saved: the publication without what names it.
    const content = Object.fromEntries(
      ["summary", "stack", "phases", "hourlyRateCents", "discountCents", "upfrontPercent", "notes"].map((key) => [key, publication[key]]),
    );
    await db.query(
      `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash)
       values($1,$2,2098,$3,$4,$5,$6,'sent',1,$7,now(),$8,$9)`,
      [id, company, firstSeq + index, title, JSON.stringify(content), people.owner.id, validUntil, JSON.stringify(publication), hashOf(publication)],
    );
  }

  // Deliveries in Revisão.
  const canReview = async (cookie) => (await rpc("projects.get", { id: projectA }, cookie)).body?.canReview;
  ok(
    (await canReview(member)) === true && (await canReview(viewer)) === false && (await canReview(staff)) === false,
    "projects.get: only the company's Administrador reviews deliveries",
  );
  const taskRow = async (id) => (await db.query("select * from console_tasks where id=$1", [id])).rows[0];
  const onlyAdministrators = "Só um Administrador da empresa aprova entregas.";
  r = await rpc("projects.reviewTask", { id: taskA, decision: "approve" }, viewer);
  ok(
    r.status === 400 && r.body?.message === onlyAdministrators && (await taskRow(taskA)).status === "review",
    "projects.reviewTask: a Membro cannot approve a delivery",
  );
  r = await rpc("projects.reviewTask", { id: taskA, decision: "approve" }, staff);
  ok(
    r.status === 400 && r.body?.message === onlyAdministrators && (await taskRow(taskA)).status === "review",
    "projects.reviewTask: the team cannot approve a delivery for the client",
  );
  ok(
    (await rpc("projects.reviewTask", { id: taskB, decision: "approve" }, member)).status === 404 &&
      (await rpc("projects.reviewTask", { id: randomUUID(), decision: "approve" }, member)).status === 404 &&
      (await taskRow(taskB)).status === "review",
    "projects.reviewTask: another company's delivery answers 404",
  );
  r = await rpc("projects.reviewTask", { id: taskA, decision: "approve" }, member);
  let reviewed = await taskRow(taskA);
  ok(
    r.status === 200 &&
      r.body.message === "Entrega aprovada." &&
      reviewed.status === "done" &&
      reviewed.approved_by === people.member.id &&
      !!reviewed.approved_at &&
      (await db.query("select 1 from console_audit_events where entity_id=$1 and action='task.approved' and actor_id=$2", [taskA, people.member.id])).rowCount === 1,
    "projects.reviewTask: the Administrador approves a delivery from the app",
  );
  r = await rpc("projects.reviewTask", { id: taskA, decision: "approve" }, member);
  ok(r.status === 400 && r.body?.message === "Esta tarefa não está mais em Revisão.", "projects.reviewTask: an approved delivery takes no second answer");
  const noNote = [
    await rpc("projects.reviewTask", { id: taskA2, decision: "problem" }, member),
    await rpc("projects.reviewTask", { id: taskA2, decision: "problem", note: "   " }, member),
  ];
  ok(
    noNote.every((res) => res.status === 400 && res.body?.message === "Conte o que não funcionou como esperado.") && (await taskRow(taskA2)).status === "review",
    "projects.reviewTask: sending a delivery back needs a note",
  );
  r = await rpc("projects.reviewTask", { id: taskA2, decision: "problem", note: "O formulário não envia." }, member);
  reviewed = await taskRow(taskA2);
  const problemComment = (await db.query("select body from console_task_comments where task_id=$1", [taskA2])).rows[0];
  ok(
    r.status === 200 &&
      r.body.message === "Problema enviado à equipe." &&
      reviewed.status === "in_progress" &&
      !reviewed.approved_by &&
      problemComment?.body === "Encontrei um problema: O formulário não envia." &&
      mails().some((m) => m.to === owner && m.subject === "[Console] Problema apontado numa entrega: Formulário de contato"),
    "projects.reviewTask: the Administrador sends a delivery back with a note, and the team hears it",
  );

  // Contracts and quotes: who may decide.
  ok(
    (await rpc("contracts.sign", { id: signable, consent: true }, viewer)).status === 404 &&
      (await rpc("quotes.answer", { id: quoteAccept, decision: "accept", consent: true }, viewer)).status === 404,
    "contracts.sign and quotes.answer: a Membro neither signs nor answers",
  );
  ok(
    (await rpc("contracts.sign", { id: foreignContract, consent: true }, member)).status === 404 &&
      (await rpc("quotes.answer", { id: foreignQuote, decision: "accept", consent: true }, member)).status === 404 &&
      (await rpc("contracts.sign", { id: contractDraft, consent: true }, member)).status === 404,
    "contracts.sign and quotes.answer: another company's contract or quote, or a draft, answers 404",
  );

  // Signing.
  const signableHash = hashOf(contractText("a"));
  r = await rpc("contracts.get", { id: signable }, member);
  const staffContract = await rpc("contracts.get", { id: signable }, staff);
  ok(
    r.status === 200 &&
      r.body.documentHash === signableHash &&
      r.body.version === 1 &&
      r.body.companyDocument === companies.a.replaceAll("-", "").slice(0, 14) &&
      r.body.party === "client" &&
      r.body.canSign === true &&
      staffContract.body?.party === "anuntech" &&
      staffContract.body.canSign === true,
    "contracts.get: a contract waiting for signatures shows its hash, version and who signs it",
  );
  ok((await rpc("contracts.sign", { id: signable, consent: false }, member)).status === 400, "contracts.sign: signing needs the consent");
  r = await rpc("contracts.sign", { id: signable, consent: true }, member, phone);
  const [signature] = (await db.query("select * from console_contract_signatures where contract_id=$1", [signable])).rows;
  ok(
    r.status === 200 &&
      r.body.message === "Sua assinatura foi registrada. Falta a assinatura da Anuntech." &&
      r.body.signed === false &&
      signature?.party === "client" &&
      signature.user_id === people.member.id &&
      signature.document_hash === signableHash &&
      signature.method === "otp_session" &&
      signature.user_agent === phone["User-Agent"] &&
      signature.ip === "198.51.100.23" &&
      !!signature.session_started_at,
    "contracts.sign: the Administrador signs with the session, the IP and the app's user agent on record",
  );
  ok(
    mails().some((m) => m.to === owner && m.subject.startsWith("[Console] Contrato assinado pelo cliente: falta a Anuntech")),
    "contracts.sign: the team hears the client signed",
  );
  r = await rpc("contracts.sign", { id: signable, consent: true }, member, phone);
  ok(
    r.status === 400 &&
      r.body?.message === "Esta parte já assinou esta versão do contrato." &&
      (await rpc("contracts.get", { id: signable }, member)).body?.canSign === false &&
      (await db.query("select 1 from console_contract_signatures where contract_id=$1", [signable])).rowCount === 1,
    "contracts.sign: the same side cannot sign the same version twice",
  );
  r = await rpc("contracts.sign", { id: signable, consent: true }, staff);
  const closedContract = (await db.query("select status, signed_pdf is not null as pdf from console_contracts where id=$1", [signable])).rows[0];
  ok(
    r.status === 200 &&
      r.body.signed === true &&
      r.body.message === "Contrato assinado pelas duas partes. O PDF final já está disponível." &&
      closedContract?.status === "signed" &&
      closedContract.pdf === true,
    "contracts.sign: the second side's signature closes the contract with the final PDF",
  );
  // The client's notice goes out after the response (after()); wait for it before cleaning up.
  let notified = false;
  for (let i = 0; i < 50 && !notified; i++) {
    notified = (await db.query("select 1 from console_audit_events where entity_id=$1 and action='contract.signed_notice_sent'", [signable])).rowCount > 0;
    if (!notified) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  ok(
    notified && mails().some((m) => m.to === people.member.email && m.subject === "Contrato assinado: Contrato de suporte"),
    "contracts.sign: closing the contract sends the client the final PDF's notice",
  );

  // Answering quotes.
  r = await rpc("quotes.get", { id: quoteAccept }, member);
  const staffQuote = await rpc("quotes.get", { id: quoteAccept }, staff);
  ok(
    r.status === 200 &&
      r.body.summary === "Um site novo para a empresa." &&
      r.body.phases.length === 1 &&
      r.body.phases[0].name === "Descoberta" &&
      r.body.phases[0].hoursMax === 20 &&
      r.body.phases[0].tasks.length === 1 &&
      r.body.phases[0].tasks[0]?.title === "Reunião de descoberta" &&
      r.body.notes === "Estimativa de esforço." &&
      r.body.upfrontPercent === 40 &&
      r.body.documentHash === hashOf(quoteFixtures[0][2]) &&
      r.body.version === 1 &&
      r.body.expired === false &&
      r.body.canAnswer === true &&
      staffQuote.body?.canAnswer === false,
    "quotes.get: a quote waiting for an answer brings the proposal as it was sent",
  );
  r = await rpc("quotes.get", { id: quoteLapsed }, member);
  const lapsed = await rpc("quotes.answer", { id: quoteLapsed, decision: "accept", consent: true }, member);
  ok(
    r.body?.expired === true &&
      r.body.canAnswer === false &&
      lapsed.status === 400 &&
      lapsed.body?.message === "Este orçamento expirou. Peça à Anuntech uma nova versão com validade atualizada.",
    "quotes.answer: an expired quote cannot be accepted",
  );
  const quoteRow = async (id) => (await db.query("select * from console_quotes where id=$1", [id])).rows[0];
  r = await rpc("quotes.answer", { id: quoteAccept, decision: "accept" }, member, phone);
  ok(
    r.status === 400 && r.body?.message === "Marque que leu e concorda com a proposta para aceitar." && (await quoteRow(quoteAccept)).status === "sent",
    "quotes.answer: accepting needs the consent",
  );
  r = await rpc("quotes.answer", { id: quoteAccept, decision: "accept", consent: true }, member, phone);
  const accepted = await quoteRow(quoteAccept);
  const acceptance = (await db.query("select details from console_audit_events where entity_id=$1 and action='quote.accepted'", [quoteAccept])).rows[0]?.details;
  ok(
    r.status === 200 &&
      r.body.message === "Orçamento aceito. A Anuntech já foi avisada e entra em contato para os próximos passos." &&
      accepted.status === "accepted" &&
      accepted.decided_party === "client" &&
      accepted.decided_by === people.member.id &&
      accepted.decided_ip === "198.51.100.23" &&
      acceptance?.party === "client" &&
      acceptance.ip === "198.51.100.23" &&
      !!acceptance.sessionStartedAt &&
      mails().some((m) => m.to === owner && m.subject === "Orçamento 2098-001 aceito: Site do app"),
    "quotes.answer: the Administrador accepts with consent, and the decision is on record",
  );
  r = await rpc("quotes.answer", { id: quoteAccept, decision: "decline" }, member);
  ok(
    r.status === 400 &&
      r.body?.message === "Este orçamento não está aguardando resposta." &&
      (await rpc("quotes.get", { id: quoteAccept }, member)).body?.canAnswer === false,
    "quotes.answer: an answered quote takes no second answer",
  );
  r = await rpc("quotes.answer", { id: quoteDecline, decision: "decline", note: "  Fora do orçamento deste ano.  " }, member, phone);
  const declined = await quoteRow(quoteDecline);
  ok(
    r.status === 200 &&
      r.body.message === "Resposta registrada. Obrigado por avisar." &&
      declined.status === "declined" &&
      declined.decided_party === "client" &&
      declined.decision_note === "Fora do orçamento deste ano.",
    "quotes.answer: the Administrador declines another quote with a note",
  );
  const folderA = randomUUID(), linkA = randomUUID(), linkB = randomUUID();
  await db.query("insert into console_bookmark_folders(id,company_id,owner_id,name) values($1,$2,$3,'Acessos')", [folderA, companies.a, people.owner.id]);
  await db.query(
    "insert into console_bookmarks(id,company_id,author_id,folder_id,title,url) values($1,$2,$3,$4,'Painel do site','https://example.invalid/a'),($5,$6,$3,null,'Outra empresa','https://example.invalid/b')",
    [linkA, companies.a, people.owner.id, folderA, linkB, companies.b],
  );
  r = await rpc("bookmarks.list", {}, member);
  ok(
    r.status === 200 && r.body.folders.some((f) => f.id === folderA) && r.body.items.some((i) => i.id === linkA && i.kind === "link") && !r.body.items.some((i) => i.id === linkB),
    "Bookmarks list the company's folders and links, never another company's",
  );
  await db.query("delete from console_bookmarks where id=any($1::text[])", [[linkA, linkB]]);
  await db.query("delete from console_bookmark_folders where id=$1", [folderA]);
  await db.query("delete from console_quotes where id=any($1::text[])", [[quoteSent, quoteAccept, quoteDecline, quoteLapsed, foreignQuote]]);
  await db.query("delete from console_contract_signatures where contract_id=$1", [signable]);
  await db.query("delete from console_automation_events where entity_id=$1", [signable]);
  await db.query("delete from console_contracts where id=any($1::text[])", [[contractSent, contractDraft, signable, foreignContract]]);
  await db.query("delete from console_task_comments where task_id=$1", [taskA2]);
  await db.query("delete from console_tasks where id=any($1::text[])", [[taskA, taskA2, taskB]]);
  await db.query("delete from console_engagements where id=any($1::text[])", [[projectA, projectB]]);

  // The assistant, through the app's routes: same turn, history and cards as the web.
  const ask = (path, init = {}, cookie) =>
    fetch(`${base}/api/v1/assistente${path}`, {
      ...init,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(init.headers || {}) },
    });
  const say = (cookie, message, headers = { "Content-Type": "application/json" }) =>
    ask("", { method: "POST", headers, body: JSON.stringify({ message }) }, cookie);
  ok((await say(undefined, "Olá")).status === 401, "The app's assistant needs a session");
  ok(
    (await say(member, "Olá", { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" })).status === 403,
    "A browser on another site never reaches the assistant",
  );
  ok((await say(member, "Olá", { "Content-Type": "text/plain" })).status === 403, "The assistant takes only JSON");
  const turnResponse = await say(member, "Quais chamados estão abertos?");
  const turnText = await turnResponse.text();
  const finish = turnText
    .split("\n")
    .filter((line) => line.startsWith("data: {"))
    .map((line) => JSON.parse(line.slice(6)))
    .find((event) => event.type === "finish");
  ok(
    turnResponse.status === 200 &&
      (turnResponse.headers.get("content-type") || "").includes("text/event-stream") &&
      turnText.includes('"type":"text-delta"') &&
      !!finish?.messageMetadata?.conversationId,
    "The app gets the assistant's answer as it is written, with the conversation's id",
  );
  const conversation = finish?.messageMetadata?.conversationId;
  r = await ask("/conversas", {}, member);
  ok(
    r.status === 200 && (await r.json()).conversations.some((c) => c.id === conversation),
    "The app lists the person's conversations",
  );
  ok((await ask(`/conversas/${conversation}`, {}, outsiderEarly)).status === 404, "Nobody reads someone else's conversation");
  r = await ask(
    `/propostas/${randomUUID()}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nonce: "n".repeat(24), decisao: "descartar" }) },
    member,
  );
  ok(r.status === 409, "A card that is not pending cannot be decided");
  ok(
    (await fetch(`${base}/api/assistente`, { method: "POST", headers: { Cookie: member, "Content-Type": "application/json" }, body: JSON.stringify({ message: "Olá" }) })).status === 403,
    "The web's assistant route still takes only the Console's own pages",
  );
  ok((await ask(`/conversas/${conversation}`, { method: "DELETE" }, member)).status === 204, "The person deletes a conversation from the app");

  // Push devices.
  const outsider = outsiderEarly;
  ok(
    (await rpc("devices.register", { token: "not-a-token", platform: "ios" }, member)).status === 400,
    "Device registration validates the push token",
  );
  ok(
    (await rpc("devices.register", { token: token(1), platform: "ios", appVersion: "1.0.0" }, member)).status === 200 &&
      (await device(token(1)))?.user_id === people.member.id,
    "A phone registers for its person",
  );
  await rpc("devices.register", { token: token(1), platform: "ios" }, outsider);
  ok(
    (await device(token(1))).user_id === people.outsider.id,
    "The last person to sign in on a phone receives its notifications",
  );
  await rpc("devices.unregister", { token: token(1) }, member);
  ok(!(await device(token(1))).disabled_at, "Nobody unregisters someone else's phone");
  await rpc("devices.unregister", { token: token(1) }, outsider);
  ok(!!(await device(token(1))).disabled_at, "Signing out unregisters the phone");
  ok(
    (await rpc("devices.register", { token: token(2), platform: "android" })).status === 401,
    "Registering a phone needs a session",
  );

  // Account deletion from the app.
  await rpc("devices.register", { token: token(3), platform: "android" }, outsider);
  ok(
    (await rpc("account.delete", { challengeId: "x", code: "1", confirmation: "" }, outsider)).status === 400,
    "Inputs go through the contract's schema",
  );
  await limits();
  r = await rpc("account.requestDeletion", { channel: "email" }, outsider);
  const code = messages().filter((m) => m.to === people.outsider.email).at(-1)?.code;
  ok(r.status === 200 && !!r.body.challengeId && !!code, "The app asks for a deletion code");
  const challengeId = r.body.challengeId;
  ok(
    (await rpc("account.delete", { challengeId, code, confirmation: "EXCLUIR" }, member)).status === 400,
    "Another person's session cannot use the code",
  );
  r = await rpc("account.delete", { challengeId, code, confirmation: "EXCLUIR" }, outsider);
  ok(r.status === 200 && r.body.deleted === true, "The app deletes the account");
  ok(
    (await rpc("me.get", undefined, outsider)).status === 401 &&
      !!(await device(token(3))).disabled_at,
    "The deleted account's session and phones stop working",
  );
  ok(
    (await rpc("account.requestDeletion", { channel: "email" }, staff)).status === 400,
    "The Console owner cannot delete the account from the app either",
  );
  // Dados da empresa, Membros e Notificações (scripts/api-smoke-settings.mjs).
  await settingsChecks({ db, rpc, ok, marker, emailSignIn, staff, mailFile: join(dir, "mail.jsonl") });
  // Notificações no celular (scripts/api-smoke-push.mjs).
  await pushChecks({ db, rpc, ok, marker, emailSignIn, staff, base, pushFile: join(dir, "push.jsonl"), cronSecret: "test-cron-secret" });
  // Chamados: anexos, detalhes, estimativa e o formulário (scripts/api-smoke-tickets.mjs).
  await ticketsChecks({ db, rpc, ok, marker, emailSignIn, staff, base });
  // Ajuda, Como trabalhamos e Primeiros passos (scripts/api-smoke-help.mjs).
  await helpChecks({ db, rpc, ok, marker, emailSignIn, staff });
  // Financeiro: busca, período, recorrência, próximas cobranças e o detalhe (scripts/api-smoke-finance.mjs).
  await financeChecks({ db, rpc, ok, marker, emailSignIn, staff, base });
  // Contratos e orçamentos (scripts/api-smoke-contracts.mjs).
  await contractsChecks({ db, rpc, ok, marker, emailSignIn, staff, base, mailFile: join(dir, "mail.jsonl") });
  // Projetos: filtros, tarefas, comentários, anexos e atividade (scripts/api-smoke-projects.mjs).
  await projectsChecks({ db, rpc, ok, marker, emailSignIn, staff, base });
  // Bookmarks no celular (scripts/api-smoke-bookmarks.mjs).
  await bookmarksChecks({ db, rpc, ok, marker, emailSignIn, staff, base });
  // Início, produtos, apps e banco de horas (scripts/api-smoke-home.mjs).
  await homeChecks({ db, rpc, ok, marker, emailSignIn, staff });
  // Histórico de envios e ditado (scripts/api-smoke-f8.mjs).
  await f8Checks({ db, rpc, ok, marker, emailSignIn, staff, base });
  // Lacunas L15: reordenar tarefas dentro da coluna (scripts/api-smoke-lac5.mjs).
  await lac5Checks({ db, rpc, ok, marker, emailSignIn, staff });
  // Atividade e bookmarks.get (scripts/api-smoke-lac2.mjs).
  await lac2Checks({ db, rpc, ok, marker, emailSignIn, staff });
  // Documento da proposta e diferença do texto proposto (scripts/api-smoke-lac4.mjs).
  await lac4Checks({ db, rpc, ok, marker, emailSignIn, staff });
  // Lacunas L9–L12: company display names, showCompany, "Personalizado" and the company filter.
  await lac3Checks({ db, rpc, ok, marker, emailSignIn, staff });
  // Abrir o Console já com a sessão do app (scripts/api-smoke-lac1.mjs).
  await lac1Checks({ db, rpc, ok, marker, emailSignIn, staff, base });
  // Arquivos no celular: envio em partes para o R2, espaço usado e download assinado (scripts/api-smoke-arquivos-app.mjs).
  await arquivosAppChecks({ db, rpc, ok, marker, emailSignIn, staff, base, r2 });
  // Cartões de Arquivos no celular: miniaturas, estrelas, "Com estrela" e "Recentes", renomear e a divisão do armazenamento (scripts/api-smoke-arquivos-cards.mjs).
  await arquivosCardsChecks({ db, rpc, ok, marker, emailSignIn, staff, base, r2 });
  console.log(`Concluído: ${count} verificações da API do app.`);
} catch (error) {
  console.error("FAIL", error.stack);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await r2?.close();
  try {
    for (const statement of [
      "delete from console_push_devices where user_id=any($1::text[])",
      "delete from console_audit_events where actor_id=any($1::text[])",
      "delete from console_session where user_id=any($1::text[])",
      "delete from console_two_factor where user_id=any($1::text[])",
      "delete from console_user where id=any($1::text[])",
    ])
      await db.query(statement, [userIds]);
    await db.query("delete from console_memberships where company_id=any($1::text[])", [Object.values(companies)]);
    await db.query("delete from console_companies where id=any($1::text[])", [Object.values(companies)]);
  } finally {
    await db.end();
    rmSync(dir, { recursive: true, force: true });
  }
}
