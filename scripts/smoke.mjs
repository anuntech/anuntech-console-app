// Run only against a development database. Creates isolated fixtures and removes them in finally.
import { runBillingTests } from "./billing-smoke.mjs";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
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
  return request(page, sender, {
    method: "POST",
    body: formBody(rendered.text, identifier, values),
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
  } else {
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
        r.text.includes("Empresas cadastradas") &&
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
    ok(
      r.headers.get("location")?.includes("/entrar"),
      "Sessão expirada negada",
    );

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
    const contractInput = {
      companyId: ids.a,
      title: `Contract A ${marker}`,
      body: "CLÁUSULA 1 — Prestação de serviços.\n\nCondições, valores e obrigações.",
    };
    await submitForm(
      "/contratos/novo",
      "admin",
      "manager",
      "Salvar rascunho",
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
      "Salvar rascunho",
      contractInput,
    );
    let contract = (
      await database.query(
        "select * from console_contracts where company_id=$1",
        [ids.a],
      )
    ).rows[0];
    ok(
      contract && !contract.published_at && contract.revision === 1,
      "Administrador cria contrato como rascunho privado",
    );
    const contractPath = `/contratos/${contract.id}`;
    const contractPdfPath = `/api/contratos/${contract.id}/pdf`;
    r = await request(contractPath, "finance");
    ok(
      !r.text.includes(contractInput.body) &&
        r.text.includes("Página não encontrada"),
      "Cliente não acessa rascunho de contrato por URL",
    );
    r = await request(contractPdfPath + "?draft=1", "finance");
    ok(r.status === 404, "PDF de rascunho é restrito à administração");
    r = await request(contractPdfPath + "?draft=1", "admin");
    ok(
      r.status === 200 &&
        r.text.startsWith("%PDF-") &&
        r.headers.get("cache-control") === "private, no-store",
      "Administrador baixa PDF real do rascunho com fontes locais",
    );
    await submitForm(
      contractPath,
      "admin",
      "admin",
      "Publicar para o cliente",
      {
        id: contract.id,
        revision: "1",
      },
    );
    ok(
      !(
        await database.query(
          "select published_at from console_contracts where id=$1",
          [contract.id],
        )
      ).rows[0].published_at,
      "Publicar contrato exige confirmação",
    );
    await submitForm(
      contractPath,
      "admin",
      "manager",
      "Publicar para o cliente",
      { id: contract.id, revision: "1", confirm: "yes" },
    );
    ok(
      !(
        await database.query(
          "select published_at from console_contracts where id=$1",
          [contract.id],
        )
      ).rows[0].published_at,
      "Cliente não publica contrato por POST direto",
    );
    await submitForm(
      contractPath,
      "admin",
      "admin",
      "Publicar para o cliente",
      {
        id: contract.id,
        revision: "1",
        confirm: "yes",
      },
    );
    contract = (
      await database.query("select * from console_contracts where id=$1", [
        contract.id,
      ])
    ).rows[0];
    ok(
      contract.published_at && contract.published_version === 1,
      "Publicação salva versão e disponibiliza contrato",
    );
    for (const person of ["finance", "manager"]) {
      r = await request(contractPath, person);
      ok(
        r.text.includes("Prestação de serviços") &&
          r.text.includes("Baixar PDF"),
        `Perfil ${person} visualiza contrato publicado`,
      );
    }
    r = await request(contractPath, "support");
    ok(
      r.text.includes("Página não encontrada") &&
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
      "Cliente baixa PDF real da versão publicada",
    );
    r = await request(contractPdfPath);
    ok(r.status === 401, "PDF de contrato exige sessão");
    r = await request(contractPdfPath, "support");
    ok(r.status === 404, "PDF de contrato respeita perfil financeiro");
    await submitForm("/contratos/novo", "admin", "admin", "Salvar rascunho", {
      ...contractInput,
      companyId: ids.b,
      title: `PRIVATE-CONTRACT-B-${marker}`,
    });
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
      "Publicar para o cliente",
      { id: contractB.id, revision: "1", confirm: "yes" },
    );
    r = await request("/contratos", "finance");
    ok(
      r.text.includes(contractInput.title) &&
        !r.text.includes(`PRIVATE-CONTRACT-B-${marker}`),
      "Lista de contratos publicada é isolada por empresa",
    );
    r = await request(`/api/contratos/${contractB.id}/pdf`, "finance");
    ok(r.status === 404, "PDF de outra empresa é negado");
    await submitForm(contractPath, "admin", "finance", "Salvar rascunho", {
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
      "Cliente não edita contrato por POST direto",
    );
    const updatedBody =
      "PRIVATE-DRAFT-CHANGE — Condições revisadas.\n\nSegunda cláusula.";
    await submitForm(contractPath, "admin", "admin", "Salvar rascunho", {
      id: contract.id,
      revision: String(contract.revision),
      title: contractInput.title,
      body: updatedBody,
    });
    r = await request(contractPath, "finance");
    ok(
      !r.text.includes("PRIVATE-DRAFT-CHANGE") &&
        r.text.includes("Prestação de serviços"),
      "Editar rascunho preserva texto publicado para cliente",
    );
    await submitForm(
      contractPath,
      "admin",
      "admin",
      "Publicar para o cliente",
      {
        id: contract.id,
        revision: String(contract.revision),
        confirm: "yes",
      },
    );
    ok(
      (
        await database.query(
          "select published_version from console_contracts where id=$1",
          [contract.id],
        )
      ).rows[0].published_version === 1,
      "Publicação de aba desatualizada é recusada",
    );
    contract = (
      await database.query("select * from console_contracts where id=$1", [
        contract.id,
      ])
    ).rows[0];
    await submitForm(
      contractPath,
      "admin",
      "admin",
      "Publicar para o cliente",
      {
        id: contract.id,
        revision: String(contract.revision),
        confirm: "yes",
      },
    );
    contract = (
      await database.query("select * from console_contracts where id=$1", [
        contract.id,
      ])
    ).rows[0];
    r = await request(contractPath, "finance");
    ok(
      contract.published_version === 2 &&
        r.text.includes("PRIVATE-DRAFT-CHANGE"),
      "Nova publicação substitui conteúdo do cliente e incrementa versão",
    );
    await submitForm(contractPath, "admin", "admin", "Retirar publicação", {
      id: contract.id,
      revision: String(contract.revision),
      confirm: "yes",
    });
    r = await request(contractPdfPath, "finance");
    ok(
      r.status === 404 &&
        !(
          await database.query(
            "select published_at from console_contracts where id=$1",
            [contract.id],
          )
        ).rows[0].published_at,
      "Retirar publicação bloqueia download e preserva rascunho",
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
    // Public registration links are exercised only in this disposable database.
    const inviteLabel = `QA Invite ${marker}`;
    await submitForm("/empresas/convites", "admin", "manager", "Gerar link", {
      label: inviteLabel,
    });
    ok(
      (
        await database.query(
          "select count(*)::int n from console_company_invites",
        )
      ).rows[0].n === 0,
      "Cliente não gera links de cadastro",
    );
    const generated = await submitForm(
      "/empresas/convites",
      "admin",
      "admin",
      "Gerar link",
      { label: inviteLabel },
    );
    const inviteToken = generated.text.match(
      /cadastro\/empresa\/([a-f0-9]{64})/,
    )?.[1];
    assert.ok(inviteToken, "Link completo retornado ao administrador");
    const invite = (
      await database.query(
        "select * from console_company_invites where label=$1",
        [inviteLabel],
      )
    ).rows[0];
    ok(
      invite.token_hash ===
        createHash("sha256").update(inviteToken).digest("hex") &&
        !JSON.stringify(invite).includes(inviteToken),
      "Link persiste somente hash e validade",
    );
    const publicPath = `/cadastro/empresa/${inviteToken}`;
    let publicPage = await request(publicPath);
    ok(
      publicPage.status === 200 &&
        publicPage.text.includes("Enviar cadastro") &&
        !publicPage.text.includes("autoIssueNfse") &&
        !publicPage.text.includes("QA Company"),
      "Link abre sem login e não expõe clientes ou preferência fiscal",
    );
    const inviteLookup = await request(
      "/api/cadastro/consulta?tipo=cep&valor=01001000",
      null,
      { headers: { "X-Company-Invite": inviteToken } },
    );
    ok(inviteLookup.status === 200, "Cliente com link válido consulta CEP");
    const invalidLookup = await request(
      "/api/cadastro/consulta?tipo=cep&valor=01001000",
      null,
      { headers: { "X-Company-Invite": "0".repeat(64) } },
    );
    ok(invalidLookup.status === 403, "Link forjado não consulta dados");
    const submittedInput = {
      ...clientAddress,
      name: `QA Self Service ${marker}`,
      document: "12.345.678/0001-99",
      billingEmail: " FINANCEIRO@EXAMPLE.INVALID ",
      phone: "(11) 99999-1234",
      token: inviteToken,
      autoIssueNfse: "yes",
      admin: "true",
    };
    const sendPublic = (values) =>
      request(publicPath, null, {
        method: "POST",
        body: formBody(publicPage.text, "Enviar cadastro", values),
        headers: { Origin: base },
      });
    await sendPublic({ ...submittedInput, phone: "" });
    ok(
      (
        await database.query(
          "select status from console_company_invites where id=$1",
          [invite.id],
        )
      ).rows[0].status === "open",
      "Cadastro público rejeita telefone ausente no servidor",
    );
    await Promise.all([
      sendPublic(submittedInput),
      sendPublic({ ...submittedInput, name: "Concorrente" }),
    ]);
    const received = (
      await database.query(
        "select * from console_company_invites where id=$1",
        [invite.id],
      )
    ).rows[0];
    ok(
      received.status === "submitted" &&
        received.payload.phone === "11999991234" &&
        received.payload.billingEmail === "financeiro@example.invalid" &&
        !received.payload.autoIssueNfse &&
        !received.payload.admin,
      "Envio público único normaliza campos e ignora privilégios forjados",
    );
    await sendPublic({ ...submittedInput, name: "Sobrescrita indevida" });
    ok(
      (
        await database.query(
          "select payload from console_company_invites where id=$1",
          [invite.id],
        )
      ).rows[0].payload.name === received.payload.name,
      "Link utilizado não sobrescreve cadastro recebido",
    );
    publicPage = await request(publicPath);
    ok(
      publicPage.text.includes("Cadastro recebido") &&
        !publicPage.text.includes("financeiro@example.invalid") &&
        !publicPage.text.includes("Enviar cadastro"),
      "Link utilizado não revela dados enviados",
    );
    const reviewPath = `/empresas/convites/${invite.id}`;
    ok(
      !(await request(reviewPath, "manager")).text.includes(
        "financeiro@example.invalid",
      ),
      "Cliente não acessa revisão administrativa",
    );
    const approval = {
      ...submittedInput,
      inviteId: invite.id,
      name: `QA Approved ${marker}`,
      autoIssueNfse: "",
    };
    await submitForm(
      reviewPath,
      "admin",
      "manager",
      "Aprovar e cadastrar",
      approval,
    );
    ok(
      (
        await database.query(
          "select status from console_company_invites where id=$1",
          [invite.id],
        )
      ).rows[0].status === "submitted",
      "Cliente não aprova cadastro por POST direto",
    );
    const reviewPage = await request(reviewPath, "admin");
    const approve = () =>
      request(reviewPath, "admin", {
        method: "POST",
        body: formBody(reviewPage.text, "Aprovar e cadastrar", approval),
        headers: { Origin: base },
      });
    await Promise.all([approve(), approve()]);
    const approvedInvite = (
      await database.query(
        "select * from console_company_invites where id=$1",
        [invite.id],
      )
    ).rows[0];
    assert.ok(approvedInvite.company_id);
    companyIds.push(approvedInvite.company_id);
    const approvedCompany = (
      await database.query("select * from console_companies where id=$1", [
        approvedInvite.company_id,
      ])
    ).rows[0];
    ok(
      approvedInvite.status === "approved" &&
        approvedInvite.payload === null &&
        approvedCompany.name === approval.name &&
        !approvedCompany.auto_issue_nfse &&
        approvedCompany.billing_address.cep === "01001000",
      "Aprovação revisa dados e cadastra empresa uma única vez",
    );
    ok(
      (
        await database.query(
          "select count(*)::int n from console_memberships where company_id=$1",
          [approvedInvite.company_id],
        )
      ).rows[0].n === 0,
      "Aprovação não concede acesso automático à empresa",
    );
    ok(
      (
        await database.query(
          "select count(*)::int n from console_audit_events where entity_id=$1 and action='company.created'",
          [approvedInvite.company_id],
        )
      ).rows[0].n === 1,
      "Aprovação concorrente gera apenas um cadastro e auditoria",
    );
    const expiredToken = "e".repeat(64),
      revokedToken = "c".repeat(64);
    for (const [t, status, days] of [
      [expiredToken, "open", -1],
      [revokedToken, "revoked", 1],
    ]) {
      await database.query(
        "insert into console_company_invites(id,label,token_hash,status,expires_at) values($1,$2,$3,$4,now()+$5::int*interval '1 day')",
        [
          randomUUID(),
          inviteLabel,
          createHash("sha256").update(t).digest("hex"),
          status,
          days,
        ],
      );
      const closed = await request(`/cadastro/empresa/${t}`);
      ok(
        closed.text.includes("indisponível") &&
          !closed.text.includes("Enviar cadastro"),
        `Link ${status === "open" ? "expirado" : "cancelado"} não abre formulário`,
      );
    }
    const generated2 = await submitForm(
      "/empresas/convites",
      "admin",
      "admin",
      "Gerar link",
      { label: inviteLabel + " cancel" },
    );
    const token2 = generated2.text.match(
      /cadastro\/empresa\/([a-f0-9]{64})/,
    )?.[1];
    assert.ok(token2);
    const invite2 = (
      await database.query(
        "select * from console_company_invites where token_hash=$1",
        [createHash("sha256").update(token2).digest("hex")],
      )
    ).rows[0];
    const page2 = `/cadastro/empresa/${token2}`;
    for (const t of [expiredToken, revokedToken])
      await submitForm(page2, null, null, "Enviar cadastro", {
        ...submittedInput,
        token: t,
      });
    ok(
      (
        await database.query(
          "select count(*)::int n from console_company_invites where label=$1 and status='submitted'",
          [inviteLabel],
        )
      ).rows[0].n === 0,
      "POST não reutiliza link expirado ou cancelado",
    );
    await database.query(
      "update console_company_invites set lookup_count=40 where id=$1",
      [invite2.id],
    );
    ok(
      (
        await request("/api/cadastro/consulta?tipo=cep&valor=01001000", null, {
          headers: { "X-Company-Invite": token2 },
        })
      ).status === 403,
      "Limite de consultas por link é aplicado no banco",
    );
    await submitForm(page2, null, null, "Enviar cadastro", {
      ...submittedInput,
      token: token2,
    });
    await submitForm(
      `/empresas/convites/${invite2.id}`,
      "admin",
      "admin",
      "Aprovar e cadastrar",
      { ...approval, inviteId: invite2.id },
    );
    ok(
      (
        await database.query(
          "select status from console_company_invites where id=$1",
          [invite2.id],
        )
      ).rows[0].status === "submitted",
      "Documento duplicado não aprova convite nem duplica empresa",
    );
    await submitForm(
      `/empresas/convites/${invite2.id}`,
      "admin",
      "admin",
      "Cancelar link",
      { inviteId: invite2.id },
    );
    const cancelled = (
      await database.query(
        "select * from console_company_invites where id=$1",
        [invite2.id],
      )
    ).rows[0];
    ok(
      cancelled.status === "revoked" && cancelled.payload === null,
      "Cancelar link descarta dados pendentes e bloqueia novos envios",
    );
    await submitForm(
      `/empresas/${ids.a}`,
      "admin",
      "manager",
      "Salvar dados",
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
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", "Salvar dados", {
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
      "Salvar dados",
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
      await database.query("select * from console_companies where id=$1", [
        ids.a,
      ])
    ).rows[0];
    ok(
      !companyState.auto_issue_nfse &&
        companyState.billing_address.endereco === "Rua Teste",
      "Desmarcar a opção desativa a preferência sem apagar o endereço",
    );
    const editableDocument = r.text.match(
      /<input\b[^>]*name="document"[^>]*>/,
    )?.[0];
    ok(
      editableDocument && !/readonly/i.test(editableDocument),
      "Documento do cadastro existente está editável",
    );
    const replacementDocument = "98.765.432/0001-10";
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", "Salvar dados", {
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
    const duplicateResult = await submitForm(
      `/empresas/${ids.a}`,
      "admin",
      "admin",
      "Salvar dados",
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
        companyState.name === companyInput.name &&
        duplicateResult.text.includes(
          "Este CPF/CNPJ já está cadastrado em outra empresa.",
        ),
      "CNPJ duplicado mostra erro específico e não salva parcialmente o cadastro",
    );
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", "Salvar dados", {
      ...companyInput,
      document: "123",
    });
    await submitForm(`/empresas/${ids.a}`, "admin", "manager", "Salvar dados", {
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
      "Arquivar cliente",
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
    const archivePage = await request(`/empresas/${ids.a}`, "admin");
    const archiveBody = () =>
      formBody(archivePage.text, "Arquivar cliente", archiveData);
    for (let attempt = 0; attempt < 2; attempt++)
      await request(`/empresas/${ids.a}`, "admin", {
        method: "POST",
        body: archiveBody(),
        headers: { Origin: base },
      });
    const activeList = await request("/empresas", "admin");
    const archivedList = await request("/empresas?status=arquivados", "admin");
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
      "Restaurar cliente",
      { id: ids.a, archived: "no" },
    );
    ok(
      (await request("/empresas", "admin")).text.includes(
        `/empresas/${ids.a}`,
      ) &&
        !(await request("/empresas?status=arquivados", "admin")).text.includes(
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
    await submitForm(`/empresas/${ids.a}`, "admin", "admin", "Salvar dados", {
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
      "Cancelar rascunho",
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
  }
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
  console.log(
    `Concluído: ${passed} verificações HTTP. OAuth testado até redirecionamento, sem autenticar no Google.`,
  );
} catch (error) {
  console.error("FAIL", error.stack);
  if (logs.includes("Error"))
    console.error("O servidor registrou erro; verificar logs locais.");
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((r) => server.once("exit", r));
  }
  await database.query("delete from console_company_invites");
  await database.query(
    "delete from console_audit_events where actor_id=any($1::text[]) and company_id is null",
    [Object.values(people).map((p) => p.id)],
  );
  await database.query("delete from console_billing_notices");
  for (const table of [
    "console_audit_events",
    "console_invoices",
    "console_subscriptions",
    "console_contracts",
  ])
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
