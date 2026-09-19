import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import pg from "pg";
const dbName = new URL(process.env.DATABASE_URL).pathname;
assert.match(
  dbName,
  /^\/console_test_[a-f0-9]+$/,
  "Use o banco descartável do test-isolated.mjs",
);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = "http://127.0.0.1:3102";
const email = `otp-${randomUUID()}@example.invalid`;
const phone = "+5511999990001";
const dir = mkdtempSync(join(tmpdir(), "console-otp-")),
  capture = join(dir, "messages.jsonl");
let server,
  count = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  count++;
  console.log("PASS", message);
};
const messages = () => {
  try {
    return readFileSync(capture, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
  } catch {
    return [];
  }
};
async function api(path, body, cookie, headers = {}) {
  const res = await fetch(base + "/api/auth" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  return {
    status: res.status,
    body: await res.json(),
    cookie: res.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
async function resetLimits() {
  await db.query("delete from console_rate_limit");
}
async function unlock(destination) {
  const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update(`otp:${destination}`)
    .digest("hex");
  await db.query("delete from console_otp_limits where key=$1", [key]);
  await resetLimits();
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
      "3102",
    ],
    {
      env: {
        ...process.env,
        CONSOLE_ADMIN_EMAIL: email,
        BETTER_AUTH_URL: base,
        NODE_OPTIONS: `--require=${process.cwd()}/scripts/otp-mock.cjs`,
        CONSOLE_TEST_OTP_FILE: capture,
        RESEND_API_KEY: "test",
        EMAIL_FROM: "Console <test@example.invalid>",
        FLW_SYNOVA: "test",
        FLW_SENDER_NUMBER: "5511000000000",
        FLW_OTP_TEMPLATE_ID: randomUUID(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  // Drain without exposing generated codes or provider credentials in tool output.
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
  assert.ok(ready, "Servidor OTP iniciado");
  let r = await api("/email-otp/send-verification-otp", {
    email: "unknown@example.invalid",
    type: "sign-in",
  });
  ok(
    r.status === 200 && messages().length === 0,
    "E-mail desconhecido recebe resposta genérica sem envio",
  );
  r = await api("/email-otp/send-verification-otp", { email, type: "sign-in" });
  ok(
    r.status === 200 && messages().length === 1,
    "Código por e-mail enviado ao provedor simulado",
  );
  const code = messages().at(-1).code;
  const stored = (await db.query("select value from console_verification"))
    .rows;
  ok(
    stored.every((x) => !x.value.includes(code)),
    "Código de e-mail armazenado com hash",
  );
  r = await api("/email-otp/send-verification-otp", { email, type: "sign-in" });
  ok(
    r.status === 429 && messages().length === 1,
    "Reenvio imediato bloqueado no servidor",
  );
  r = await api("/sign-in/email-otp", {
    email,
    otp: code === "000000" ? "000001" : "000000",
  });
  ok(
    r.status >= 400 && !r.cookie.includes("session_token="),
    "Código incorreto não cria sessão",
  );
  r = await api("/sign-in/email-otp", { email, otp: code });
  ok(
    r.status === 200 && r.cookie.includes("session_token="),
    "E-mail autorizado cria conta e sessão sem Google",
  );
  let cookie = r.cookie;
  const uid = r.body.user.id;
  ok(
    (
      await fetch(base + "/painel", {
        headers: { Cookie: cookie },
        redirect: "manual",
      })
    ).status === 200,
    "Sessão por e-mail acessa painel",
  );
  r = await api("/sign-in/email-otp", { email, otp: code });
  ok(r.status >= 400, "Código de e-mail consumido não pode ser reutilizado");
  await resetLimits();
  r = await api("/phone-number/send-otp", { phoneNumber: phone });
  ok(
    r.status === 200 && messages().length === 1,
    "WhatsApp sem vínculo não recebe código de login",
  );
  await unlock(phone);
  r = await api("/phone-number/send-otp", { phoneNumber: phone }, null, {
    "x-console-purpose": "bind",
  });
  ok(r.status === 401, "Vincular WhatsApp exige sessão autenticada");
  r = await api(
    "/update-user",
    { phoneNumber: phone, phoneNumberVerified: true },
    cookie,
  );
  ok(
    r.status >= 400,
    "POST adulterado não vincula número sem verificar código",
  );
  r = await api("/phone-number/send-otp", { phoneNumber: phone }, cookie, {
    "x-console-purpose": "bind",
  });
  ok(
    r.status === 200 && messages().at(-1).channel === "whatsapp",
    "Vinculação envia código pelo FLW simulado",
  );
  let phoneCode = messages().at(-1).code;
  r = await api(
    "/phone-number/verify",
    {
      phoneNumber: phone,
      code: phoneCode,
      updatePhoneNumber: true,
      disableSession: true,
    },
    cookie,
  );
  ok(
    r.status === 200 &&
      (
        await db.query(
          "select phone_number_verified from console_user where id=$1",
          [uid],
        )
      ).rows[0].phone_number_verified,
    "Código confirma vínculo do WhatsApp à conta",
  );
  await unlock(phone);
  r = await api("/phone-number/send-otp", { phoneNumber: phone });
  ok(r.status === 200, "Número verificado pode solicitar login sem sessão");
  phoneCode = messages().at(-1).code;
  r = await api("/phone-number/verify", {
    phoneNumber: phone,
    code: phoneCode,
  });
  ok(
    r.status === 200 && r.cookie.includes("session_token="),
    "Código WhatsApp cria sessão na conta correta",
  );
  ok(r.body.user.id === uid, "Login WhatsApp preserva identidade e permissões");
  r = await api("/phone-number/verify", {
    phoneNumber: phone,
    code: phoneCode,
  });
  ok(r.status >= 400, "Código WhatsApp usado não é reutilizado");
  await unlock(phone);
  await api("/phone-number/send-otp", { phoneNumber: phone });
  phoneCode = messages().at(-1).code;
  for (let i = 0; i < 3; i++) {
    r = await api("/phone-number/verify", {
      phoneNumber: phone,
      code: phoneCode === "000000" ? "000001" : "000000",
    });
    assert.ok(r.status >= 400);
  }
  r = await api("/phone-number/verify", {
    phoneNumber: phone,
    code: phoneCode,
  });
  ok(r.status >= 400, "Três erros invalidam o código WhatsApp");
  await unlock(email);
  await api("/email-otp/send-verification-otp", { email, type: "sign-in" });
  const newCode = messages().at(-1).code;
  for (let i = 0; i < 3; i++) {
    r = await api("/sign-in/email-otp", {
      email,
      otp: newCode === "000000" ? "000001" : "000000",
    });
    assert.ok(r.status >= 400);
  }
  r = await api("/sign-in/email-otp", { email, otp: newCode });
  ok(r.status >= 400, "Três erros invalidam o código de e-mail");
  await unlock(email);
  await api("/email-otp/send-verification-otp", { email, type: "sign-in" });
  await db.query(
    "update console_verification set expires_at=now()-interval '1 minute'",
  );
  r = await api("/sign-in/email-otp", { email, otp: messages().at(-1).code });
  ok(r.status >= 400, "Código expirado é recusado");
  await db.query(
    "update console_session set created_at=now()-interval '11 minutes' where user_id=$1",
    [uid],
  );
  await unlock(phone);
  r = await api(
    "/phone-number/send-otp",
    { phoneNumber: "+5511999990002" },
    cookie,
    { "x-console-purpose": "bind" },
  );
  ok(
    r.status === 401,
    "Sessão antiga precisa reautenticar para vincular número",
  );
  r = await api("/update-user", { phoneNumber: null }, cookie);
  ok(r.status === 401, "Sessão antiga não pode remover WhatsApp");
  await db.query(
    "update console_session set created_at=now() where user_id=$1",
    [uid],
  );
  r = await api("/update-user", { phoneNumber: null }, cookie);
  const unlinked = (
    await db.query(
      "select phone_number,phone_number_verified from console_user where id=$1",
      [uid],
    )
  ).rows[0];
  ok(
    r.status === 200 &&
      !unlinked.phone_number &&
      !unlinked.phone_number_verified,
    "Remoção autenticada desativa acesso pelo número",
  );
  console.log(`Concluído: ${count} verificações OTP, sem mensagens reais.`);
} catch (error) {
  console.error("FAIL", error.message);
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await db.query("delete from console_user where email=$1", [email]);
  await db.end();
  rmSync(dir, { recursive: true, force: true });
}
