// Run only against a development database. Creates isolated fixtures and removes them in finally.
import { runBillingTests } from "./billing-smoke.mjs";
import { runHandoffTests } from "./handoff-smoke.mjs";
import { runPilotoTests } from "./piloto-smoke.mjs";
import { runSupportTests } from "./support-smoke.mjs";
import { runNoticesTests } from "./notices-smoke.mjs";
import { runClientsTests } from "./clients-smoke.mjs";
import { runBillingExtrasTests } from "./billing-extras-smoke.mjs";
import { runSuspensionTests } from "./suspension-smoke.mjs";
import { runArquivosTests } from "./arquivos-smoke.mjs";
import { startR2Mock } from "./r2-mock.mjs";
import { startJmapMock } from "./jmap-mock.mjs";
import { runEmailTests } from "./email-smoke.mjs";
import { runJourneyTests } from "./journey-smoke.mjs";
import { runHelpTests } from "./help-smoke.mjs";
import { runAppsTests } from "./apps-smoke.mjs";
import { runMemberScopeTests } from "./member-scope-smoke.mjs";
import { runCatalogIconTests } from "./catalog-icons-smoke.mjs";
import { runAssistantTests } from "./assistant-smoke.mjs";
import { runContractSigningTests } from "./contract-signing-smoke.mjs";
import { runWorkspaceDomainTests } from "./workspace-domain-smoke.mjs";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { serializeSignedCookie } from "better-call";
assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /^\/console_test_[a-f0-9]+$/,
  "Use scripts/test-isolated.mjs para criar um banco descartável",
);
const port = process.env.CONSOLE_TEST_HTTP_PORT || "3101";
// Only the assistant suite (test-isolated.mjs --assistant-only): the setup runs, the other sections do not.
const assistantOnly = !!process.env.CONSOLE_TEST_ASSISTANT_ONLY;
// Only the e-mail suite (test-isolated.mjs --email-only), on the same fixtures.
const emailOnly = !!process.env.CONSOLE_TEST_EMAIL_ONLY;
const base = `http://127.0.0.1:${port}`;
const marker = randomUUID().slice(0, 8);
const adminEmail = `qa-admin-${marker}@example.invalid`;
const database = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
const ids = {
  a: randomUUID(),
  b: randomUUID(),
  ticketA: randomUUID(),
  ticketB: randomUUID(),
  draft: randomUUID(),
  billA: randomUUID(),
  billB: randomUUID(),
  attachment: randomUUID(),
};
const people = {};
// A pass key made for this run only; the apps suite checks passes against the JWKS it publishes.
const passKeyId = `console-test-${marker}`;
const passKey = Buffer.from(
  generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ format: "pem", type: "pkcs8" }),
).toString("base64");
const noticeDir = mkdtempSync(join(tmpdir(), "console-notices-"));
const noticeFile = join(noticeDir, "messages.jsonl"),
  noticeFlags = join(noticeDir, "flags.json"),
  aiFile = join(noticeDir, "ai-gateway.jsonl"),
  dnsFile = join(noticeDir, "dns.json");
const transcriptions = () => {
  try {
    return readFileSync(aiFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((e) => e.transcription);
  } catch {
    return [];
  }
};
const flags = (value) =>
  writeFileSync(noticeFlags, JSON.stringify(value), { mode: 0o600 });
const sentNotices = () => {
  try {
    return readFileSync(noticeFile, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
  } catch {
    return [];
  }
};
flags({ approved: true });
let server;
let r2;
let jmap;
let logs = "";
let passed = 0;
const companyIds = [ids.a, ids.b];
const ok = (condition, message) => {
  assert.ok(condition, message);
  passed++;
  console.log("PASS", message);
};
async function request(path, who, opts = {}) {
  const r = await fetch(base + path, {
    redirect: "manual",
    ...opts,
    headers: {
      ...(who ? { Cookie: people[who].cookie } : {}),
      ...opts.headers,
    },
  });
  return { status: r.status, headers: r.headers, text: await r.text() };
}
// Next may stream the shell before notFound() runs, keeping HTTP 200; the
// error boundary's digest is the stable signal that the page was denied.
const notFoundPage = (r) =>
  r.status === 404 || r.text.includes("NEXT_HTTP_ERROR_FALLBACK;404");
function decodeAttr(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
// Forms inside a closed sheet or dialog are not in the server HTML, so a
// test can name the Server Action instead ({ action: "updateDraft" }) and
// post the same envelope React renders for a form bound to useActionState.
// The page must render the action: Next resolves it from that page only.
let serverActions;
function actionBody(name, values) {
  serverActions ??= JSON.parse(
    readFileSync(".next/server/server-reference-manifest.json", "utf8"),
  ).node;
  const found = Object.entries(serverActions).filter(
    ([, action]) => action.exportedName === name,
  );
  assert.equal(found.length, 1, `Ação ${name} encontrada no build`);
  const body = new FormData();
  body.set("$ACTION_REF_1", "");
  body.set("$ACTION_1:0", JSON.stringify({ id: found[0][0], bound: "$@1" }));
  body.set("$ACTION_1:1", "[null]");
  // An array posts the field once per value, like checkboxes of the same name.
  for (const [key, value] of Object.entries(values))
    if (Array.isArray(value)) for (const each of value) body.append(key, each);
    else body.set(key, value);
  return body;
}
async function submitForm(page, reader, sender, identifier, values) {
  const body =
    typeof identifier === "object"
      ? actionBody(identifier.action, values)
      : formBody((await request(page, reader)).text, identifier, values);
  return request(page, sender, {
    method: "POST",
    body,
    headers: { Origin: base },
  });
}
function formBody(html, identifier, values) {
  const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(
    (m) => m[1],
  );
  const form = forms.find(
    (f) => f.includes(`name="${identifier}"`) || f.includes(identifier),
  );
  assert.ok(form, `Formulário ${identifier} encontrado`);
  const body = new FormData();
  for (const match of form.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0];
    const name = tag.match(/name="([^"]*)"/);
    const value = tag.match(/value="([^"]*)"/);
    if (name && tag.includes('type="hidden"'))
      body.set(decodeAttr(name[1]), decodeAttr(value?.[1] || ""));
  }
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body;
}

