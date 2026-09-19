// Run only against a development database. Creates isolated fixtures and removes them in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const base = "http://127.0.0.1:3101";
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
const noticeDir = mkdtempSync(join(tmpdir(), "console-notices-"));
const noticeFile = join(noticeDir, "messages.jsonl"),
  noticeFlags = join(noticeDir, "flags.json");
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
function decodeAttr(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
async function submitForm(page, reader, sender, identifier, values) {
  const rendered = await request(page, reader);
  const forms = [
    ...rendered.text.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g),
  ].map((m) => m[1]);
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
  return request(page, sender, {
    method: "POST",
    body,
    headers: { Origin: base },
  });
}

try {
  for (const [name, role] of [
    ["admin", null],
    ["support", "support"],
    ["finance", "finance"],
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
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3101",
    ],
    {
      env: {
        ...process.env,
        CONSOLE_ADMIN_EMAIL: adminEmail,
        BETTER_AUTH_URL: base,
        NODE_OPTIONS: `--require=${process.cwd()}/scripts/inter-mock.cjs --require=${process.cwd()}/scripts/notice-mock.cjs`,
        CONSOLE_TEST_NOTICE_FILE: noticeFile,
        CONSOLE_TEST_NOTICE_FLAGS: noticeFlags,
        CRON_SECRET: "test-cron-secret",
        FLW_TICKET_TEMPLATE_ID: "test-ticket-template",
        FLW_SYNOVA: "test",
        FLW_SENDER_NUMBER: "551151073435",
        RESEND_API_KEY: "test",
        EMAIL_FROM: "Console <test@example.invalid>",
        INTER_API_BASE_URL: "https://cdpj.partners.bancointer.com.br",
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
  let r = await request("/painel");
  ok(
    [302, 303, 307].includes(r.status) &&
      r.headers.get("location")?.includes("/entrar"),
    "Sem sessão: painel redireciona para login",
  );
  r = await request("/painel", "admin");
  ok(
    r.status === 200 && r.text.includes("QA admin"),
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
      r.text.includes("Página não encontrada"),
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
    r.text.includes("Página não encontrada") &&
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
  r = await request(`/api/anexos/${ids.attachment}`, "finance");
  ok(r.status === 404, "Perfil financeiro não baixa anexos de atendimento");
  r = await request(`/api/anexos/${ids.attachment}`);
  ok(r.status === 401, "Download de anexo exige sessão");
  r = await request("/painel", "expired");
  ok(r.headers.get("location")?.includes("/entrar"), "Sessão expirada negada");

  await submitForm("/chamados/novo", "support", "support", "subject", {
    companyId: ids.a,
    engagementId: "",
    subject: `Created through form ${marker}`,
    body: "Descrição criada pelo teste HTTP",
    priority: "normal",
  });
  const created = (
    await database.query(
      "select id from console_tickets where company_id=$1 and subject=$2",
      [ids.a, `Created through form ${marker}`],
    )
  ).rows[0];
  ok(!!created, "Formulário de chamado grava no banco");
  await submitForm("/chamados/novo", "support", "support", "subject", {
    companyId: ids.b,
    engagementId: "",
    subject: `Forbidden mutation ${marker}`,
    body: "Negar acesso cruzado",
    priority: "normal",
  });
  ok(
    (
      await database.query("select id from console_tickets where subject=$1", [
        `Forbidden mutation ${marker}`,
      ])
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
    ).rowCount === 0,
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
    ).rowCount === 1,
    "Upload de anexo é persistido com acesso privado",
  );
  await submitForm(`/financeiro/${drafted.id}`, "admin", "admin", "amount", {
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
  const companyInput = {
    id: ids.a,
    name: `QA Company A ${marker}`,
    billingEmail: "qa-A@example.invalid",
    phone: "",
    ...clientAddress,
    autoIssueNfse: "yes",
  };
  await submitForm(
    `/empresas/${ids.a}`,
    "admin",
    "manager",
    "Salvar dados",
    companyInput,
  );
  let companyState = (
    await database.query("select * from console_companies where id=$1", [ids.a])
  ).rows[0];
  ok(
    !companyState.billing_address && !companyState.auto_issue_nfse,
    "Cliente não altera endereço ou preferência fiscal por POST direto",
  );
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", "Salvar dados", {
    ...companyInput,
    cep: "123",
  });
  companyState = (
    await database.query("select * from console_companies where id=$1", [ids.a])
  ).rows[0];
  ok(
    !companyState.billing_address && !companyState.auto_issue_nfse,
    "Endereço incompleto é rejeitado sem salvar parcialmente a preferência",
  );
  await submitForm(
    `/empresas/${ids.a}`,
    "admin",
    "admin",
    "Salvar dados",
    companyInput,
  );
  companyState = (
    await database.query("select * from console_companies where id=$1", [ids.a])
  ).rows[0];
  ok(
    companyState.billing_address.cep === "01001000" &&
      companyState.billing_address.complemento === "Sala 2" &&
      companyState.auto_issue_nfse,
    "Administrador salva endereço normalizado e preferência fiscal por cliente",
  );
  r = await request(`/empresas/${ids.a}`, "admin");
  ok(
    r.text.includes('name="autoIssueNfse"') &&
      r.text.includes('checked=""') &&
      r.text.includes("Sala 2"),
    "Cadastro reaberto mostra endereço e opção fiscal salvos",
  );
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", "Salvar dados", {
    ...companyInput,
    autoIssueNfse: "",
  });
  companyState = (
    await database.query("select * from console_companies where id=$1", [ids.a])
  ).rows[0];
  ok(
    !companyState.auto_issue_nfse &&
      companyState.billing_address.endereco === "Rua Teste",
    "Desmarcar a opção desativa a preferência sem apagar o endereço",
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
    phone: "",
    ...clientAddress,
    autoIssueNfse: "yes",
  });
  const newCompany = (
    await database.query("select * from console_companies where document=$1", [
      newDocument,
    ])
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
      r.text.includes(`/empresas/${ids.a}#cadastro`),
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
    "Emitir cobrança no Inter",
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
    "Emitir cobrança no Inter",
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
    "Emitir cobrança no Inter",
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
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", "Salvar dados", {
    ...companyInput,
    autoIssueNfse: "",
  });

  await submitForm(
    `/financeiro/${ids.draft}`,
    "admin",
    "admin",
    "Emitir cobrança no Inter",
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
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", "Salvar dados", {
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
  await submitForm(
    `/financeiro/${ids.draft}`,
    "admin",
    "admin",
    "Consultar cobrança no Inter",
    { id: ids.draft },
  );
  ok(
    (
      await database.query("select status from console_invoices where id=$1", [
        ids.draft,
      ])
    ).rows[0].status === "paid",
    "Conciliação simulada confirma pagamento somente após consulta ao banco",
  );
  await submitForm(
    `/financeiro/${drafted.id}`,
    "admin",
    "admin",
    "Cancelar rascunho",
    {
      id: drafted.id,
    },
  );
  ok(
    (
      await database.query("select status from console_invoices where id=$1", [
        drafted.id,
      ])
    ).rows[0].status === "cancelled",
    "Administrador cancela somente rascunho",
  );
  await database.query(
    "update console_memberships set active=false where email=$1",
    [people.support.email],
  );
  r = await request(`/api/anexos/${ids.attachment}`, "support");
  ok(r.status === 404, "Revogação tem efeito imediato em sessão existente");
  const s = await request("/api/auth/sign-in/social", undefined, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ provider: "google", callbackURL: base + "/painel" }),
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
        "select * from console_ticket_notices where ticket_id=$1 order by created_at",
        [created.id],
      )
    ).rows;
  await drain();
  let notices = await noticeRows();
  ok(
    notices.length === 6,
    "Abertura, resposta e anexo geram um aviso por canal",
  );
  ok(
    notices.every(
      (n) =>
        n.destination ===
        (n.channel === "email" ? adminEmail : "+5511999990001"),
    ),
    "Avisos vão somente ao administrador interno, nunca aos clientes",
  );
  ok(
    notices.every((n) => n.status === "accepted"),
    "Aceite do provedor é registrado sem afirmar entrega",
  );
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
    r.text.includes("Página não encontrada"),
    "Histórico de notificações é exclusivo da administração",
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
  const attempts = sentNotices().filter((n) => n.key === `ticket-${retry.id}`);
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
  const uncertain = (await noticeRows()).find((n) => n.status === "uncertain");
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
  console.log(
    `Concluído: ${passed} verificações HTTP. OAuth testado até redirecionamento, sem autenticar no Google.`,
  );
} catch (error) {
  console.error("FAIL", error.message);
  if (logs.includes("Error"))
    console.error("O servidor registrou erro; verificar logs locais.");
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  for (const table of ["console_audit_events", "console_invoices"])
    await database.query(
      `delete from ${table} where company_id=any($1::text[])`,
      [companyIds],
    );
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
  await database.query("delete from console_user where id=any($1::text[])", [
    Object.values(people).map((p) => p.id),
  ]);
  await database.end();
  rmSync(noticeDir, { recursive: true, force: true });
  console.log("Fixtures de teste removidas.");
}
