import assert from "node:assert/strict";
import { randomUUID, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import pg from "pg";
assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /^\/console_test_[a-f0-9]+$/,
  "Use apenas o banco descartável do test-isolated.mjs",
);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = "http://127.0.0.1:3104",
  email = `security-${randomUUID()}@example.invalid`,
  phone = "+5511999990304";
const dir = mkdtempSync(join(tmpdir(), "console-security-")),
  capture = join(dir, "messages.jsonl"),
  googleFile = join(dir, "google.json");
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const fixture = {
  email,
  sub: randomUUID(),
  jwk: {
    ...publicKey.export({ format: "jwk" }),
    kid: "test",
    alg: "RS256",
    use: "sig",
  },
  privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
};
writeFileSync(googleFile, JSON.stringify(fixture), { mode: 0o600 });
let server,
  count = 0,
  uid;
const ok = (value, message) => {
  assert.ok(value, message);
  count++;
  console.log("PASS", message);
};
function messages() {
  try {
    return readFileSync(capture, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
  } catch {
    return [];
  }
}
async function limits() {
  await db.query("delete from console_rate_limit");
  await db.query("delete from console_otp_limits");
}
function cookies(response) {
  return response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
}
async function api(path, body, cookie) {
  await db.query("delete from console_rate_limit");
  const r = await fetch(`${base}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: base,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  return {
    status: r.status,
    body: await r.json().catch(() => null),
    cookie: cookies(r),
    location: r.headers.get("location"),
  };
}
async function emailLogin() {
  await limits();
  await api("/email-otp/send-verification-otp", { email, type: "sign-in" });
  return api("/sign-in/email-otp", { email, otp: messages().at(-1).code });
}
async function phoneLogin() {
  await limits();
  await api("/phone-number/send-otp", { phoneNumber: phone });
  return api("/phone-number/verify", {
    phoneNumber: phone,
    code: messages().at(-1).code,
  });
}
async function prove(change, cookie) {
  await limits();
  let r = await api(
    "/security/send-change",
    { changeId: change.changeId },
    cookie,
  );
  assert.equal(r.status, 200);
  assert.equal(messages().at(-1).channel, "email");
  r = await api(
    "/security/verify-change",
    { changeId: change.changeId, code: messages().at(-1).code },
    cookie,
  );
  assert.equal(r.body.stage, "whatsapp");
  await limits();
  r = await api("/security/send-change", { changeId: change.changeId }, cookie);
  assert.equal(r.status, 200);
  assert.equal(messages().at(-1).channel, "whatsapp");
  return api(
    "/security/verify-change",
    { changeId: change.changeId, code: messages().at(-1).code },
    cookie,
  );
}
async function secondary(cookie) {
  await limits();
  const r = await api(
    "/two-factor/send-otp",
    { channel: "attacker", destination: "attacker@example.invalid" },
    cookie,
  );
  assert.equal(r.status, 200);
  return messages().at(-1);
}
try {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3104",
    ],
    {
      env: {
        ...process.env,
        CONSOLE_ADMIN_EMAIL: email,
        BETTER_AUTH_URL: base,
        NODE_OPTIONS: `--require=${process.cwd()}/scripts/security-mock.cjs`,
        CONSOLE_TEST_OTP_FILE: capture,
        CONSOLE_TEST_GOOGLE_FILE: googleFile,
        GOOGLE_CLIENT_ID: "console-security-test",
        GOOGLE_CLIENT_SECRET: "test",
        RESEND_API_KEY: "test",
        EMAIL_FROM: "Console <test@example.invalid>",
        FLW_SYNOVA: "test",
        FLW_SENDER_NUMBER: "5511000000000",
        FLW_OTP_TEMPLATE_ID: randomUUID(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.resume();
  server.stderr.resume();
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(base + "/entrar");
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert.ok(ready);
  let r = await emailLogin();
  assert.equal(r.status, 200);
  const firstCookie = r.cookie;
  uid = r.body.user.id;
  ok(
    !(await api("/get-session", undefined, firstCookie)).body.user
      .twoFactorEnabled,
    "Login sem duas etapas preserva sessão normal",
  );
  r = await api(
    "/security/start-change",
    { action: "enable", channel: "whatsapp" },
    firstCookie,
  );
  ok(r.status === 401, "Ativação exige os dois contatos verificados");
  await db.query(
    "update console_user set phone_number=$1,phone_number_verified=true where id=$2",
    [phone, uid],
  );
  const another = await emailLogin();
  r = await api("/two-factor/enable", { method: "otp" }, firstCookie);
  ok(r.status === 403, "API nativa não ativa proteção sem provas");
  r = await api(
    "/security/start-change",
    { action: "enable", channel: "whatsapp" },
    firstCookie,
  );
  assert.equal(r.status, 200);
  const activation = r.body;
  r = await api(
    "/security/send-change",
    { changeId: activation.changeId },
    another.cookie,
  );
  ok(
    r.status === 401,
    "Prova de configuração está vinculada à sessão que a iniciou",
  );
  const activated = await prove(activation, firstCookie);
  ok(
    activated.status === 200 && activated.body.complete,
    "Ativação só conclui após provar e-mail e WhatsApp",
  );
  ok(
    (await api("/get-session", undefined, another.cookie)).body === null,
    "Ativação revoga outras sessões",
  );
  ok(
    (await api("/get-session", undefined, firstCookie)).body?.user
      .twoFactorEnabled,
    "Sessão que comprovou os dois contatos permanece válida",
  );
  r = await api(
    "/security/verify-change",
    { changeId: activation.changeId, code: messages().at(-1).code },
    firstCookie,
  );
  ok(r.status >= 400, "Prova de ativação consumida não pode ser repetida");
  for (const [path, body] of [
    ["/update-user", { phoneNumber: null }],
    ["/update-user", { twoFactorEnabled: false }],
    ["/update-user", { image: "https://example.invalid/avatar" }],
    ["/two-factor/disable", {}],
    ["/set-password", { newPassword: "insecure-test-password" }],
    ["/change-email", { newEmail: "attacker@example.invalid" }],
    ["/two-factor/generate-backup-codes", {}],
    ["/two-factor/verify-backup-code", { code: "test" }],
    ["/two-factor/verify-totp", { code: "123456" }],
  ]) {
    r = await api(path, body, firstCookie);
    ok(r.status >= 400, `API ${path} não contorna as configurações protegidas`);
  }
  r = await api(
    "/phone-number/send-otp",
    { phoneNumber: "+5511999999991" },
    firstCookie,
  ); // ordinary login cannot bind another number
  const bind = await fetch(base + "/api/auth/phone-number/send-otp", {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: firstCookie,
      "x-console-purpose": "bind",
    },
    body: JSON.stringify({ phoneNumber: "+5511999999991" }),
  });
  ok(bind.status === 401, "WhatsApp não pode mudar com duas etapas ativas");
  r = await emailLogin();
  ok(
    r.status === 200 && r.body.twoFactorRedirect && !r.body.token,
    "Login por e-mail retorna somente desafio, sem token",
  );
  const pendingEmail = r.cookie;
  ok(
    (await api("/get-session", undefined, pendingEmail)).body === null,
    "Cookie de desafio não representa sessão autenticada",
  );
  ok(
    (await api("/security/challenge", undefined, pendingEmail)).body.channel ===
      "whatsapp",
    "Primeira etapa e-mail exige WhatsApp na segunda",
  );
  for (const method of ["GET", "POST", "DELETE"]) {
    const response = await fetch(base + "/api/conta/foto", {
      method,
      headers: { Cookie: pendingEmail, Origin: base },
      redirect: "manual",
    });
    ok(response.status === 401, `Foto ${method} rejeita sessão pendente`);
  }
  ok(
    (
      await api(
        "/security/start-change",
        { action: "disable", channel: "email" },
        pendingEmail,
      )
    ).status === 401,
    "Sessão pendente não altera segurança",
  );
  ok(
    (
      await fetch(base + "/painel", {
        headers: { Cookie: pendingEmail },
        redirect: "manual",
      })
    ).status === 307,
    "Painel exige conclusão da segunda etapa",
  );
  let message = await secondary(pendingEmail);
  ok(
    message.channel === "whatsapp",
    "Código secundário vai ao canal imposto pelo servidor",
  );
  r = await api(
    "/two-factor/verify-otp",
    { code: message.code, trustDevice: true },
    pendingEmail,
  );
  ok(r.status === 403, "Confiar dispositivo não permite dispensar a etapa");
  r = await api(
    "/two-factor/verify-otp",
    { code: message.code === "000000" ? "000001" : "000000" },
    pendingEmail,
  );
  ok(r.status >= 400, "Código secundário errado não cria sessão");
  r = await api("/two-factor/verify-otp", { code: message.code }, pendingEmail);
  ok(
    r.status === 200 && r.body.token,
    "Código secundário correto cria sessão plena",
  );
  const completeCookie = r.cookie;
  r = await api("/two-factor/verify-otp", { code: message.code }, pendingEmail);
  ok(r.status >= 400, "Código e desafio concluídos não podem ser reutilizados");
  r = await phoneLogin();
  ok(
    r.body.twoFactorRedirect && !r.body.token,
    "Login por WhatsApp também fica pendente",
  );
  const pendingPhone = r.cookie;
  ok(
    (await api("/security/challenge", undefined, pendingPhone)).body.channel ===
      "email",
    "Primeira etapa WhatsApp exige e-mail na segunda",
  );
  message = await secondary(pendingPhone);
  ok(
    message.channel === "email",
    "Segundo código do login WhatsApp enviado por e-mail",
  );
  await db.query(
    "update console_verification set expires_at=now()-interval '1 minute' where identifier like '2fa-otp-%'",
  );
  ok(
    (await api("/two-factor/verify-otp", { code: message.code }, pendingPhone))
      .status >= 400,
    "Código secundário expirado é recusado",
  );
  r = await emailLogin();
  message = await secondary(r.cookie);
  const exhaustedCookie = r.cookie;
  const wrong = message.code === "000000" ? "000001" : "000000";
  for (let attempt = 0; attempt < 3; attempt++)
    assert.ok(
      (await api("/two-factor/verify-otp", { code: wrong }, exhaustedCookie))
        .status >= 400,
    );
  ok(
    (
      await api(
        "/two-factor/verify-otp",
        { code: message.code },
        exhaustedCookie,
      )
    ).status >= 400,
    "Três erros invalidam o código secundário",
  );
  r = await emailLogin();
  const expiredCookie = r.cookie;
  await db.query(
    "update console_verification set expires_at=now()-interval '1 minute' where identifier like 'console-two-step:%'",
  );
  ok(
    (await api("/security/challenge", undefined, expiredCookie)).status === 401,
    "Desafio completo expirado não pode ser retomado",
  );
  r = await emailLogin();
  message = await secondary(r.cookie);
  const parallel = await Promise.all([
    api("/two-factor/verify-otp", { code: message.code }, r.cookie),
    api("/two-factor/verify-otp", { code: message.code }, r.cookie),
  ]);
  ok(
    parallel.filter((x) => x.status === 200).length === 1,
    "Verificações concorrentes consomem o código apenas uma vez",
  );
  r = await api("/sign-in/social", {
    provider: "google",
    callbackURL: base + "/painel",
  });
  assert.equal(r.status, 200);
  const authorization = new URL(r.body.url);
  const callback = await fetch(
    `${base}/api/auth/callback/google?state=${encodeURIComponent(authorization.searchParams.get("state"))}&code=${encodeURIComponent(authorization.searchParams.get("nonce") || "test")}`,
    { headers: { Cookie: r.cookie }, redirect: "manual" },
  );
  ok(
    callback.status === 302 &&
      callback.headers.get("location") === base + "/verificar-acesso",
    "Callback Google redireciona para segunda etapa",
  );
  const googleCookie = cookies(callback);
  ok(
    (await api("/get-session", undefined, googleCookie)).body === null,
    "Callback Google não deixa sessão utilizável",
  );
  ok(
    (await api("/security/challenge", undefined, googleCookie)).body.channel ===
      "whatsapp",
    "Google usa canal configurado na conta",
  );
  const claims = {
    iss: "https://accounts.google.com",
    aud: "console-security-test",
    sub: fixture.sub,
    email,
    email_verified: true,
    name: "Security Test",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  const encoded = [
    Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
  ].join(".");
  const token = `${encoded}.${sign("RSA-SHA256", Buffer.from(encoded), privateKey).toString("base64url")}`;
  r = await api("/sign-in/social", { provider: "google", idToken: { token } });
  ok(
    r.status === 200 && r.body.twoFactorRedirect && !r.body.token,
    "Google ID token direto também exige segunda etapa",
  );
  r = await api(
    "/security/start-change",
    { action: "channel", channel: "email" },
    completeCookie,
  );
  assert.equal(r.status, 200);
  ok(
    (await prove(r.body, completeCookie)).body.complete,
    "Troca do canal Google exige novamente os dois contatos",
  );
  r = await api("/sign-in/social", { provider: "google", idToken: { token } });
  ok(
    (await api("/security/challenge", undefined, r.cookie)).body.channel ===
      "email",
    "Google respeita o canal alterado após nova prova",
  );
  r = await api(
    "/security/start-change",
    { action: "disable", channel: "whatsapp" },
    completeCookie,
  );
  assert.equal(r.status, 200);
  const disabled = await prove(r.body, completeCookie);
  ok(disabled.body.complete, "Desativar exige novamente os dois contatos");
  ok(
    (await api("/security/challenge", undefined, googleCookie)).status === 401,
    "Mudança de segurança invalida desafios anteriores",
  );
  r = await emailLogin();
  ok(
    r.status === 200 && r.body.token && !r.body.twoFactorRedirect,
    "Desativação restaura o login sem segunda etapa",
  );
  const audit = (
    await db.query(
      "select action,details from console_audit_events where actor_id=$1 and action like 'account.security.%' order by created_at",
      [uid],
    )
  ).rows;
  ok(
    audit.length === 3 &&
      audit.every((event) => Object.keys(event.details).join() === "channel"),
    "Auditoria registra as três mudanças sem códigos nem contatos",
  );
  console.log(
    `Concluído: ${count} verificações de segurança; nenhum envio real.`,
  );
} catch (error) {
  console.error("FAIL", error.message);
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  if (uid) {
    await db.query("delete from console_audit_events where actor_id=$1", [uid]);
    await db.query("delete from console_user where id=$1", [uid]);
  }
  await db.end();
  rmSync(dir, { recursive: true, force: true });
}