try {
  // Companies have two roles: "member" (tickets, shared areas) and
  // "manager" (everything, billing included). The fixture names keep the
  // area each person exercises: "finance" is a manager who reads billing.
  for (const [name, role] of [
    ["admin", null],
    ["support", "member"],
    ["finance", "manager"],
    ["manager", "manager"],
    ["outsider", null],
    ["expired", null],
  ]) {
    const uid = randomUUID(),
      token = randomUUID();
    const email =
      name === "admin" ? adminEmail : `qa-${name}-${marker}@example.invalid`;
    await database.query(
      "insert into console_user (id,name,email,email_verified) values ($1,$2,$3,true)",
      [uid, `QA ${name}`, email],
    );
    await database.query(
      "insert into console_session (id,token,user_id,expires_at) values ($1,$2,$3,$4)",
      [
        randomUUID(),
        token,
        uid,
        new Date(Date.now() + (name === "expired" ? -60000 : 3600000)),
      ],
    );
    people[name] = {
      id: uid,
      email,
      role,
      cookie: (
        await serializeSignedCookie(
          "anuntech-console.session_token",
          token,
          process.env.BETTER_AUTH_SECRET,
          { path: "/" },
        )
      ).split(";")[0],
    };
  }
  for (const [cid, label] of [
    [ids.a, "A"],
    [ids.b, "B"],
  ])
    await database.query(
      "insert into console_companies(id,name,document,billing_email) values ($1,$2,$3,$4)",
      [
        cid,
        `QA Company ${label} ${marker}`,
        BigInt(`0x${cid.replaceAll("-", "").slice(0, 11)}`)
          .toString()
          .padStart(14, "0"),
        `qa-${label}@example.invalid`,
      ],
    );
  for (const person of Object.values(people).filter((p) => p.role))
    await database.query(
      "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)",
      [randomUUID(), ids.a, person.email, person.role],
    );
  // The team in assisted access: company A as its Administrador sees it, never deciding for them.
  people.assisted = { ...people.admin, cookie: `${people.admin.cookie}; console_assist=${ids.a}` };
  for (const [tid, cid, subject] of [
    [ids.ticketA, ids.a, `Allowed ticket ${marker}`],
    [ids.ticketB, ids.b, `PRIVATE-B-${marker}`],
  ])
    await database.query(
      "insert into console_tickets(id,company_id,subject,author_id) values($1,$2,$3,$4)",
      [tid, cid, subject, people.admin.id],
    );
  for (const [iid, cid, status, description] of [
    [ids.draft, ids.a, "draft", `PRIVATE-DRAFT-${marker}`],
    [ids.billA, ids.a, "issued", `Allowed invoice ${marker}`],
    [ids.billB, ids.b, "issued", `PRIVATE-BILL-B-${marker}`],
  ])
    await database.query(
      "insert into console_invoices(id,company_id,status,description,amount_cents,due_date) values($1,$2,$3,$4,12345,$5)",
      [iid, cid, status, description, "2026-12-15"],
    );
  await database.query(
    "insert into console_attachments(id,ticket_id,author_id,name,mime,size,content) values($1,$2,$3,$4,$5,$6,$7)",
    [
      ids.attachment,
      ids.ticketA,
      people.admin.id,
      "qa.pdf",
      "application/pdf",
      9,
      Buffer.from("%PDF-test"),
    ],
  );
  await database.query(
    "update console_user set phone_number=$1,phone_number_verified=true where id=$2",
    ["+5511999990001", people.admin.id],
  );
  // Another server on this port would answer instead of ours (unknown sessions, wrong data).
  const taken = await fetch(base, { redirect: "manual" }).then(() => true, () => false);
  assert.ok(!taken, `A porta ${port} já está em uso: feche o outro servidor ou use CONSOLE_TEST_HTTP_PORT.`);
  // Arquivos talks to a local stand-in for R2 (scripts/r2-mock.mjs), never to the real bucket in .env.local.
  r2 = await startR2Mock();
  // E-mail talks to a local stand-in for Stalwart's admin API (scripts/jmap-mock.mjs), never to the real mail server.
  jmap = await startJmapMock();
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    {
      env: {
        ...process.env,
        CONSOLE_ADMIN_EMAIL: adminEmail,
        BETTER_AUTH_URL: base,
        GOOGLE_CLIENT_ID: "console-regression-test",
        GOOGLE_CLIENT_SECRET: "test",
        // The AI Gateway mock goes last so it wraps the other mocks' fetch.
        NODE_OPTIONS: `--require=${process.cwd()}/scripts/inter-mock.cjs --require=${process.cwd()}/scripts/notice-mock.cjs --require=${process.cwd()}/scripts/blob-mock.cjs --require=${process.cwd()}/scripts/dns-mock.cjs --require=${process.cwd()}/scripts/ai-gateway-mock.cjs`,
        // A key wins over OIDC: a Vercel token in .env.local is never used, and the mock checks this one.
        AI_GATEWAY_API_KEY: "test",
        CONSOLE_TEST_ASSISTANT_FILE: aiFile,
        // A saved copy of the Gateway's catalog: the model list, the fallback and the reasoning budget get exercised.
        CONSOLE_TEST_MODELS_FILE: `${process.cwd()}/scripts/fixtures/gateway-models.json`,
        CONSOLE_TEST_NOTICE_FILE: noticeFile,
        CONSOLE_TEST_NOTICE_FLAGS: noticeFlags,
        // Notices go out at once at any hour (in production they wait for 08:00).
        BILLING_NIGHT_HOLD: "off",
        CRON_SECRET: "test-cron-secret",
        FLW_TICKET_TEMPLATE_ID: "test-ticket-template",
        FLW_SYNOVA: "test",
        FLW_SENDER_NUMBER: "551151073435",
        RESEND_API_KEY: "test",
        EMAIL_FROM: "Console <test@example.invalid>",
        INTER_API_BASE_URL: "https://cdpj.partners.bancointer.com.br",
        APP_PASS_PRIVATE_KEY: passKey,
        APP_PASS_KEY_ID: passKeyId,
        CONSOLE_APP_ORIGINS: "",
        R2_ENDPOINT: r2.endpoint,
        R2_ACCOUNT_ID: "",
        R2_BUCKET: "console-test",
        R2_ACCESS_KEY_ID: "test",
        R2_SECRET_ACCESS_KEY: "test",
        STALWART_URL: jmap.endpoint,
        STALWART_USER: jmap.user,
        STALWART_PASSWORD: jmap.password,
        // The DNS health asks a stand-in resolver (scripts/dns-mock.cjs), never the real DNS.
        CONSOLE_TEST_DNS_FILE: dnsFile,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (b) => {
    logs += b;
  });
  server.stderr.on("data", (b) => {
    logs += b;
  });
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
  assert.ok(ready, "Servidor de teste iniciou");
  if (process.env.CONSOLE_TEST_BILLING_ONLY) {
    await database.query(
      "update console_companies set billing_address=$2 where id=$1",
      [
        ids.a,
        JSON.stringify({
          endereco: "Rua de teste",
          numero: "10",
          complemento: "",
          bairro: "Centro",
          cidade: "São Paulo",
          uf: "SP",
          cep: "01001000",
        }),
      ],
    );
  } else if (!assistantOnly && !emailOnly) {
    const lookupPath = "/api/cadastro/consulta?tipo=cnpj&valor=12345678000199";
    ok(
      (await request(lookupPath)).status === 401,
      "Consulta de cadastro exige sessão",
    );
    ok(
      (await request(lookupPath, "finance")).status === 403,
      "Cliente não consulta cadastro público pela API interna",
    );
    ok(
      (await request("/api/cadastro/consulta?tipo=cep&valor=invalido", "finance")).status === 400 &&
        (await request("/api/cadastro/consulta?tipo=cep&valor=invalido", "support")).status === 403,
      "Administrador do cliente consulta só o CEP; Membro não consulta",
    );
    ok(
      (
        await request(
          "/api/cadastro/consulta?tipo=cnpj&valor=12345678901",
          "admin",
        )
      ).status === 400,
      "CPF não é consultado como CNPJ",
    );
    ok(
      (
        await request(
          "/api/cadastro/consulta?tipo=https://example.com&valor=01001000",
          "admin",
        )
      ).status === 400,
      "Consulta rejeita provedor arbitrário",
    );
    const lookupResponse = await request(lookupPath, "admin");
    const lookupData = JSON.parse(lookupResponse.text);
    ok(
      lookupResponse.status === 200 &&
        lookupData.fields.name === "Empresa de teste" &&
        !lookupResponse.text.includes("socios") &&
        lookupResponse.headers.get("cache-control").includes("no-store"),
      "CNPJ retorna campos permitidos sem cache público",
    );
    const cepResponse = await request(
      "/api/cadastro/consulta?tipo=cep&valor=01001000",
      "admin",
    );
    const cepData = JSON.parse(cepResponse.text);
    ok(
      cepResponse.status === 200 &&
        cepData.fields.endereco === "Praça da Sé" &&
        !cepData.fields.complemento &&
        !cepData.fields.numero,
      "CEP retorna endereço sem substituir complemento ou número",
    );
    for (const status of [404, 429, 503]) {
      flags({ approved: true, lookupStatus: status });
      ok(
        (await request(lookupPath, "admin")).status ===
          (status === 503 ? 502 : status),
        `Consulta trata indisponibilidade ${status}`,
      );
    }
    flags({ approved: true, lookupMalformed: true });
    ok(
      (await request(lookupPath, "admin")).status === 502,
      "Consulta rejeita resposta inesperada do provedor",
    );
    flags({ approved: true, lookupMissing: true });
    ok(
      (await request("/api/cadastro/consulta?tipo=cep&valor=01001000", "admin"))
        .status === 404,
      "CEP não encontrado permite preenchimento manual",
    );
    flags({ approved: true });
    let r = await request("/painel");
    ok(
      [302, 303, 307].includes(r.status) &&
        r.headers.get("location")?.includes("/entrar"),
      "Sem sessão: painel redireciona para login",
    );
    r = await request("/painel", "admin");
    ok(
      r.status === 200 &&
        r.text.includes("Faturamento") &&
        r.text.includes('href="/empresas/nova"'),
      "Sessão assinada real: painel administrativo renderiza",
    );
    r = await request("/chamados", "support");
    ok(
      r.status === 200 &&
        r.text.includes(`Allowed ticket ${marker}`) &&
        !r.text.includes(`PRIVATE-B-${marker}`),
      "Lista de chamados isolada por empresa",
    );
    r = await request(`/chamados/${ids.ticketB}`, "support");
    ok(
      !r.text.includes(`PRIVATE-B-${marker}`) &&
        notFoundPage(r),
      "URL de chamado de outra empresa negada",
    );
    r = await request("/financeiro", "support");
    ok(
      !r.text.includes(`Allowed invoice ${marker}`),
      "Permissão atendimento não lê financeiro",
    );
    r = await request("/financeiro", "finance");
    ok(
      r.text.includes(`Allowed invoice ${marker}`) &&
        !r.text.includes(`PRIVATE-DRAFT-${marker}`) &&
        !r.text.includes(`PRIVATE-BILL-B-${marker}`),
      "Financeiro mostra somente faturas emitidas da empresa autorizada",
    );
    r = await request(`/financeiro/${ids.draft}`, "finance");
    ok(
      !r.text.includes(`PRIVATE-DRAFT-${marker}`),
      "Rascunho oculto inclusive por URL direta",
    );
    r = await request("/empresas", "manager");
    ok(
      notFoundPage(r) &&
        !r.text.includes(`QA Company B ${marker}`),
      "Administrador do cliente não administra empresas globalmente",
    );
    r = await request(`/api/anexos/${ids.attachment}`, "support");
    ok(
      r.status === 200 &&
        r.headers.get("content-disposition")?.startsWith("attachment;") &&
        r.headers.get("cache-control") === "private, no-store",
      "Anexo privado autorizado com download e sem cache",
    );
    r = await request(`/api/anexos/${ids.attachment}`, "outsider");
    ok(r.status === 404, "Pessoa sem acesso à empresa não baixa anexos");
    r = await request(`/api/anexos/${ids.attachment}`);
    ok(r.status === 401, "Download de anexo exige sessão");
    r = await request("/painel", "expired");
    ok(
      r.headers.get("location")?.includes("/entrar"),
      "Sessão expirada negada",
    );

    const ticketForm = await request("/chamados/novo", "support");
    ok(
      ticketForm.text.includes('name="kind"') && ticketForm.text.includes('name="subject"') && !ticketForm.text.includes('name="priority"') && !ticketForm.text.includes('name="channel"') && ticketForm.text.includes("/ajuda/tipos-de-chamado"),
      "Novo chamado pergunta o tipo, não deixa o cliente escolher prioridade nem canal e aponta a Ajuda",
    );
    // Dictation: the microphone is allowed for the Console only, and /api/transcricao turns audio into text.
    ok(ticketForm.headers.get("permissions-policy")?.includes("microphone=(self)") && ticketForm.headers.get("permissions-policy")?.includes("camera=()"), "Microfone liberado só para o próprio Console");
    ok(ticketForm.text.includes("Não escreva nem fale senhas"), "Com o microfone, o aviso de senhas vale também para o que se fala");
    // The browser sends WAV (it converts the recording); WebM or MP4 only when it could not.
    const speak = (who, body, type = "audio/wav", headers = {}) =>
      request("/api/transcricao", who, { method: "POST", body, headers: { Origin: base, "Content-Type": type, ...headers } });
    const audio = (prefix = "") => Buffer.concat([Buffer.from(prefix, "latin1"), Buffer.alloc(3000, 7)]);
    r = await speak("support", audio());
    ok(r.status === 200 && JSON.parse(r.text).text === "Texto ditado de teste", "Cliente dita e recebe o texto");
    const heard = transcriptions().at(-1);
    ok(
      heard?.model === "microsoft/mai-transcribe-2" && heard.locales?.join() === "pt-BR" && heard.zeroDataRetention === true && heard.disallowPromptTraining === true && heard.bytes === 3000,
      "Transcrição vai em português e só com provedores de retenção zero",
    );
    for (const type of ["audio/webm;codecs=opus", "audio/mp4"]) {
      const sent = transcriptions().length;
      r = await speak("support", audio(), type);
      ok(r.status === 200 && transcriptions().slice(sent).map((e) => e.model).join() === "spacexai/grok-stt", `Gravação que o navegador não converteu (${type}) vai só para o modelo que lê o formato`);
    }
    const before = transcriptions().length;
    r = await speak("support", audio("FAILPRIMARY"));
    ok(r.status === 200 && transcriptions().slice(before).map((e) => e.model).join() === "microsoft/mai-transcribe-2,spacexai/grok-stt", "Se o primeiro modelo falha, o segundo transcreve");
    r = await speak("support", audio("SILENCE"));
    ok(r.status === 422 && JSON.parse(r.text).error.includes("Não deu para entender"), "Áudio sem fala volta com aviso, sem texto");
    r = await speak("support", audio("INGLES"));
    ok(r.status === 422 && !r.text.includes("Bombilla"), "Transcrição que volta em outro idioma não entra no campo");
    r = await speak("support", audio("FAILALL"));
    ok(r.status === 502 && JSON.parse(r.text).error.includes("Tente de novo"), "Falha dos dois modelos pede para tentar de novo");
    r = await speak(null, audio());
    ok(r.status >= 300 && r.status < 400 && r.headers.get("location")?.includes("/entrar"), "Sem sessão não transcreve");
    ok((await speak("outsider", audio())).status === 403, "Conta sem empresa não transcreve");
    ok((await speak("support", audio(), "audio/webm", { Origin: "https://evil.example" })).status === 403, "Outro site não usa o microfone do Console");
    ok((await speak("support", audio(), "audio/webm", { "Sec-Fetch-Site": "cross-site" })).status === 403, "Pedido de outro site é recusado");
    ok((await speak("support", audio(), "text/plain")).status === 415, "Só formatos de áudio aceitos");
    ok((await speak("support", Buffer.alloc(4_000_001, 1))).status === 413, "Áudio grande demais é recusado");
    ok((await speak("support", Buffer.alloc(100, 1))).status === 400, "Áudio vazio é recusado");
    ok((await speak("finance", audio())).status === 200 && (await speak("admin", audio())).status === 200, "Administrador do cliente e equipe também ditam");
    const voiceKey = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(`voice:${people.manager.id}`).digest("hex");
    await database.query("delete from console_otp_limits where key=$1", [voiceKey]);
    const statuses = [];
    for (let i = 0; i < 31; i += 1) statuses.push((await speak("manager", audio())).status);
    ok(statuses.slice(0, 30).every((status) => status === 200) && statuses[30] === 429, "Cada pessoa transcreve até 30 vezes por hora");
    await database.query("delete from console_otp_limits where key=$1", [voiceKey]);
    ok((await speak("manager", audio("LONG"))).status === 200, "Áudio longo é transcrito");
    ok((await database.query("select count from console_otp_limits where key=$1", [voiceKey])).rows[0]?.count === 3, "Áudio de 5 minutos conta como 3 transcrições no limite da hora");
    await database.query("delete from console_otp_limits where key=$1", [voiceKey]);
    // The audio (base64 of the filler bytes) and the transcript never reach the server log.
    ok(!logs.includes(Buffer.alloc(48, 7).toString("base64")) && !logs.includes("Texto ditado de teste") && logs.includes("[voice]"), "O log do servidor não guarda áudio nem texto ditado");
    const contextual = await request(`/chamados/novo?from=${encodeURIComponent(`/chamados/${ids.ticketB}`)}`, "admin");
    ok(contextual.text.includes(`value="${ids.b}"`), "Equipe usa empresa do chamado em contexto");
    const forbiddenContext = await request(`/chamados/novo?companyId=${ids.b}`, "support");
    ok(!forbiddenContext.text.includes('name="subject"') && !forbiddenContext.text.includes(`QA Company B ${marker}`), "Contexto adulterado não abre empresa de outro cliente");
    // Until the acceptance check further down, the FLW reports WhatsApp
    // messages as still queued. The worker asks again 5 minutes after the
    // provider accepts one; against a remote database the run gets there first.
    flags({ approved: true, whatsappQueued: true });
    await submitForm("/chamados/novo", "support", "support", "subject", {
      companyId: ids.a,
      engagementId: "",
      subject: `Created through form ${marker}`,
      body: "Descrição criada pelo teste HTTP",
      files: new File(["%PDF-1.7 test"], "initial.pdf", { type: "application/pdf" }),
    });
    const created = (
      await database.query(
        "select id from console_tickets where company_id=$1 and subject=$2",
        [ids.a, `Created through form ${marker}`],
      )
    ).rows[0];
    ok(!!created, "Formulário de chamado grava no banco");
    const initial = (await database.query("select t.priority, a.name from console_tickets t join console_attachments a on a.ticket_id=t.id where t.id=$1", [created.id])).rows[0];
    ok(initial?.priority === "normal" && initial.name === "initial.pdf", "Chamado simples assume prioridade normal e salva anexo na abertura");
    await submitForm("/chamados/novo", "support", "support", "subject", {
      companyId: ids.a, subject: `Invalid file ${marker}`, body: "Invalid attachment", files: new File(["invalid"], "fake.pdf"),
    });
    ok((await database.query("select id from console_tickets where subject=$1", [`Invalid file ${marker}`])).rowCount === 0, "Anexo inválido impede criação parcial do chamado");

    // Como trabalhamos: the guided form, priorities by the team, the company's conditions and the ticket clock.
    r = await request("/como-trabalhamos", "support");
    ok(r.status === 200 && r.text.includes("Quando abrir um chamado") && r.text.includes("Contratar algo novo"), "Como trabalhamos abre para o cliente");
    const ticketRow = async (subject) =>
      (await database.query("select * from console_tickets where subject=$1", [subject])).rows[0];
    await submitForm("/chamados/novo", "support", "support", { action: "createTicket" }, {
      companyId: ids.a, subject: `Guided down ${marker}`, body: "Parou tudo", kind: "problem", impact: "down", priority: "critical", channel: "whatsapp",
    });
    let guided = await ticketRow(`Guided down ${marker}`);
    ok(
      guided?.kind === "problem" && guided.impact === "down" && guided.priority === "high" && guided.channel === "console" && guided.response_due_at === null,
      "Cliente não escolhe prioridade nem canal; sem condições, o impacto sugere Alta e não há prazo",
    );
    const termsFields = {
      companyId: ids.a, basis: "external_contract", preset: "support", label: `Suporte ${marker}`, levels: "on",
      criticalResponse: "4", criticalGoal: "9", highResponse: "9", highGoal: "27", normalResponse: "18", normalGoal: "90",
      responseClause: "SUP 5.1", pausesWhileWaiting: "on", pauseClause: "SUP 5.3", clientResponseDays: "5", testDays: "5",
      tacitAcceptance: "on", bankHours: "2", bankAlertPercent: "80", reportContestDays: "5", improvementBankLimit: "8",
      improvementWarrantyDays: "60", outOfHours: "not_included", includesDevelopment: "on", suspensionDays: "15",
      suspensionNotice: "on", publishAt: "", verified: "on",
    };
    await submitForm(`/empresas/${ids.a}`, "admin", "finance", { action: "saveServiceTerms" }, { ...termsFields, label: `Client terms ${marker}` });
    ok((await database.query("select id from console_service_terms where label=$1", [`Client terms ${marker}`])).rowCount === 0, "Cliente não grava condições de atendimento");
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "saveServiceTerms" }, termsFields);
    const savedTerms = (await database.query("select verified_at, policy from console_service_terms where company_id=$1 and active", [ids.a])).rows[0];
    ok(
      !!savedTerms?.verified_at && savedTerms.policy.response.critical.firstResponseMinutes === 240 && savedTerms.policy.response.normal.goalMinutes === 5400 && savedTerms.policy.hoursBank.monthlyMinutes === 120,
      "Equipe registra condições conferidas, em minutos úteis, com o banco de horas",
    );
    await submitForm("/chamados/novo", "support", "support", { action: "createTicket" }, {
      companyId: ids.a, subject: `Guided critical ${marker}`, body: "Parou de novo", kind: "problem", impact: "down",
    });
    guided = await ticketRow(`Guided critical ${marker}`);
    ok(
      guided?.priority === "critical" && !!guided.response_due_at && !!guided.resolution_due_at && guided.terms?.label === `Suporte ${marker}`,
      "Com condições, Parou tudo vira Crítica e o chamado guarda o contrato e os prazos",
    );
    await submitForm(`/chamados/${guided.id}`, "admin", "admin", { action: "updateTicket" }, { ticketId: guided.id, status: "waiting_customer" });
    ok((await ticketRow(`Guided critical ${marker}`)).status === "open", "Equipe não deixa o chamado esperando o cliente sem dizer o que falta");
    await submitForm(`/chamados/${guided.id}`, "admin", "admin", { action: "updateTicket" }, { ticketId: guided.id, status: "waiting_customer", waitingFor: `O print do erro ${marker}` });
    guided = await ticketRow(`Guided critical ${marker}`);
    ok(guided.status === "waiting_customer" && guided.waiting_for === `O print do erro ${marker}` && !!guided.waiting_since, "Aguardando o cliente guarda o que falta e desde quando");
    const askedAt = guided.first_response_at;
    ok(!!askedAt, "Pedir algo ao cliente conta como a primeira resposta da equipe");
    r = await request(`/chamados/${guided.id}`, "support");
    ok(r.text.includes("A equipe precisa de você para continuar") && r.text.includes(`O print do erro ${marker}`) && r.text.includes("Aguardando você") && r.text.includes("Prazos"), "Cliente vê o que falta, Aguardando você e os prazos");
    await submitForm(`/chamados/${guided.id}`, "support", "support", { action: "replyTicket" }, { ticketId: guided.id, body: "Segue o print" });
    guided = await ticketRow(`Guided critical ${marker}`);
    ok(guided.status === "open" && guided.waiting_for === null && guided.waiting_since === null, "A resposta do cliente devolve o chamado à equipe e retoma o prazo");
    await submitForm(`/chamados/${guided.id}`, "admin", "admin", { action: "replyTicket" }, { ticketId: guided.id, body: "Estamos olhando." });
    ok(String((await ticketRow(`Guided critical ${marker}`)).first_response_at) === String(askedAt), "A primeira resposta fica a primeira, mesmo com novas respostas");

    // Hours bank and improvement estimates (SUP 3 and 4).
    const bankMinutes = async () =>
      (await database.query("select coalesce(sum(minutes),0)::int n from console_time_entries where company_id=$1", [ids.a])).rows[0].n;
    await submitForm(`/chamados/${guided.id}`, "admin", "admin", { action: "logTime" }, { companyId: ids.a, ticketId: guided.id, hours: "1,5", note: "Diagnóstico", kind: "bank" });
    ok((await bankMinutes()) === 90, "Equipe registra horas no banco");
    await submitForm(`/chamados/${guided.id}`, "admin", "admin", { action: "logTime" }, { companyId: ids.a, ticketId: guided.id, hours: "1", note: "Correção", kind: "bank" });
    ok((await bankMinutes()) === 90, "Horas além do banco precisam de aprovação do cliente");
    await submitForm("/painel", "support", "support", { action: "approveOverage" }, { companyId: ids.a, hours: "50" });
    ok((await database.query("select id from console_hours_months where company_id=$1", [ids.a])).rowCount === 0, "Membro não aprova horas além do banco");
    await submitForm("/painel", "assisted", "assisted", { action: "approveOverage" }, { companyId: ids.a, hours: "50" });
    ok(
      (await database.query("select id from console_hours_months where company_id=$1", [ids.a])).rowCount === 0,
      "Equipe no acesso assistido não aprova horas além do banco pelo cliente",
    );
    await submitForm("/painel", "finance", "finance", { action: "approveOverage" }, { companyId: ids.a, hours: "2" });
    ok((await database.query("select overage_approved_minutes n from console_hours_months where company_id=$1", [ids.a])).rows[0]?.n === 120, "Administrador aprova horas além do banco");
    await submitForm(`/chamados/${guided.id}`, "admin", "admin", { action: "logTime" }, { companyId: ids.a, ticketId: guided.id, hours: "1", note: "Correção", kind: "bank" });
    ok((await bankMinutes()) === 150, "Com a aprovação, a equipe registra além do banco");
    await submitForm(`/chamados/${guided.id}`, "admin", "admin", { action: "proposeEstimate" }, { ticketId: guided.id, hours: "3" });
    ok((await ticketRow(`Guided critical ${marker}`)).estimate_status === "proposed", "Equipe envia a estimativa de uma melhoria");
    await submitForm(`/chamados/${guided.id}`, "support", "support", { action: "decideEstimate" }, { ticketId: guided.id, decision: "approve", minutes: "180" });
    ok((await ticketRow(`Guided critical ${marker}`)).estimate_status === "proposed", "Membro não aprova estimativa");
    await submitForm(`/chamados/${guided.id}`, "assisted", "assisted", { action: "decideEstimate" }, { ticketId: guided.id, decision: "approve", minutes: "180" });
    ok((await ticketRow(`Guided critical ${marker}`)).estimate_status === "proposed", "Equipe no acesso assistido não aprova a estimativa pelo cliente");
    await submitForm(`/chamados/${guided.id}`, "finance", "finance", { action: "decideEstimate" }, { ticketId: guided.id, decision: "approve", minutes: "120" });
    ok((await ticketRow(`Guided critical ${marker}`)).estimate_status === "proposed", "Aprovar uma estimativa que mudou não vale");
    await submitForm(`/chamados/${guided.id}`, "finance", "finance", { action: "decideEstimate" }, { ticketId: guided.id, decision: "approve", minutes: "180" });
    ok((await ticketRow(`Guided critical ${marker}`)).estimate_status === "approved", "Administrador aprova a estimativa");

    // The board's rules: a client task is a request, only the team concludes, the client approves in Revisão.
    const projectId = randomUUID();
    await database.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'project')", [projectId, ids.a, `Guided project ${marker}`]);
    const taskFields = { engagementId: projectId, title: `Client task ${marker}`, description: "", status: "done", priority: "normal", dueDate: "", estimate: "" };
    await submitForm(`/projetos/${projectId}`, "support", "support", { action: "createTask" }, taskFields);
    let task = (await database.query("select * from console_tasks where title=$1", [`Client task ${marker}`])).rows[0];
    ok(task?.status === "backlog" && task.requested === true, "Tarefa criada pelo cliente entra no Backlog como pedido");
    await submitForm(`/projetos/${projectId}`, "support", "support", { action: "updateTask" }, { ...taskFields, id: task.id, status: "todo" });
    ok((await database.query("select status from console_tasks where id=$1", [task.id])).rows[0].status === "backlog", "Pedido fica no Backlog até a equipe aceitar");
    await submitForm(`/projetos/${projectId}`, "admin", "admin", { action: "updateTask" }, { ...taskFields, id: task.id, status: "review" });
    task = (await database.query("select * from console_tasks where id=$1", [task.id])).rows[0];
    ok(task.status === "review" && task.requested === false && !!task.review_since, "A equipe aceita o pedido e manda para Revisão");
    await submitForm(`/projetos/${projectId}`, "support", "support", { action: "updateTask" }, { ...taskFields, id: task.id, status: "done" });
    ok((await database.query("select status from console_tasks where id=$1", [task.id])).rows[0].status === "review", "Só a equipe conclui; o cliente aprova na Revisão");
    await submitForm(`/projetos/${projectId}`, "support", "support", { action: "reviewTask" }, { id: task.id, decision: "approve" });
    ok((await database.query("select status from console_tasks where id=$1", [task.id])).rows[0].status === "review", "Membro não aprova entrega");
    await submitForm(`/projetos/${projectId}`, "finance", "finance", { action: "reviewTask" }, { id: task.id, decision: "approve" });
    task = (await database.query("select * from console_tasks where id=$1", [task.id])).rows[0];
    ok(task.status === "done" && task.approved_by === people.finance.id && !!task.approved_at, "Administrador aprova a entrega, com quem e quando");
    // "Atividade": the board's history reaches whoever sees the project, the client included.
    const boardPage = (await request(`/projetos/${projectId}`, "support")).text;
    ok(boardPage.includes("Atividade do projeto") && /task\.approved/.test(boardPage) && /task\.created/.test(boardPage) && boardPage.includes("QA finance"), "A atividade do projeto mostra quem criou e quem aprovou a entrega");
    ok(!boardPage.includes("company_archived") && !/"engagementId"/.test(boardPage), "A atividade não leva ao navegador detalhes além dos usados na frase");

    const bookmarkTitle = `Bookmark ${marker}`;
    await submitForm("/bookmarks", "support", "support", { action: "saveBookmark" }, { companyId: ids.a, engagementId: "", title: bookmarkTitle, url: "https://example.com/project" });
    const bookmark = (await database.query("select * from console_bookmarks where title=$1", [bookmarkTitle])).rows[0];
    ok(bookmark?.company_id === ids.a, "Bookmark de link persistido na empresa autorizada");
    await submitForm("/bookmarks", "support", "support", { action: "saveBookmark" }, { companyId: ids.b, engagementId: "", title: `Denied bookmark ${marker}`, url: "https://example.com" });
    ok((await database.query("select id from console_bookmarks where title=$1", [`Denied bookmark ${marker}`])).rowCount === 0, "Bookmark não pode ser criado em outra empresa");
    await submitForm("/bookmarks", "support", "support", { action: "saveBookmark" }, { companyId: ids.a, engagementId: "", title: `File bookmark ${marker}`, url: "", file: new File(["private project file"], "project.txt") });
    const fileBookmark = (await database.query("select id from console_bookmarks where title=$1", [`File bookmark ${marker}`])).rows[0];
    ok(!!fileBookmark, "Arquivo de projeto salvo em bookmark");
    const download = await request(`/api/bookmarks/${fileBookmark.id}`, "support");
    ok(download.status === 200 && download.text === "private project file" && download.headers.get("cache-control") === "private, no-store", "Download de bookmark privado retorna conteúdo correto");
    ok((await request(`/api/bookmarks/${fileBookmark.id}`, "outsider")).status === 404, "Outra conta não pode baixar arquivo do bookmark");
    ok((await request(`/api/bookmarks/${fileBookmark.id}`)).headers.get("location")?.includes("/entrar"), "Arquivo de bookmark exige autenticação");
    await submitForm("/bookmarks", "support", "finance", { action: "deleteBookmark" }, { id: bookmark.id });
    ok((await database.query("select id from console_bookmarks where id=$1", [bookmark.id])).rowCount === 1, "Outro membro não remove bookmark de terceiro");
    await submitForm("/bookmarks", "support", "support", { action: "deleteBookmark" }, { id: bookmark.id });
    ok((await database.query("select id from console_bookmarks where id=$1 and deleted_at is not null", [bookmark.id])).rowCount === 1, "Autor pode remover seu bookmark (vai para a lixeira)");
    const boardTitle = `Lousa ${marker}`;
    await submitForm("/bookmarks", "support", "support", { action: "saveBookmark" }, { companyId: ids.a, engagementId: "", title: boardTitle, url: "", kind: "board" });
    const board = (await database.query("select id, board from console_bookmarks where title=$1", [boardTitle])).rows[0];
    ok(Array.isArray(board?.board?.elements) && board.board.elements.length === 0, "Lousa nasce vazia na empresa autorizada");
    r = await request(`/bookmarks/${board.id}/lousa`, "support");
    ok(r.status === 200 && r.text.includes(boardTitle), "Quem criou a lousa abre a página dela");
    ok(notFoundPage(await request(`/bookmarks/${board.id}/lousa`, "outsider")), "Outra conta não abre a lousa");
    const scene = JSON.stringify({ type: "excalidraw", version: 2, elements: [{ id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 10, version: 1, isDeleted: false }], appState: { viewBackgroundColor: "#ffffff" }, files: {} });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const boardBody = (first = true) => {
      const body = new FormData();
      body.set("scene", scene);
      if (first) body.set("first", "1");
      body.set("preview", new File([png], "lousa.png", { type: "image/png" }));
      return body;
    };
    const draw = (who, body, origin = base) =>
      request(`/api/bookmarks/${board.id}/lousa`, who, { method: "PUT", body, headers: origin ? { Origin: origin } : {} });
    ok((await draw("support", boardBody())).status === 200, "Quem criou a lousa grava o desenho");
    ok((await draw("support", boardBody(false))).status === 200, "A gravação seguinte da mesma sessão também entra");
    const drawn = (await database.query("select board, preview, updated_at > created_at as touched from console_bookmarks where id=$1", [board.id])).rows[0];
    ok(drawn.board.elements.length === 1 && drawn.preview?.length === png.length && drawn.touched, "Desenho e miniatura ficam no banco");
    ok((await database.query("select id from console_audit_events where action='bookmark.board_edited' and entity_id=$1", [board.id])).rowCount === 1, "Uma sessão de desenho gera um registro na auditoria");
    ok((await draw("finance", boardBody())).status === 403, "Outro membro da empresa só lê a lousa");
    ok((await draw("outsider", boardBody())).status === 404, "Outra conta não grava na lousa");
    ok((await draw("support", boardBody(), null)).status === 403, "Gravar na lousa exige a origem do Console");
    const unreadable = new FormData();
    unreadable.set("scene", "{");
    ok((await draw("support", unreadable)).status === 400, "Desenho ilegível é recusado");
    const preview = await request(`/api/bookmarks/${board.id}/preview`, "finance");
    ok(preview.status === 200 && preview.headers.get("content-type") === "image/png" && preview.headers.get("cache-control") === "private, no-store", "Miniatura da lousa aparece para quem vê o bookmark");
    ok((await request(`/api/bookmarks/${board.id}/preview`, "outsider")).status === 404, "Outra conta não vê a miniatura");
    r = await request("/bookmarks", "finance");
    ok(r.text.includes(`/bookmarks/${board.id}/lousa`) && r.text.includes(`/api/bookmarks/${board.id}/preview`), "A lista mostra a lousa com a miniatura");
    const pressed = (html, label) =>
      new RegExp(`<button[^>]*aria-label="${label}"[^>]*aria-pressed="true"|<button[^>]*aria-pressed="true"[^>]*aria-label="${label}"`).test(html);
    r = await request("/bookmarks", "support");
    ok(pressed(r.text, "Grade") && !pressed(r.text, "Lista"), "Bookmarks abrem em grade por padrão");
    r = await request("/bookmarks", "support", {
      headers: { Cookie: `${people.support.cookie}; console-bookmarks-view=list` },
    });
    ok(pressed(r.text, "Lista") && r.text.includes(`File bookmark ${marker}`), "Bookmarks lembram a lista escolhida");
    for (const [path, cookie] of [
      ["/projetos", "console-projects-view"],
      ["/contratos", "console-contracts-view"],
      ["/produtos", "console-products-view"],
      ["/empresas", "console-companies-view"],
    ]) {
      r = await request(path, "admin");
      // An empty list has nothing to switch, so it shows no Lista · Grade toggle.
      if (!/aria-label="Grade"/.test(r.text)) {
        ok(!/aria-label="Lista"/.test(r.text), `${path} vazia não mostra Lista · Grade`);
        continue;
      }
      ok(pressed(r.text, "Grade") && !pressed(r.text, "Lista"), `${path} abre em grade por padrão`);
      r = await request(path, "admin", { headers: { Cookie: `${people.admin.cookie}; ${cookie}=list` } });
      ok(pressed(r.text, "Lista") && !pressed(r.text, "Grade"), `${path} lembra a lista escolhida`);
    }

    await submitForm("/chamados/novo", "support", "support", "subject", {
      companyId: ids.b,
      engagementId: "",
      subject: `Forbidden mutation ${marker}`,
      body: "Negar acesso cruzado",
      priority: "normal",
    });
    ok(
      (
        await database.query(
          "select id from console_tickets where subject=$1",
          [`Forbidden mutation ${marker}`],
        )
      ).rowCount === 0,
      "POST adulterado não cria chamado em outra empresa",
    );
    await submitForm(`/chamados/${created.id}`, "support", "support", "body", {
      ticketId: created.id,
      body: "Resposta do teste HTTP",
    });
    ok(
      (
        await database.query(
          "select id from console_messages where ticket_id=$1",
          [created.id],
        )
      ).rowCount === 2,
      "Resposta é persistida no chamado",
    );
    await submitForm("/financeiro/nova", "admin", "admin", "amount", {
      companyId: ids.a,
      engagementId: "",
      description: `Draft form ${marker}`,
      amount: "1250,29",
      dueDate: "2026-12-20",
    });
    const drafted = (
      await database.query(
        "select * from console_invoices where company_id=$1 and description=$2",
        [ids.a, `Draft form ${marker}`],
      )
    ).rows[0];
    ok(
      drafted?.amount_cents === 125029 &&
        drafted.status === "draft" &&
        drafted.provider_id === null,
      "Fatura manual salva em centavos sem emitir cobrança",
    );
    await submitForm("/financeiro/nova", "admin", "manager", "amount", {
      companyId: ids.a,
      engagementId: "",
      description: `Forbidden bill ${marker}`,
      amount: "10",
      dueDate: "2026-12-20",
    });
    ok(
      (
        await database.query(
          "select id from console_invoices where description=$1",
          [`Forbidden bill ${marker}`],
        )
      ).rowCount === 0,
      "Cliente não cria fatura via POST direto",
    );
    await submitForm(`/chamados/${created.id}`, "support", "support", "file", {
      ticketId: created.id,
      file: new File(["not a pdf"], "fake.pdf", { type: "application/pdf" }),
    });
    ok(
      (
        await database.query(
          "select id from console_attachments where ticket_id=$1",
          [created.id],
        )
      ).rowCount === 1,
      "Arquivo com MIME falso é recusado",
    );
    await submitForm(`/chamados/${created.id}`, "support", "support", "file", {
      ticketId: created.id,
      file: new File(["%PDF-1.7\nQA fixture"], "fixture.pdf", {
        type: "application/pdf",
      }),
    });
    ok(
      (
        await database.query(
          "select id from console_attachments where ticket_id=$1",
          [created.id],
        )
      ).rowCount === 2,
      "Upload de anexo é persistido com acesso privado",
    );
    await submitForm(`/financeiro/${drafted.id}`, "admin", "admin", { action: "updateDraft" }, {
      id: drafted.id,
      description: `Draft form ${marker}`,
      amount: "1300,25",
      dueDate: "2026-12-21",
    });
    ok(
      (
        await database.query(
          "select amount_cents from console_invoices where id=$1",
          [drafted.id],
        )
      ).rows[0].amount_cents === 130025,
      "Administrador edita valor e vencimento do rascunho",
    );
    // Contracts are drafts until sent; sending freezes a version the
    // company's finance people can read and sign.
    const contractInput = {
      companyId: ids.a,
      title: `Contract A ${marker}`,
    };
    const contractBody =
      "CLÁUSULA 1 — Prestação de serviços.\n\nCondições, valores e obrigações.";
    await submitForm(
      "/contratos/novo",
      "admin",
      "manager",
      { action: "createContract" },
      contractInput,
    );
    ok(
      !(
        await database.query(
          "select id from console_contracts where company_id=$1",
          [ids.a],
        )
      ).rowCount,
      "Cliente não cria contrato por POST direto",
    );
    await submitForm(
      "/contratos/novo",
      "admin",
      "admin",
      { action: "createContract" },
      contractInput,
    );
    let contract = (
      await database.query(
        "select * from console_contracts where company_id=$1",
        [ids.a],
      )
    ).rows[0];
    ok(
      contract && contract.status === "draft" && !contract.published_at,
      "Administrador cria contrato como rascunho privado",
    );
    const contractPath = `/contratos/${contract.id}`;
    const contractPdfPath = `/api/contratos/${contract.id}/pdf`;
    // Open {{fields}} are listed at the top of the draft, with what the Console already knows.
    await database.query("update console_contracts set body=$2 where id=$1", [
      contract.id,
      "Proposta {{numero_proposta}} para {{empresa}}.\n\n1.2. Escopo: {{escopo_funcional}}",
    ]);
    const fieldsPage = await request(contractPath, "admin");
    ok(
      fieldsPage.text.includes("Campos do contrato") &&
        fieldsPage.text.includes("Escopo funcional") &&
        fieldsPage.text.includes("Cadastro da empresa") &&
        fieldsPage.text.includes("Aplicar e salvar"),
      "Rascunho mostra os campos sem valor no topo, com sugestão do cadastro",
    );
    ok(!(await request(contractPath, "manager")).text.includes("Campos do contrato"), "Cliente não vê os campos do rascunho");
    await submitForm(contractPath, "admin", "admin", { action: "sendContract" }, { id: contract.id });
    ok(
      (await database.query("select status from console_contracts where id=$1", [contract.id])).rows[0].status === "draft",
      "Contrato com {{campo}} aberto no texto não vai para assinatura",
    );
    await submitForm(contractPath, "admin", "admin", { action: "saveContract" }, {
      id: contract.id,
      revision: String(contract.revision),
      title: contractInput.title,
      body: contractBody,
    });
    contract = (
      await database.query("select * from console_contracts where id=$1", [
        contract.id,
      ])
    ).rows[0];
    ok(contract.body === contractBody, "Administrador edita o rascunho");
    r = await request(contractPath, "finance");
    ok(
      !r.text.includes("Prestação de serviços") &&
        notFoundPage(r),
      "Cliente não acessa rascunho de contrato por URL",
    );
    r = await request(contractPdfPath, "finance");
    ok(r.status === 404, "PDF de rascunho é restrito à administração");
    r = await request(contractPdfPath, "admin");
    ok(
      r.status === 200 &&
        r.text.startsWith("%PDF-") &&
        r.headers.get("cache-control") === "private, no-store",
      "Administrador baixa PDF real do rascunho com fontes locais",
    );
    await submitForm(contractPath, "admin", "manager", { action: "sendContract" }, {
      id: contract.id,
    });
    ok(
      (
        await database.query("select status from console_contracts where id=$1", [
          contract.id,
        ])
      ).rows[0].status === "draft",
      "Cliente não envia contrato por POST direto",
    );
    await submitForm(contractPath, "admin", "admin", { action: "sendContract" }, {
      id: contract.id,
    });
    contract = (
      await database.query("select * from console_contracts where id=$1", [
        contract.id,
      ])
    ).rows[0];
    ok(
      contract.status === "sent" &&
        contract.published_at &&
        contract.published_version === 1 &&
        contract.document_hash,
      "Envio congela a versão 1 com hash do documento",
    );
    for (const person of ["finance", "manager"]) {
      r = await request(contractPath, person);
      ok(
        r.text.includes("Prestação de serviços") &&
          r.text.includes("Baixar PDF"),
        `Perfil ${person} visualiza contrato enviado`,
      );
    }
    r = await request(contractPath, "support");
    ok(
      notFoundPage(r) &&
        !r.text.includes("Prestação de serviços"),
      "Atendimento não acessa conteúdo contratual",
    );
    const pdfResponse = await fetch(base + contractPdfPath, {
      headers: { Cookie: people.finance.cookie },
    });
    const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
    ok(
      pdfResponse.status === 200 &&
        pdfBytes.subarray(0, 5).toString() === "%PDF-" &&
        pdfBytes.toString().includes("%%EOF") &&
        pdfResponse.headers.get("content-type") === "application/pdf",
      "Cliente baixa PDF real da versão enviada",
    );
    r = await request(contractPdfPath);
    ok(
      r.status === 401 || r.headers.get("location")?.includes("/entrar"),
      "PDF de contrato exige sessão",
    );
    r = await request(contractPdfPath, "support");
    ok(r.status === 404, "PDF de contrato respeita perfil financeiro");
    await submitForm(
      "/contratos/novo",
      "admin",
      "admin",
      { action: "createContract" },
      { companyId: ids.b, title: `PRIVATE-CONTRACT-B-${marker}` },
    );
    const contractB = (
      await database.query(
        "select * from console_contracts where company_id=$1",
        [ids.b],
      )
    ).rows[0];
    await submitForm(
      `/contratos/${contractB.id}`,
      "admin",
      "admin",
      { action: "sendContract" },
      { id: contractB.id },
    );
    r = await request("/contratos", "finance");
    ok(
      r.text.includes(contractInput.title) &&
        !r.text.includes(`PRIVATE-CONTRACT-B-${marker}`),
      "Lista de contratos é isolada por empresa",
    );
    r = await request(`/api/contratos/${contractB.id}/pdf`, "finance");
    ok(r.status === 404, "PDF de outra empresa é negado");
    await submitForm(contractPath, "admin", "admin", { action: "saveContract" }, {
      id: contract.id,
      revision: String(contract.revision),
      title: "Alteração indevida",
      body: "Inválido",
    });
    ok(
      (
        await database.query(
          "select title from console_contracts where id=$1",
          [contract.id],
        )
      ).rows[0].title === contractInput.title,
      "Contrato enviado não aceita edição do texto",
    );
    await submitForm(contractPath, "admin", "finance", { action: "revertContract" }, {
      id: contract.id,
    });
    ok(
      (
        await database.query("select status from console_contracts where id=$1", [
          contract.id,
        ])
      ).rows[0].status === "sent",
      "Cliente não volta contrato para rascunho",
    );
    await submitForm(contractPath, "admin", "admin", { action: "revertContract" }, {
      id: contract.id,
    });
    contract = (
      await database.query("select * from console_contracts where id=$1", [
        contract.id,
      ])
    ).rows[0];
    r = await request(contractPdfPath, "finance");
    ok(
      contract.status === "draft" &&
        !contract.published_at &&
        r.status === 404,
      "Voltar para rascunho tira o contrato do cliente",
    );
    const updatedBody =
      "PRIVATE-DRAFT-CHANGE — Condições revisadas.\n\nSegunda cláusula.";
    await submitForm(contractPath, "admin", "admin", { action: "saveContract" }, {
      id: contract.id,
      revision: String(contract.revision - 1),
      title: contractInput.title,
      body: updatedBody,
    });
    ok(
      (
        await database.query("select body from console_contracts where id=$1", [
          contract.id,
        ])
      ).rows[0].body === contractBody,
      "Edição de aba desatualizada é recusada",
    );
    await submitForm(contractPath, "admin", "admin", { action: "saveContract" }, {
      id: contract.id,
      revision: String(contract.revision),
      title: contractInput.title,
      body: updatedBody,
    });
    await submitForm(contractPath, "admin", "admin", { action: "sendContract" }, {
      id: contract.id,
    });
    contract = (
      await database.query("select * from console_contracts where id=$1", [
        contract.id,
      ])
    ).rows[0];
    r = await request(contractPath, "finance");
    ok(
      contract.published_version === 2 &&
        r.text.includes("PRIVATE-DRAFT-CHANGE"),
      "Novo envio cria a versão 2 e substitui o texto do cliente",
    );
    // Review rounds: the client asks for changes clause by clause, the team
    // answers each one and sends the next version.
    const changes = async () =>
      (
        await database.query(
          "select * from console_contract_change_requests where contract_id=$1 order by block_index",
          [contract.id],
        )
      ).rows;
    const contractRow = async () =>
      (await database.query("select * from console_contracts where id=$1", [contract.id])).rows[0];
    const ask = (who, blockIndex, comment, proposedText = "") =>
      submitForm(contractPath, "admin", who, { action: "saveChangeRequest" }, {
        contractId: contract.id,
        requestId: "",
        blockIndex: String(blockIndex),
        comment,
        proposedText,
      });
    await ask("support", 1, `Forbidden request ${marker}`);
    ok((await changes()).length === 0, "Membro sem acesso ao financeiro não pede alteração em contrato");
    await ask("assisted", 1, `Assisted request ${marker}`);
    ok((await changes()).length === 0, "Equipe no acesso assistido não pede alteração pelo cliente");
    await ask("finance", 1, `PRIVATE-REQUEST-${marker}`, "Segunda cláusula, com prazo de 15 dias.");
    await ask("finance", 0, `Explique melhor ${marker}`);
    let requests = await changes();
    ok(
      requests.length === 2 &&
        requests.every((q) => q.status === "draft" && q.version === 2) &&
        requests[1].label === "Parágrafo" &&
        requests[1].excerpt === "Segunda cláusula.",
      "Cliente escreve pedidos presos à cláusula da versão que está lendo",
    );
    r = await request(contractPath, "admin");
    ok(!r.text.includes(`PRIVATE-REQUEST-${marker}`), "Equipe não vê pedidos que o cliente ainda não enviou");
    await submitForm(contractPath, "admin", "finance", { action: "submitChangeRequests" }, { contractId: contract.id });
    requests = await changes();
    ok(
      (await contractRow()).status === "in_review" && requests.every((q) => q.status === "pending" && q.submitted_at),
      "Enviar os pedidos põe o contrato em revisão",
    );
    await submitForm(contractPath, "admin", "finance", { action: "signContract" }, { id: contract.id, consent: "on" });
    ok(
      (await database.query("select id from console_contract_signatures where contract_id=$1 and party='client'", [contract.id]))
        .rowCount === 0,
      "Contrato em revisão não pode ser assinado",
    );
    r = await request(contractPath, "finance");
    ok(r.status === 200 && r.text.includes("Em revisão"), "Cliente acompanha o contrato em revisão");
    await submitForm(contractPath, "admin", "finance", { action: "decideChangeRequest" }, {
      id: requests[1].id,
      decision: "accept",
      response: "",
    });
    ok((await changes())[1].status === "pending", "Cliente não decide os próprios pedidos");
    await submitForm(contractPath, "admin", "admin", { action: "sendContract" }, { id: contract.id });
    ok((await contractRow()).status === "in_review", "Nova versão só sai com todos os pedidos respondidos");
    await submitForm(contractPath, "admin", "admin", { action: "decideChangeRequest" }, {
      id: requests[1].id,
      decision: "accept",
      response: "Prazo ajustado.",
    });
    await submitForm(contractPath, "admin", "admin", { action: "decideChangeRequest" }, {
      id: requests[0].id,
      decision: "decline",
      response: "",
    });
    requests = await changes();
    ok(
      requests[1].status === "accepted" &&
        requests[1].applied &&
        (await contractRow()).body.includes("Segunda cláusula, com prazo de 15 dias.") &&
        requests[0].status === "pending",
      "Aceitar aplica o texto proposto no rascunho e recusar exige resposta",
    );
    await submitForm(contractPath, "admin", "admin", { action: "decideChangeRequest" }, {
      id: requests[0].id,
      decision: "decline",
      response: `PRIVATE-ANSWER-${marker}`,
    });
    await submitForm(contractPath, "admin", "admin", { action: "sendContract" }, { id: contract.id });
    const reviewed = await contractRow();
    ok(
      reviewed.status === "sent" &&
        reviewed.published_version === 3 &&
        reviewed.publication.body.includes("Segunda cláusula, com prazo de 15 dias."),
      "Respondidos os pedidos, a versão 3 sai com o texto aceito",
    );
    r = await request(contractPath, "finance");
    ok(
      r.text.includes(`PRIVATE-ANSWER-${marker}`) && r.text.includes("O que você pediu em cada versão"),
      "Cliente lê a resposta a cada pedido junto com a nova versão",
    );
    // Proposals: the negotiated discount comes off the hours' value and is
    // frozen with the version the client answers.
    const quoteContent = (discountCents) =>
      JSON.stringify({
        summary: "Sistema de teste",
        stack: ["Next.js"],
        phases: [
          { name: "Fase 1", description: "", hoursMin: 48, hoursMax: 60, tasks: [{ title: "Tarefa", description: "" }] },
        ],
        hourlyRateCents: 4000,
        discountCents,
        upfrontPercent: 50,
        notes: "",
      });
    const quoteTitle = `Quote A ${marker}`;
    await submitForm("/orcamentos/novo", "admin", "admin", { action: "createQuote" }, {
      companyId: ids.a,
      title: quoteTitle,
      validUntil: "",
      content: quoteContent(0),
    });
    let quote = (await database.query("select * from console_quotes where title=$1", [quoteTitle])).rows[0];
    ok(quote?.status === "draft", "Equipe cria orçamento em rascunho");
    const quotePath = `/orcamentos/${quote.id}`;
    const saveQuoteWith = (who, discountCents) =>
      submitForm(quotePath, "admin", who, { action: "saveQuote" }, {
        id: quote.id,
        revision: String(quote.revision),
        title: quoteTitle,
        validUntil: "",
        content: quoteContent(discountCents),
      });
    await saveQuoteWith("manager", 24000);
    ok(
      (await database.query("select content from console_quotes where id=$1", [quote.id])).rows[0].content.discountCents === 0,
      "Cliente não altera orçamento por POST direto",
    );
    await saveQuoteWith("admin", 240001);
    ok(
      (await database.query("select content from console_quotes where id=$1", [quote.id])).rows[0].content.discountCents === 0,
      "Desconto acima do valor das horas é recusado",
    );
    await saveQuoteWith("admin", 24000);
    quote = (await database.query("select * from console_quotes where id=$1", [quote.id])).rows[0];
    ok(quote.content.discountCents === 24000, "Equipe salva desconto negociado no orçamento");
    await submitForm(quotePath, "admin", "admin", { action: "sendQuote" }, { id: quote.id });
    quote = (await database.query("select * from console_quotes where id=$1", [quote.id])).rows[0];
    ok(
      quote.status === "sent" && quote.publication.discountCents === 24000 && !!quote.document_hash,
      "Envio congela o desconto na versão do cliente",
    );
    r = await request(quotePath, "finance");
    ok(
      r.status === 200 && r.text.includes("R$\u00a02.160,00") && r.text.includes("desconto negociado"),
      "Cliente vê o total com desconto na proposta",
    );
    const quotePdf = await fetch(`${base}/api/orcamentos/${quote.id}/pdf`, {
      headers: { Cookie: people.finance.cookie },
    });
    ok(
      quotePdf.status === 200 &&
        Buffer.from(await quotePdf.arrayBuffer()).subarray(0, 5).toString() === "%PDF-",
      "PDF do orçamento com desconto é gerado",
    );
    const clientAddress = {
      endereco: "Rua Teste",
      numero: "10",
      complemento: "Sala 2",
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
      cep: "01001-000",
      codigoMunicipio: "3550308",
    };
    const originalDocument = (
      await database.query(
        "select document from console_companies where id=$1",
        [ids.a],
      )
    ).rows[0].document;
    const companyInput = {
      id: ids.a,
      document: originalDocument,
      name: `QA Company A ${marker}`,
      billingEmail: "qa-A@example.invalid",
      phone: "(11) 99999-1234",
      ...clientAddress,
      autoIssueNfse: "yes",
    };
    await submitForm(
      `/empresas/${ids.a}`,
      "admin",
      "manager",
      { action: "updateCompany" },
      companyInput,
    );
    let companyState = (
      await database.query("select * from console_companies where id=$1", [
        ids.a,
      ])
    ).rows[0];
    ok(
      !companyState.billing_address &&
        !companyState.auto_issue_nfse &&
        companyState.document === originalDocument,
      "Cliente não altera endereço ou preferência fiscal por POST direto",
    );
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "updateCompany" }, {
      ...companyInput,
      cep: "123",
    });
    companyState = (
      await database.query("select * from console_companies where id=$1", [
        ids.a,
      ])
    ).rows[0];
    ok(
      !companyState.billing_address && !companyState.auto_issue_nfse,
      "Endereço incompleto é rejeitado sem salvar parcialmente a preferência",
    );
    await submitForm(
      `/empresas/${ids.a}`,
      "admin",
      "admin",
      { action: "updateCompany" },
      companyInput,
    );
    companyState = (
      await database.query("select * from console_companies where id=$1", [
        ids.a,
      ])
    ).rows[0];
    ok(
      companyState.billing_address.cep === "01001000" &&
        companyState.billing_address.complemento === "Sala 2" &&
        companyState.auto_issue_nfse,
      "Administrador salva endereço normalizado e preferência fiscal por cliente",
    );
    r = await request(`/empresas/${ids.a}`, "admin");
    ok(
      r.text.includes(">Ativada<") && r.text.includes("Sala 2"),
      "Cadastro reaberto mostra endereço e opção fiscal salvos",
    );
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "updateCompany" }, {
      ...companyInput,
      autoIssueNfse: "",
    });
    companyState = (
      await database.query("select * from console_companies where id=$1", [
        ids.a,
      ])
    ).rows[0];
    ok(
      !companyState.auto_issue_nfse &&
        companyState.billing_address.endereco === "Rua Teste",
      "Desmarcar a opção desativa a preferência sem apagar o endereço",
    );
    const replacementDocument = "98.765.432/0001-10";
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "updateCompany" }, {
      ...companyInput,
      document: replacementDocument,
    });
    companyState = (
      await database.query("select * from console_companies where id=$1", [
        ids.a,
      ])
    ).rows[0];
    ok(
      companyState.document === "98765432000110" &&
        companyState.billing_address.endereco === "Rua Teste",
      "Administrador altera CNPJ, normaliza máscara e mantém endereço e vínculo da empresa",
    );
    const documentAudit = (
      await database.query(
        "select details from console_audit_events where company_id=$1 and details->'document'->>'after'=$2",
        [ids.a, companyState.document],
      )
    ).rows[0];
    ok(
      documentAudit?.details.document.before === originalDocument,
      "Troca do documento registra valor anterior e novo na auditoria",
    );
    companyInput.document = companyState.document;
    const duplicateDocument = (
      await database.query(
        "select document from console_companies where id=$1",
        [ids.b],
      )
    ).rows[0].document;
    await submitForm(
      `/empresas/${ids.a}`,
      "admin",
      "admin",
      { action: "updateCompany" },
      {
        ...companyInput,
        document: duplicateDocument,
        name: "Não salvar parcialmente",
      },
    );
    companyState = (
      await database.query("select * from console_companies where id=$1", [
        ids.a,
      ])
    ).rows[0];
    ok(
      companyState.document === companyInput.document &&
        companyState.name === companyInput.name,
      "CNPJ duplicado não salva parcialmente o cadastro",
    );
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "updateCompany" }, {
      ...companyInput,
      document: "123",
    });
    await submitForm(`/empresas/${ids.a}`, "admin", "manager", { action: "updateCompany" }, {
      ...companyInput,
      document: originalDocument,
    });
    companyState = (
      await database.query("select * from console_companies where id=$1", [
        ids.a,
      ])
    ).rows[0];
    ok(
      companyState.document === companyInput.document,
      "Documento incompleto e alteração por cliente são bloqueados no servidor",
    );
    // Several finance contacts: the team's form saves them as the billing recipients, the main ones first.
    const financeKey = `${ids.a}:billing`;
    const financeBefore = (
      await database.query("select * from console_notification_preferences where key=$1", [financeKey])
    ).rows[0];
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "updateCompany" }, {
      ...companyInput,
      financeContacts: "1",
      financeEmails: ["contas.qa@exemplo.com.br", "CONTAS.QA@exemplo.com.br", ""],
      financePhones: ["(11) 98888-7777"],
    });
    const financeSaved = (
      await database.query("select emails, phones from console_notification_preferences where key=$1", [financeKey])
    ).rows[0];
    companyState = (await database.query("select * from console_companies where id=$1", [ids.a])).rows[0];
    ok(
      financeSaved?.emails?.length === 2 &&
        financeSaved.emails[0] === companyState.billing_email &&
        financeSaved.emails[1] === "contas.qa@exemplo.com.br" &&
        financeSaved.phones?.length === 2 &&
        financeSaved.phones[0] === companyState.phone &&
        financeSaved.phones[1] === "11988887777",
      "O cadastro guarda vários e-mails e telefones do financeiro como destinatários da cobrança",
    );
    const financePage = await request(`/empresas/${ids.a}`, "admin");
    ok(
      financePage.text.includes("E-mails do financeiro") && financePage.text.includes("contas.qa@exemplo.com.br"),
      "A empresa mostra todos os contatos do financeiro",
    );
    const tooMany = await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "updateCompany" }, {
      ...companyInput,
      financeContacts: "1",
      financeEmails: Array.from({ length: 10 }, (_, i) => `extra${i}.qa@exemplo.com.br`),
    });
    ok(
      tooMany.status === 200 &&
        (await database.query("select emails from console_notification_preferences where key=$1", [financeKey])).rows[0]
          ?.emails?.length === 2,
      "Mais de 10 contatos do financeiro é recusado sem salvar",
    );
    // Back to how the company was, for the billing tests ahead.
    if (financeBefore)
      await database.query(
        "update console_notification_preferences set emails=$2, phones=$3, email=$4, phone=$5 where key=$1",
        [financeKey, JSON.stringify(financeBefore.emails), JSON.stringify(financeBefore.phones), financeBefore.email, financeBefore.phone],
      );
    else await database.query("delete from console_notification_preferences where key=$1", [financeKey]);
    const archiveData = { id: ids.a, archived: "yes" };
    const relations = async () =>
      (
        await database.query(
          `select
    (select count(*) from console_tickets where company_id=$1)::int tickets,
    (select count(*) from console_invoices where company_id=$1)::int invoices,
    (select count(*) from console_memberships where company_id=$1 and active=true)::int memberships`,
          [ids.a],
        )
      ).rows[0];
    const beforeArchive = await relations();
    await submitForm(
      `/empresas/${ids.a}`,
      "admin",
      "manager",
      { action: "setCompanyArchived" },
      archiveData,
    );
    ok(
      !(
        await database.query(
          "select archived from console_companies where id=$1",
          [ids.a],
        )
      ).rows[0].archived,
      "Cliente não consegue arquivar a própria empresa por POST direto",
    );
    const archiveBody = () =>
      actionBody("setCompanyArchived", archiveData);
    for (let attempt = 0; attempt < 2; attempt++)
      await request(`/empresas/${ids.a}`, "admin", {
        method: "POST",
        body: archiveBody(),
        headers: { Origin: base },
      });
    const activeList = await request("/empresas", "admin");
    const archivedList = await request("/empresas?status=archived", "admin");
    ok(
      !activeList.text.includes(`/empresas/${ids.a}`) &&
        archivedList.text.includes(`/empresas/${ids.a}`),
      "Arquivar remove cliente dos ativos e o mostra somente na lista de arquivados",
    );
    assert.deepEqual(await relations(), beforeArchive);
    ok(
      (await request(`/chamados/${ids.ticketA}`, "manager")).status === 200,
      "Arquivamento preserva chamados, faturas, vínculos e acesso ao histórico",
    );
    ok(
      (
        await database.query(
          "select count(*)::int n from console_audit_events where company_id=$1 and action='company.archived'",
          [ids.a],
        )
      ).rows[0].n === 1,
      "Reenvio do arquivamento não duplica evento de auditoria",
    );
    await submitForm(
      `/empresas/${ids.a}`,
      "admin",
      "admin",
      { action: "setCompanyArchived" },
      { id: ids.a, archived: "no" },
    );
    ok(
      (await request("/empresas", "admin")).text.includes(
        `/empresas/${ids.a}`,
      ) &&
        !(await request("/empresas?status=archived", "admin")).text.includes(
          `/empresas/${ids.a}`,
        ),
      "Restaurar devolve cliente à lista principal",
    );
    ok(
      (
        await database.query(
          "select count(*)::int n from console_audit_events where company_id=$1 and action='company.restored'",
          [ids.a],
        )
      ).rows[0].n === 1,
      "Restauração fica registrada na auditoria",
    );
    const newDocument = BigInt(
      `0x${randomUUID().replaceAll("-", "").slice(0, 11)}`,
    )
      .toString()
      .padStart(14, "0");
    await submitForm("/empresas/nova", "admin", "admin", "Cadastrar empresa", {
      name: `QA New ${marker}`,
      document: newDocument,
      billingEmail: "new@example.invalid",
      phone: "(11) 99999-1234",
      ...clientAddress,
      autoIssueNfse: "yes",
    });
    const newCompany = (
      await database.query(
        "select * from console_companies where document=$1",
        [newDocument],
      )
    ).rows[0];
    if (newCompany) companyIds.push(newCompany.id);
    ok(
      newCompany?.billing_address.cidade === "São Paulo" &&
        newCompany.auto_issue_nfse,
      "Cadastro de novo cliente também persiste endereço e opção fiscal",
    );
    r = await request(`/financeiro/${ids.draft}`, "admin");
    ok(
      !r.text.includes('name="endereco"') &&
        r.text.includes("Rua Teste") &&
        r.text.includes(`/empresas/${ids.a}`),
      "Fatura usa resumo do cadastro sem pedir endereço novamente",
    );
    const bankInput = {
      id: ids.draft,
      numDiasAgenda: "30",
      confirm: "yes",
      endereco: "Endereço forjado ignorado",
      cep: "99999999",
    };
    await database.query(
      "update console_invoices set due_date='2099-12-20', amount_cents=1000 where id=$1",
      [ids.draft],
    );
    await submitForm(
      `/financeiro/${ids.draft}`,
      "admin",
      "manager",
      "Publicar cobrança no Inter",
      bankInput,
    );
    ok(
      !(
        await database.query(
          "select bank_request from console_invoices where id=$1",
          [ids.draft],
        )
      ).rows[0].bank_request,
      "Cliente não emite cobrança por POST direto",
    );
    await submitForm(
      `/financeiro/${ids.draft}`,
      "admin",
      "admin",
      "Publicar cobrança no Inter",
      { ...bankInput, confirm: "" },
    );
    ok(
      !(
        await database.query(
          "select bank_request from console_invoices where id=$1",
          [ids.draft],
        )
      ).rows[0].bank_request,
      "Emissão exige confirmação explícita",
    );
    await database.query(
      "update console_companies set billing_address=null where id=$1",
      [ids.a],
    );
    await submitForm(
      `/financeiro/${ids.draft}`,
      "admin",
      "admin",
      "Publicar cobrança no Inter",
      { ...bankInput, ...clientAddress },
    );
    ok(
      !(
        await database.query(
          "select bank_request from console_invoices where id=$1",
          [ids.draft],
        )
      ).rows[0].bank_request,
      "Endereço enviado na fatura não substitui cadastro ausente nem inicia emissão",
    );
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "updateCompany" }, {
      ...companyInput,
      autoIssueNfse: "",
    });

    await submitForm(
      `/financeiro/${ids.draft}`,
      "admin",
      "admin",
      "Publicar cobrança no Inter",
      bankInput,
    );
    const bankInvoice = (
      await database.query("select * from console_invoices where id=$1", [
        ids.draft,
      ])
    ).rows[0];
    ok(
      bankInvoice.status === "issued" &&
        bankInvoice.provider_id &&
        bankInvoice.bank_status === "EM_PROCESSAMENTO",
      "Emissão com Inter simulado persiste identificador sem marcar pagamento",
    );
    ok(
      bankInvoice.bank_request.pagador.endereco === "Rua Teste" &&
        bankInvoice.bank_request.pagador.cep === "01001000" &&
        bankInvoice.bank_request.pagador.complemento === "Sala 2" &&
        !("codigoMunicipio" in bankInvoice.bank_request.pagador),
      "Inter recebe endereço salvo e ignora dados forjados e campos fiscais exclusivos",
    );
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "updateCompany" }, {
      ...companyInput,
      endereco: "Rua Atualizada",
    });
    ok(
      (
        await database.query(
          "select bank_request from console_invoices where id=$1",
          [ids.draft],
        )
      ).rows[0].bank_request.pagador.endereco === "Rua Teste",
      "Alterar cadastro não modifica os dados de uma cobrança já emitida",
    );
    ok(
      (
        await database.query(
          "select count(*)::int as n from console_invoices where company_id=$1 and fiscal_status <> 'not_requested'",
          [ids.a],
        )
      ).rows[0].n === 0,
      "Preferência fiscal não simula emissão enquanto integração está pendente",
    );

    await submitForm(
      `/financeiro/${ids.draft}`,
      "admin",
      "admin",
      "Consultar cobrança no Inter",
      { id: ids.draft },
    );
    ok(
      (
        await database.query(
          "select boleto_line from console_invoices where id=$1",
          [ids.draft],
        )
      ).rows[0].boleto_line.length === 47,
      "Consulta de Inter simulado grava linha digitável e Pix",
    );
    r = await request(`/api/boletos/${ids.draft}`, "finance");
    ok(
      r.status === 200 &&
        r.text.startsWith("%PDF-") &&
        r.headers.get("cache-control") === "private, no-store",
      "Boleto simulado tem download privado para financeiro",
    );
    r = await request(`/api/boletos/${ids.draft}`, "support");
    ok(r.status === 404, "Atendimento não baixa boleto");
    r = await request(`/api/boletos/${ids.draft}`, "outsider");
    ok(r.status === 404, "Boleto de outra empresa é negado");
    r = await request("/api/cron/billing-sync");
    ok(r.status === 401, "Conciliação automática exige segredo do cron");
    await database.query(
      "update console_invoices set bank_checked_at=now()-interval '6 minutes' where id=$1",
      [ids.draft],
    );
    await database.query(
      "update console_invoices set amount_cents=amount_cents+1 where id=$1",
      [ids.draft],
    );
    r = await request("/api/cron/billing-sync", undefined, {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    ok(
      r.status === 503 &&
        JSON.parse(r.text).failed === 1 &&
        (
          await database.query(
            "select status from console_invoices where id=$1",
            [ids.draft],
          )
        ).rows[0].status === "issued",
      "Dados divergentes do banco não confirmam pagamento e sinalizam falha",
    );
    await database.query(
      "update console_invoices set amount_cents=amount_cents-1 where id=$1",
      [ids.draft],
    );
    r = await request("/api/cron/billing-sync", undefined, {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    ok(
      r.status === 200 && JSON.parse(r.text).checked === 1,
      "Cron consulta cobrança pendente diretamente no Inter",
    );
    ok(
      (
        await database.query(
          "select status from console_invoices where id=$1",
          [ids.draft],
        )
      ).rows[0].status === "paid",
      "Pix recebido é conciliado automaticamente sem ação do administrador",
    );
    const autoAudit = await database.query(
      "select details from console_audit_events where entity_id=$1 and action='invoice.bank_checked' and details->>'source'='scheduled'",
      [ids.draft],
    );
    ok(
      autoAudit.rows.length === 1 &&
        autoAudit.rows[0].details.status === "RECEBIDO",
      "Conciliação automática registra origem e confirmação do banco",
    );
    r = await request("/api/cron/billing-sync", undefined, {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    ok(
      r.status === 200 && JSON.parse(r.text).checked === 0,
      "Cron repetido não reprocessa fatura paga",
    );
    await submitForm(
      `/financeiro/${ids.draft}`,
      "admin",
      "admin",
      "Consultar cobrança no Inter",
      { id: ids.draft },
    );
    ok(
      (
        await database.query(
          "select status from console_invoices where id=$1",
          [ids.draft],
        )
      ).rows[0].status === "paid",
      "Conciliação simulada confirma pagamento somente após consulta ao banco",
    );
    await submitForm(
      `/financeiro/${drafted.id}`,
      "admin",
      "admin",
      { action: "cancelDraft" },
      {
        id: drafted.id,
      },
    );
    ok(
      (
        await database.query(
          "select status from console_invoices where id=$1",
          [drafted.id],
        )
      ).rows[0].status === "cancelled",
      "Administrador cancela somente rascunho",
    );
    // A charge the Inter itself cancelled, as the reconciliation records it.
    const closedCharge = async (values = {}) => {
      const id = randomUUID();
      await database.query(
        "insert into console_invoices(id,company_id,subscription_id,status,description,amount_cents,due_date,provider_id,bank_request,bank_base,bank_status,public_id) values($1,$2,$3,'cancelled',$4,12345,$5,$6,$7,$8,'CANCELADO',$9)",
        [
          id,
          ids.a,
          values.subscriptionId ?? null,
          `Closed at bank ${marker}`,
          values.dueDate ?? "2026-08-10",
          randomUUID(),
          JSON.stringify({ seuNumero: id.slice(0, 15) }),
          "https://cdpj.partners.bancointer.com.br",
          randomUUID().replaceAll("-", ""),
        ],
      );
      await database.query(
        "insert into console_audit_events(id,actor_id,company_id,action,entity_id) values($1,$2,$3,'invoice.bank_accepted',$4)",
        [randomUUID(), people.admin.id, ids.a, id],
      );
      return id;
    };
    const invoiceExists = async (id) =>
      (await database.query("select id from console_invoices where id=$1", [id]))
        .rowCount === 1;
    const closedId = await closedCharge();
    await submitForm(`/financeiro/${closedId}`, "admin", "manager", { action: "deleteDraftInvoice" }, { id: closedId });
    ok(await invoiceExists(closedId), "Cliente não exclui fatura cancelada no Inter");
    await submitForm(`/financeiro/${closedId}`, "admin", "admin", { action: "deleteDraftInvoice" }, { id: closedId });
    const deletedAudit = (
      await database.query(
        "select details from console_audit_events where entity_id=$1 and action='invoice.deleted'",
        [closedId],
      )
    ).rows[0];
    ok(
      !(await invoiceExists(closedId)) &&
        deletedAudit?.details.bankStatus === "CANCELADO" &&
        !!deletedAudit.details.providerId,
      "Equipe exclui fatura que o Inter cancelou e a atividade guarda o registro",
    );
    await submitForm(`/financeiro/${ids.draft}`, "admin", "admin", { action: "deleteDraftInvoice" }, { id: ids.draft });
    ok(await invoiceExists(ids.draft), "Fatura paga nunca é excluída");
    const periodSub = randomUUID();
    await database.query(
      "insert into console_subscriptions(id,company_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,status,actor_id) values($1,$2,$3,12345,'monthly',10,8,'2026-08-10','paused',$4)",
      [periodSub, ids.a, `Closed period ${marker}`, people.admin.id],
    );
    const pendingPeriod = await closedCharge({ subscriptionId: periodSub });
    await submitForm(`/financeiro/${pendingPeriod}`, "admin", "admin", { action: "deleteDraftInvoice" }, { id: pendingPeriod });
    ok(
      await invoiceExists(pendingPeriod),
      "Fatura cancelada no Inter fica enquanto a recorrência ainda vai cobrar aquele vencimento",
    );
    await database.query("update console_subscriptions set next_due_date='2026-09-10' where id=$1", [periodSub]);
    await submitForm(`/financeiro/${pendingPeriod}`, "admin", "admin", { action: "deleteDraftInvoice" }, { id: pendingPeriod });
    ok(
      !(await invoiceExists(pendingPeriod)) &&
        (await database.query("select id from console_subscriptions where id=$1", [periodSub])).rowCount === 1,
      "Período já passado sai sem levar a recorrência junto",
    );
    // The billing suite counts every recurrence; this fixture must not linger.
    await database.query("delete from console_subscriptions where id=$1", [periodSub]);
    await database.query(
      "update console_memberships set active=false where email=$1",
      [people.support.email],
    );
    r = await request(`/api/anexos/${ids.attachment}`, "support");
    ok(r.status === 404, "Revogação tem efeito imediato em sessão existente");
    const s = await request("/api/auth/sign-in/social", undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({
        provider: "google",
        callbackURL: base + "/painel",
      }),
    });
    const social = JSON.parse(s.text);
    const url = new URL(social.url);
    ok(
      url.hostname === "accounts.google.com" &&
        url.searchParams.get("redirect_uri") ===
          base + "/api/auth/callback/google",
      "OAuth Google gera callback do ambiente correto",
    );
    async function drain() {
      const r = await fetch(base + "/api/cron/ticket-notifications", {
        headers: { Authorization: "Bearer test-cron-secret" },
      });
      assert.equal(r.status, 200, "Cron autorizado");
      for (let attempt = 0; attempt < 50; attempt++) {
        const active = (
          await database.query(
            "select count(*)::int n from console_ticket_notices where status='processing'",
          )
        ).rows[0].n;
        if (!active) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw Error("Worker de notificação não terminou");
    }
    const noticeRows = async () =>
      (
        await database.query(
          "select * from console_ticket_notices where ticket_id=$1 and preference_key is distinct from 'author:tickets' order by created_at",
          [created.id],
        )
      ).rows;
    await drain();
    let notices = await noticeRows();
    // Whoever opens a ticket gets a receipt and later movements; the counts
    // below are the operation's notices, which follow company preferences.
    const receipts = (
      await database.query(
        "select * from console_ticket_notices where ticket_id=$1 and preference_key='author:tickets'",
        [created.id],
      )
    ).rows;
    ok(
      notices.length === 6,
      "Abertura, resposta e anexo geram um aviso por canal",
    );
    ok(
      receipts.length === 1 &&
        receipts[0].channel === "email" &&
        receipts[0].destination === people.support.email,
      "Quem abre o chamado recebe um recibo por e-mail",
    );
    ok(
      notices.every(
        (n) =>
          n.destination.replace(/^\+/, "") ===
          (n.channel === "email" ? adminEmail : "5511999990001"),
      ),
      "Sem preferência ativa, avisos continuam somente na operação",
    );
    ok(
      notices.every((n) => n.status === "accepted"),
      "Aceite do provedor é registrado sem afirmar entrega",
    );
    // From here the FLW confirms delivery when the worker asks.
    flags({ approved: true });
    const whatsappPayloads = sentNotices().filter(
      (n) => n.channel === "whatsapp",
    );
    ok(
      whatsappPayloads.every(
        (n) =>
          n.payload.templateId === "test-ticket-template" &&
          n.payload.parameters["[nome_do_cliente]"] ===
            `QA Company A ${marker}` &&
          n.payload.options.enableBot === false,
      ),
      "WhatsApp usa o modelo e o nome do cliente sem acionar chatbot",
    );
    r = await request("/api/cron/ticket-notifications");
    ok(r.status === 401, "Cron de notificações exige segredo");
    r = await request("/configuracoes/notificacoes", "manager");
    ok(
      r.status === 200 &&
        !r.text.includes(adminEmail) &&
        !r.text.includes("5511999990001"),
      "Envios da operação não aparecem no histórico da empresa",
    );
    async function changeTicket(status, assignedTo = "") {
      await submitForm(`/chamados/${created.id}`, "admin", "admin", "status", {
        ticketId: created.id,
        status,
        assignedTo,
      });
      await drain();
    }
    await changeTicket("closed");
    ok((await noticeRows()).length === 8, "Encerramento gera os dois avisos");
    await changeTicket("closed");
    ok(
      (await noticeRows()).length === 8,
      "Salvar sem movimentação não duplica avisos",
    );
    await submitForm(`/chamados/${ids.ticketA}`, "manager", "manager", "body", {
      ticketId: created.id,
      body: "Resposta bloqueada no chamado encerrado",
    });
    ok((await noticeRows()).length === 8, "Interação recusada não gera aviso");
    await changeTicket("open");
    ok((await noticeRows()).length === 10, "Reabertura gera os dois avisos");
    await changeTicket("open", adminEmail);
    ok(
      (await noticeRows()).length === 12,
      "Troca de responsável gera os dois avisos",
    );
    flags({ approved: false });
    await submitForm(`/chamados/${created.id}`, "manager", "manager", "body", {
      ticketId: created.id,
      body: "Modelo ainda em análise",
    });
    await drain();
    notices = await noticeRows();
    const waiting = notices.find(
      (n) => n.channel === "whatsapp" && n.status === "pending",
    );
    ok(
      !!waiting &&
        notices
          .filter((n) => n.channel === "email")
          .every((n) => n.status === "accepted"),
      "Modelo em análise mantém WhatsApp na fila sem impedir o e-mail",
    );
    flags({ approved: true });
    await database.query(
      "update console_ticket_notices set next_attempt_at=now() where id=$1",
      [waiting.id],
    );
    await Promise.all([drain(), drain()]);
    ok(
      sentNotices().filter((n) => n.key === waiting.id).length === 1,
      "Workers concorrentes enviam apenas uma mensagem após aprovação",
    );
    await database.query(
      "update console_ticket_notices set next_attempt_at=now() where id=$1",
      [waiting.id],
    );
    await drain();
    ok(
      (
        await database.query(
          "select status from console_ticket_notices where id=$1",
          [waiting.id],
        )
      ).rows[0].status === "delivered",
      "Entrega WhatsApp é confirmada por consulta ao FLW",
    );
    flags({ approved: true, email503: true });
    await submitForm(`/chamados/${created.id}`, "manager", "manager", "body", {
      ticketId: created.id,
      body: "Falha temporária de e-mail",
    });
    await drain();
    const retry = (await noticeRows()).find(
      (n) => n.channel === "email" && n.status === "pending",
    );
    ok(!!retry, "Falha temporária do Resend permanece na fila");
    flags({ approved: true });
    await database.query(
      "update console_ticket_notices set next_attempt_at=now() where id=$1",
      [retry.id],
    );
    await drain();
    const attempts = sentNotices().filter(
      (n) => n.key === `ticket-${retry.id}`,
    );
    ok(
      attempts.length === 2 &&
        JSON.stringify(attempts[0].payload) ===
          JSON.stringify(attempts[1].payload),
      "Reenvio de e-mail preserva chave e conteúdo idempotentes",
    );
    flags({ approved: true, whatsappTimeout: true });
    await submitForm(`/chamados/${created.id}`, "manager", "manager", "body", {
      ticketId: created.id,
      body: "Resposta incerta do WhatsApp",
    });
    await drain();
    const uncertain = (await noticeRows()).find(
      (n) => n.status === "uncertain",
    );
    ok(!!uncertain, "Timeout de WhatsApp exige conferência, sem afirmar envio");
    flags({ approved: true });
    await drain();
    ok(
      sentNotices().filter((n) => n.key === uncertain.id).length === 1,
      "WhatsApp incerto não é reenviado automaticamente",
    );
    flags({ approved: false });
    await submitForm(`/chamados/${created.id}`, "manager", "manager", "body", {
      ticketId: created.id,
      body: "Destinatário removido antes do envio",
    });
    await drain();
    const cancel = (await noticeRows()).find(
      (n) => n.channel === "whatsapp" && n.status === "pending",
    );
    await database.query(
      "update console_user set phone_number_verified=false where id=$1",
      [people.admin.id],
    );
    await database.query(
      "update console_ticket_notices set next_attempt_at=now() where id=$1",
      [cancel.id],
    );
    flags({ approved: true });
    await drain();
    ok(
      (
        await database.query(
          "select status from console_ticket_notices where id=$1",
          [cancel.id],
        )
      ).rows[0].status === "cancelled",
      "WhatsApp desvinculado deixa de receber avisos pendentes",
    );
    // Company recipients are opt-in and do not replace the operational queue.
    const clientPreferenceKey = `${ids.a}:tickets`;
    const clientDestination = `support-preference-${marker}@example.invalid`;
    await database.query(
      "insert into console_notification_preferences(key,company_id,topic,email,phone,email_enabled,whatsapp_enabled) values($1,$2,'tickets',$3,'11988887777',true,false)",
      [clientPreferenceKey, ids.a, clientDestination],
    );
    await submitForm(`/chamados/${created.id}`, "manager", "manager", "body", {
      ticketId: created.id,
      body: "Aviso ao atendimento da empresa",
    });
    await drain();
    const clientRows = (await noticeRows()).filter(
      (row) => row.preference_key === clientPreferenceKey,
    );
    ok(
      clientRows.some(
        (row) =>
          row.channel === "email" &&
          row.destination === clientDestination &&
          row.status === "accepted",
      ) &&
        clientRows.every(
          (row) => row.channel !== "whatsapp" || row.status === "cancelled",
        ),
      "Atendimento opt-in envia ao contato da empresa e respeita canais desativados",
    );
    flags({ approved: true, email503: true });
    await submitForm(`/chamados/${created.id}`, "manager", "manager", "body", {
      ticketId: created.id,
      body: "Contato trocado antes da repetição",
    });
    await drain();
    const pendingClient = (await noticeRows()).find(
      (row) =>
        row.preference_key === clientPreferenceKey &&
        row.channel === "email" &&
        row.status === "pending",
    );
    assert.ok(pendingClient);
    const pendingCount = sentNotices().filter(
      (row) => row.key === `ticket-${pendingClient.id}`,
    ).length;
    await database.query(
      "update console_notification_preferences set email=$2 where key=$1",
      [clientPreferenceKey, `new-support-${marker}@example.invalid`],
    );
    await database.query(
      "update console_ticket_notices set next_attempt_at=now() where id=$1",
      [pendingClient.id],
    );
    flags({ approved: true });
    await drain();
    ok(
      (await noticeRows()).find((row) => row.id === pendingClient.id).status ===
        "cancelled" &&
        sentNotices().filter((row) => row.key === `ticket-${pendingClient.id}`)
          .length === pendingCount,
      "Contato de atendimento alterado cancela repetição para o destinatário antigo",
    );
    await database.query(
      "delete from console_notification_preferences where key=$1",
      [clientPreferenceKey],
    );
  }
  const emailSuite = () => runEmailTests({ database, ids, people, request, ok, marker, base, jmap, notFoundPage, dnsFile, serverLogs: () => logs });
  if (assistantOnly) {
    // --assistant-only: just the assistant, against the same fixtures.
    await runAssistantTests({ database, ids, people, request, ok, marker, base, flags, aiFile });
  } else if (emailOnly) {
    await emailSuite();
  } else {
    await runBillingTests({
      database,
      ids,
      people,
      request,
      submitForm,
      flags,
      sentNotices,
      ok,
      marker,
    });
    await runHandoffTests({ database, ids, people, request, submitForm, sentNotices, ok, marker });
    await runPilotoTests({ database, ids, request, submitForm, ok, marker });
    await runSupportTests({ database, ids, people, request, submitForm, sentNotices, ok, marker, base });
    await runNoticesTests({ database, ids, people, request, submitForm, sentNotices, ok, marker });
    await runClientsTests({ database, ids, people, request, submitForm, sentNotices, ok, marker });
    await runBillingExtrasTests({ database, ids, people, request, submitForm, sentNotices, flags, ok, marker });
    await runSuspensionTests({ database, people, request, submitForm, sentNotices, ok, marker, companyIds });
    await runArquivosTests({ database, ids, people, request, submitForm, ok, marker, base, r2, notFoundPage, aiFile, sentNotices });
    await runJourneyTests({ database, ids, people, request, submitForm, ok, marker, base, notFoundPage });
    await runAppsTests({ database, ids, people, request, ok, marker, base, notFoundPage, passKeyId });
    await runCatalogIconTests({ database, ids, people, request, submitForm, ok, marker, base, notFoundPage });
    await runMemberScopeTests({ database, ids, people, request, submitForm, ok, marker, notFoundPage });
    await runHelpTests({ database, ids, people, request, submitForm, ok, marker, notFoundPage });
    await runAssistantTests({ database, ids, people, request, ok, marker, base, flags, aiFile });
    await runContractSigningTests({ database, ids, request, ok, marker, base });
    await runWorkspaceDomainTests({ people, ok, base, notFoundPage, passKeyId });
    await emailSuite();
  }
  // Every AI call of the run, as the Gateway mock saw it: client data only to providers that keep nothing and train
  // on nothing (the catalog icons carry none), and nothing left for OpenRouter or a Gateway path the mock does not know.
  if (!emailOnly) {
    const aiCalls = readFileSync(aiFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    const clientData = aiCalls.filter((e) => "messages" in e || e.jev || e.draft || e.journey || e.transcription);
    ok(
      clientData.length > 0 && clientData.every((e) => e.zeroDataRetention === true && e.disallowPromptTraining === true),
      `Toda chamada de IA com dado de cliente vai só a provedores que não guardam nem treinam (${clientData.length} chamadas)`,
    );
    ok(!aiCalls.some((e) => e.unexpected || e.drift), "Nenhuma chamada de IA fora do AI Gateway nem fora do protocolo conhecido");
  }
  console.log(
    `Concluído: ${passed} verificações HTTP. OAuth testado até redirecionamento, sem autenticar no Google.`,
  );
} catch (error) {
  console.error("FAIL", error.stack);
  if (logs.includes("Error"))
    console.error("O servidor registrou erro; verificar logs locais.");
  if (process.env.CONSOLE_TEST_DEBUG) console.error(logs.slice(-6000));
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await r2?.close();
  await jmap?.close();
  await database.query("delete from console_file_uploads where actor_id=any($1::text[]) or company_id=any($2::text[])", [
    Object.values(people).map((p) => p.id),
    companyIds,
  ]);
  await database.query(
    "delete from console_audit_events where actor_id=any($1::text[]) and company_id is null",
    [Object.values(people).map((p) => p.id)],
  );
  await database.query("delete from console_billing_notices");
  await database.query(
    "delete from console_quote_versions where quote_id in (select id from console_quotes where company_id=any($1::text[]))",
    [companyIds],
  );
  for (const table of ["console_contract_change_requests", "console_contract_signatures", "console_contract_versions"])
    await database.query(
      `delete from ${table} where contract_id in (select id from console_contracts where company_id=any($1::text[]))`,
      [companyIds],
    );
  // Conditions point at contracts, links point at proposals; automation records go before companies and people.
  for (const table of ["console_time_entries", "console_hours_months", "console_service_terms"])
    await database.query(`delete from ${table} where company_id=any($1::text[])`, [companyIds]);
  await database.query("delete from console_engagement_suspensions where company_id=any($1::text[])", [companyIds]);
  // Products point at recurrences (and proposals): unlink before deleting those.
  await database.query("update console_engagements set quote_id=null, subscription_id=null where company_id=any($1::text[])", [companyIds]);
  // Project journeys point at companies, proposals and people: they go first.
  await database.query(
    "delete from console_journey_steps where journey_id in (select id from console_journeys where company_id=any($1::text[]) or owner_id=any($2::text[]))",
    [companyIds, Object.values(people).map((p) => p.id)],
  );
  await database.query("delete from console_journeys where company_id=any($1::text[]) or owner_id=any($2::text[])", [
    companyIds,
    Object.values(people).map((p) => p.id),
  ]);
  await database.query("delete from console_automation_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [
    companyIds,
    Object.values(people).map((p) => p.id),
  ]);
  // Piloto automático: decisions point at their events, both at the companies.
  await database.query("delete from console_decisions where company_id=any($1::text[]) or decided_by=any($2::text[])", [companyIds, Object.values(people).map((p) => p.id)]);
  await database.query("delete from console_events where company_id=any($1::text[])", [companyIds]);
  for (const table of [
    "console_audit_events",
    "console_invoices",
    "console_subscriptions",
    "console_contracts",
    "console_quotes",
    "console_bookmarks",
  ])
    await database.query(
      `delete from ${table} where company_id=any($1::text[])`,
      [companyIds],
    );
  for (const table of ["console_time_entries", "console_hours_months", "console_service_terms"])
    await database.query(`delete from ${table} where company_id=any($1::text[])`, [companyIds]);
  await database.query("delete from console_user_milestones where user_id=any($1::text[])", [Object.values(people).map((p) => p.id)]);
  await database.query(
    "delete from console_task_comments where task_id in (select id from console_tasks where company_id=any($1::text[]))",
    [companyIds],
  );
  await database.query("delete from console_tasks where company_id=any($1::text[])", [companyIds]);
  for (const table of ["console_attachments", "console_messages"])
    await database.query(
      `delete from ${table} where ticket_id in (select id from console_tickets where company_id=any($1::text[]))`,
      [companyIds],
    );
  await database.query(
    "delete from console_tickets where company_id=any($1::text[])",
    [companyIds],
  );
  await database.query(
    "delete from console_email_deliveries where membership_id in (select id from console_memberships where company_id=any($1::text[]))",
    [companyIds],
  );
  for (const table of ["console_memberships", "console_engagements"])
    await database.query(
      `delete from ${table} where company_id=any($1::text[])`,
      [companyIds],
    );
  await database.query(
    "delete from console_companies where id=any($1::text[])",
    [companyIds],
  );
  // The assistant's cards and conversations point at people (messages go with their conversation).
  for (const table of ["console_assistant_proposals", "console_assistant_conversations"])
    await database.query(`delete from ${table} where user_id=any($1::text[])`, [Object.values(people).map((p) => p.id)]);
  await database.query("delete from console_assistant_usage where subject_id=any($1::text[])", [[...Object.values(people).map((p) => p.id), ...companyIds]]);
  await database.query("delete from console_user where id=any($1::text[])", [
    Object.values(people).map((p) => p.id),
  ]);
  await database.end();
  rmSync(noticeDir, { recursive: true, force: true });
  console.log("Fixtures de teste removidas.");
}
