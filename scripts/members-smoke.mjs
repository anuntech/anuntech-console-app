// Server forms and authorization are exercised only in test-isolated's disposable DB.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { serializeSignedCookie } from "better-call";

assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /^\/console_test_[a-f0-9]+$/,
  "Use scripts/test-isolated.mjs; never run against customer data",
);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = "http://127.0.0.1:3103";
const marker = randomUUID();
const email = (name) => `members-${name}-${marker}@example.invalid`;
const ownerEmail = email("owner"),
  staffEmail = email("staff");
const people = {},
  userIds = [],
  companyIds = [randomUUID(), randomUUID()];
const attachment = randomUUID(),
  ticket = randomUUID(),
  contract = randomUUID(),
  ownerStaff = randomUUID();
const dir = mkdtempSync(join(tmpdir(), "console-members-test-")),
  capture = join(dir, "otp.jsonl");
const page = "/configuracoes/membros";
let server,
  passed = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  passed++;
  console.log("PASS", message);
};
const notices = () => {
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
const decode = (value) =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
async function request(path, who, options = {}) {
  const response = await fetch(base + path, {
    redirect: "manual",
    ...options,
    headers: {
      ...(who ? { Cookie: people[who].cookie } : {}),
      ...options.headers,
    },
  });
  return {
    status: response.status,
    headers: response.headers,
    text: await response.text(),
  };
}
async function capturedForm(identifier, reader = "owner") {
  const response = await request(page, reader);
  const forms = [
    ...response.text.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g),
  ].map((match) => match[1]);
  const found = forms.find((form) => form.includes(identifier));
  assert.ok(found, `Form ${identifier} exists`);
  return found;
}
function formData(form, values) {
  const body = new FormData();
  for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
    const name = tag.match(/name="([^"]*)"/),
      value = tag.match(/value="([^"]*)"/);
    if (name && tag.includes('type="hidden"'))
      body.set(decode(name[1]), decode(value?.[1] || ""));
  }
  for (const [name, value] of Object.entries(values)) body.set(name, value);
  return body;
}
const post = (form, who, values) =>
  request(page, who, {
    method: "POST",
    body: formData(form, values),
    headers: { Origin: base },
  });
async function api(path, body) {
  const response = await fetch(`${base}/api/auth${path}`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  };
}
async function makePerson(name, verified = true) {
  const id = randomUUID(),
    token = randomUUID();
  const address = name === "owner" ? ownerEmail : email(name);
  await db.query(
    "insert into console_user(id,name,email,email_verified) values($1,$2,$3,$4)",
    [id, `QA ${name}`, address, verified],
  );
  userIds.push(id);
  await db.query(
    "insert into console_session(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",
    [randomUUID(), token, id],
  );
  people[name] = {
    id,
    email: address,
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
async function activeGrants(addresses, companyId) {
  return (
    await db.query(
      "select id,email,role from console_memberships where email=any($1::text[]) and company_id=$2 and active=true",
      [addresses, companyId],
    )
  ).rows;
}
try {
  await makePerson("owner");
  await makePerson("client");
  await makePerson("unverified", false);
  for (const [index, id] of companyIds.entries())
    await db.query(
      "insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)",
      [
        id,
        `Members company ${index} ${marker}`,
        id.replaceAll("-", "").slice(0, 14),
        email(`company-${index}`),
      ],
    );
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'manager')",
    [randomUUID(), companyIds[1], people.client.email],
  );
  await db.query(
    "insert into console_tickets(id,company_id,subject,author_id) values($1,$2,$3,$4)",
    [ticket, companyIds[0], `Members ticket ${marker}`, people.owner.id],
  );
  await db.query(
    "insert into console_attachments(id,ticket_id,author_id,name,mime,size,content) values($1,$2,$3,'members.pdf','application/pdf',9,$4)",
    [attachment, ticket, people.owner.id, Buffer.from("%PDF-test")],
  );
  await db.query(
    "insert into console_contracts(id,company_id,title,body,author_id,published_at,published_version,publication) values($1,$2,'Members contract','Isolated test',$3,now(),1,$4)",
    [
      contract,
      companyIds[0],
      people.owner.id,
      JSON.stringify({
        title: "Members contract",
        body: "Isolated test",
        companyName: "Members company",
        companyDocument: "00000000000000",
      }),
    ],
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3103",
    ],
    {
      env: {
        ...process.env,
        CONSOLE_ADMIN_EMAIL: ownerEmail,
        BETTER_AUTH_URL: base,
        NODE_OPTIONS: `--require=${process.cwd()}/scripts/otp-mock.cjs`,
        CONSOLE_TEST_OTP_FILE: capture,
        RESEND_API_KEY: "test",
        EMAIL_FROM: "Console <test@example.invalid>",
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
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  assert.ok(ready, "Members test server starts");

  const grantStaff = await capturedForm("Liberar administração");
  await post(grantStaff, "unverified", { email: email("blocked") });
  ok(
    (
      await db.query("select id from console_staff_members where email=$1", [
        email("blocked"),
      ])
    ).rowCount === 0,
    "Unverified account cannot grant global administration",
  );
  await post(grantStaff, "owner", { email: staffEmail });
  let staff = (
    await db.query("select * from console_staff_members where email=$1", [
      staffEmail,
    ])
  ).rows[0];
  ok(staff?.active, "Owner grants global administration before first login");
  ok(notices().length === 0, "Granting access sends no invitation or message");
  let response = await api("/email-otp/send-verification-otp", {
    email: staffEmail,
    type: "sign-in",
  });
  ok(
    response.status === 200 && notices().at(-1)?.to === staffEmail,
    "New staff email is admitted by the OTP policy",
  );
  response = await api("/sign-in/email-otp", {
    email: staffEmail,
    otp: notices().at(-1).code,
  });
  ok(
    response.status === 200 &&
      !!response.body.user?.id &&
      response.cookie.includes("session_token="),
    "New staff account can sign in through the real auth hook",
  );
  people.staff = {
    id: response.body.user.id,
    email: staffEmail,
    cookie: response.cookie,
  };
  userIds.push(people.staff.id);
  const staffPage = await request(page, "staff");
  ok(
    staffPage.status === 200 &&
      staffPage.text.includes("Acessos de clientes") &&
      !staffPage.text.includes(">Adicionar administrador<"),
    "Dynamic administrator sees client management without owner controls",
  );
  await post(grantStaff, "staff", { email: email("escalation") });
  await post(grantStaff, "client", { email: email("client-escalation") });
  ok(
    (
      await db.query(
        "select id from console_staff_members where email=any($1::text[])",
        [[email("escalation"), email("client-escalation")]],
      )
    ).rowCount === 0,
    "Forged owner action is blocked for staff and client",
  );
  ok(
    (await request(`/api/anexos/${attachment}`, "staff")).status === 200,
    "Dynamic administrator downloads support attachment",
  );
  ok(
    (await request(`/api/contratos/${contract}/pdf?draft=1`, "staff"))
      .status === 200,
    "Dynamic administrator downloads draft contract PDF",
  );
  ok(
    (await request("/api/cadastro/consulta?tipo=cnpj&valor=invalid", "staff"))
      .status === 400,
    "Dynamic administrator reaches the lookup validator",
  );
  ok(
    (await request("/api/cadastro/consulta?tipo=cnpj&valor=invalid", "client"))
      .status === 403,
    "Client cannot call the administrative lookup API",
  );

  const revokeStaff = await capturedForm(
    `Revogar administração de ${staffEmail}`,
  );
  await db.query(
    "insert into console_staff_members(id,email,active,created_by) values($1,$2,true,$3)",
    [ownerStaff, ownerEmail, people.owner.id],
  );
  await post(revokeStaff, "staff", { id: ownerStaff });
  await post(revokeStaff, "owner", { id: ownerStaff });
  ok(
    (
      await db.query("select active from console_staff_members where id=$1", [
        ownerStaff,
      ])
    ).rows[0].active,
    "Neither delegated admin nor owner action can revoke the protected owner",
  );
  await db.query("update console_user set email=$1 where id=$2", [
    email("owner-current"),
    people.owner.id,
  ]);
  await post(revokeStaff, "owner", { id: ownerStaff });
  ok(
    (
      await db.query("select active from console_staff_members where id=$1", [
        ownerStaff,
      ])
    ).rows[0].active,
    "Owner protection survives a principal email change",
  );

  const grantClient = await capturedForm("Liberar acesso", "staff");
  await post(grantClient, "client", {
    email: people.client.email,
    companyId: companyIds[0],
    role: "manager",
  });
  ok(
    (await activeGrants([people.client.email], companyIds[0])).length === 0,
    "Client cannot forge a company access grant",
  );
  await post(grantClient, "staff", {
    email: people.client.email,
    companyId: companyIds[0],
    role: "finance",
  });
  ok(
    (await activeGrants([people.client.email], companyIds[0]))[0]?.role ===
      "finance",
    "Delegated admin grants the chosen client permission",
  );
  const alias = email("client-old");
  await db.query(
    "insert into console_account_emails(id,user_id,email,verified_at) values($1,$2,$3,now())",
    [randomUUID(), people.client.id, alias],
  );
  const aliasGrant = randomUUID();
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'support')",
    [aliasGrant, companyIds[0], alias],
  );
  await post(grantClient, "staff", {
    email: alias,
    companyId: companyIds[0],
    role: "finance",
  });
  let active = await activeGrants([alias, people.client.email], companyIds[0]);
  ok(
    active.length === 1 &&
      active[0].email === people.client.email &&
      active[0].role === "finance",
    "Permission update consolidates verified aliases into one effective role",
  );
  ok(
    (await request(`/api/anexos/${attachment}`, "client")).status === 404,
    "Old alias cannot retain revoked support permission",
  );
  ok(
    (await request(`/api/contratos/${contract}/pdf`, "client")).status === 200,
    "Consolidated finance permission permits the published contract PDF",
  );
  const revokeClient = await capturedForm(
    `Revogar acesso de ${people.client.email} a Members company 0 ${marker}`,
    "staff",
  );
  await post(revokeClient, "staff", { id: aliasGrant });
  ok(
    (await activeGrants([alias, people.client.email], companyIds[0])).length ===
      0,
    "Revoking through an old alias removes all access to that company",
  );
  ok(
    (await activeGrants([people.client.email], companyIds[1])).length === 1,
    "Revoking one company preserves the client's other company",
  );
  ok(
    (await request(`/api/contratos/${contract}/pdf`, "client")).status === 404,
    "Existing client session immediately loses the revoked download",
  );
  await Promise.all([
    post(grantClient, "staff", {
      email: alias,
      companyId: companyIds[0],
      role: "support",
    }),
    post(grantClient, "staff", {
      email: people.client.email,
      companyId: companyIds[0],
      role: "finance",
    }),
  ]);
  active = await activeGrants([alias, people.client.email], companyIds[0]);
  ok(
    active.length === 1 && ["finance", "support"].includes(active[0].role),
    "Concurrent alias edits cannot leave multiple effective permissions",
  );
  const unknown = email("future-client");
  await post(grantClient, "staff", {
    email: unknown,
    companyId: companyIds[0],
    role: "admin",
  });
  ok(
    (await activeGrants([unknown], companyIds[0])).length === 0,
    "Unknown global role is rejected by the client permission schema",
  );

  const staffCurrent = email("staff-current");
  await db.query("update console_user set email=$1 where id=$2", [
    staffCurrent,
    people.staff.id,
  ]);
  await db.query(
    "insert into console_staff_members(id,email,created_by) values($1,$2,$3)",
    [randomUUID(), staffCurrent, people.owner.id],
  );
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'finance')",
    [randomUUID(), companyIds[0], staffCurrent],
  );
  await post(revokeStaff, "owner", { id: staff.id });
  ok(
    (
      await db.query(
        "select id from console_staff_members where email=any($1::text[]) and active",
        [[staffEmail, staffCurrent]],
      )
    ).rowCount === 0,
    "Global revocation removes all staff grants in the identity",
  );
  ok(
    (await activeGrants([staffCurrent], companyIds[0])).length === 1,
    "Global revocation preserves explicitly granted client access",
  );
  ok(
    (await request(`/api/anexos/${attachment}`, "staff")).status === 404,
    "Revoked administrator immediately loses cross-area attachment access",
  );
  ok(
    (await request(`/api/contratos/${contract}/pdf?draft=1`, "staff"))
      .status === 404,
    "Revoked administrator cannot use the old session to download drafts",
  );
  ok(
    (await request(`/api/contratos/${contract}/pdf`, "staff")).status === 200,
    "Revoked administrator retains only the published finance document grant",
  );
  await post(grantClient, "staff", {
    email: email("after-revoke"),
    companyId: companyIds[0],
    role: "manager",
  });
  ok(
    (await activeGrants([email("after-revoke")], companyIds[0])).length === 0,
    "Old administrator form cannot grant access after revocation",
  );
  const audit = await db.query(
    "select action from console_audit_events where actor_id=$1 and action in ('staff.granted','staff.revoked')",
    [people.owner.id],
  );
  ok(
    audit.rows.some((row) => row.action === "staff.granted") &&
      audit.rows.some((row) => row.action === "staff.revoked"),
    "Global access changes have durable audit records",
  );
  ok(
    notices().length === 1,
    "Member changes never send messages; only explicit mocked OTP was sent",
  );
  console.log(`Concluído: ${passed} verificações de membros e autorização.`);
} catch (error) {
  console.error("FAIL", error.stack);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  try {
    await db.query(
      "delete from console_audit_events where actor_id=any($1::text[])",
      [userIds],
    );
    await db.query(
      "delete from console_staff_members where created_by=any($1::text[]) or email=any($2::text[])",
      [userIds, [ownerEmail, staffEmail, email("staff-current")]],
    );
    await db.query("delete from console_attachments where id=$1", [attachment]);
    await db.query("delete from console_tickets where id=$1", [ticket]);
    await db.query("delete from console_contracts where id=$1", [contract]);
    await db.query(
      "delete from console_memberships where company_id=any($1::text[])",
      [companyIds],
    );
    await db.query("delete from console_companies where id=any($1::text[])", [
      companyIds,
    ]);
    await db.query("delete from console_user where id=any($1::text[])", [
      userIds,
    ]);
  } finally {
    await db.end();
    rmSync(dir, { recursive: true, force: true });
  }
}
