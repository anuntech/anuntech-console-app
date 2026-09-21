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
const port = process.env.CONSOLE_TEST_MEMBERS_PORT || "3103";
const base = `http://127.0.0.1:${port}`;
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
    signal: AbortSignal.timeout(30000),
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
// Next can stream the shell before notFound(), retaining HTTP 200 for the error UI.
const deniedPage = (response) =>
  (response.status === 404 ||
    response.text.includes("NEXT_HTTP_ERROR_FALLBACK;404")) &&
  response.text.includes("Página não encontrada");
async function capturedForm(identifier, reader = "owner", path = page) {
  const response = await request(path, reader);
  const forms = [
    ...response.text.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g),
  ].map((match) => match[1]);
  const found = forms.find((form) => form.includes(identifier));
  assert.ok(
    found,
    `Form ${identifier} exists (status ${response.status}, ${response.text.includes("NEXT_HTTP_ERROR_FALLBACK;404") ? "not found" : "rendered"})`,
  );
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
    signal: AbortSignal.timeout(30000),
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
  await makePerson("support");
  await makePerson("finance");
  await makePerson("colleague");
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
  for (const role of ["support", "finance"])
    await db.query(
      "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)",
      [randomUUID(), companyIds[1], people[role].email, role],
    );
  const outsideGrant = randomUUID();
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'support')",
    [outsideGrant, companyIds[0], email("outside-member")],
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
      port,
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
  server.stderr.on("data", (chunk) => {
    if (process.env.CONSOLE_TEST_DEBUG) process.stderr.write(chunk);
  });
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

  const settingsPath = "/configuracoes/empresa";
  const noticesPath = settingsPath;
  const companyForm = await capturedForm(
    "Salvar dados da empresa",
    "client",
    settingsPath,
  );
  const ownValues = {
    id: companyIds[1],
    name: "Updated company",
    document: "12345678000199",
    billingEmail: email("billing"),
    phone: "11999999999",
    autoIssueNfse: "yes",
  };
  await post(companyForm, "client", ownValues);
  let changedCompany = (
    await db.query("select * from console_companies where id=$1", [
      companyIds[1],
    ])
  ).rows[0];
  ok(
    changedCompany.name === "Updated company" &&
      changedCompany.phone === "11999999999",
    "Company administrator edits own company data",
  );
  ok(
    changedCompany.auto_issue_nfse === false,
    "Forged fiscal automation field is ignored in company settings",
  );
  await post(companyForm, "client", {
    ...ownValues,
    id: companyIds[0],
    name: "Forbidden",
  });
  ok(
    (
      await db.query("select name from console_companies where id=$1", [
        companyIds[0],
      ])
    ).rows[0].name !== "Forbidden",
    "Company data action blocks cross-tenant ID tampering",
  );
  for (const who of ["support", "finance", "unverified"]) {
    await post(companyForm, who, { ...ownValues, name: "Forbidden" });
    ok(
      (
        await db.query("select name from console_companies where id=$1", [
          companyIds[1],
        ])
      ).rows[0].name === "Updated company",
      `${who} cannot edit company data using captured action`,
    );
  }
  const companySettings = await request(settingsPath, "client");
  const notificationSettings = await request(noticesPath, "client");
  ok(
    !companySettings.text.includes(companyIds[0]) &&
      !notificationSettings.text.includes(companyIds[0]) &&
      !notificationSettings.text.includes(ownerEmail) &&
      !notificationSettings.text.includes("Operação Anuntech"),
    "Company settings and notifications do not expose other tenants or operation contacts",
  );
  const notificationForm = await capturedForm(
    'name="topic" value="billing"',
    "client",
    noticesPath,
  );
  const prefValues = {
    companyId: companyIds[1],
    topic: "billing",
    email: email("finance-notices"),
    phone: "11988888888",
    emailEnabled: "yes",
  };
  await post(notificationForm, "client", prefValues);
  const savedPreferences = async () =>
    (
      await db.query(
        "select * from console_notification_preferences where company_id=$1",
        [companyIds[1]],
      )
    ).rows;
  ok(
    (await savedPreferences())[0]?.email === prefValues.email &&
      !(await savedPreferences())[0]?.whatsapp_enabled,
    "Company notification contacts and enabled channels persist independently",
  );
  await post(notificationForm, "client", {
    ...prefValues,
    companyId: companyIds[0],
  });
  await post(notificationForm, "client", {
    ...prefValues,
    companyId: "",
    topic: "tickets",
  });
  ok(
    (
      await db.query(
        "select count(*)::int as count from console_notification_preferences",
      )
    ).rows[0].count === 1,
    "Company manager cannot alter another company or operation notification preferences",
  );
  await post(notificationForm, "support", {
    ...prefValues,
    email: email("forbidden"),
  });
  await post(notificationForm, "client", { ...prefValues, email: "invalid" });
  ok(
    (await savedPreferences())[0]?.email === prefValues.email,
    "Unauthorized and invalid notification changes leave existing preferences intact",
  );
  await db.query(
    "update console_memberships set active=false where company_id=$1 and email=$2",
    [companyIds[1], people.client.email],
  );
  await post(companyForm, "client", { ...ownValues, name: "Stale" });
  await post(notificationForm, "client", {
    ...prefValues,
    email: email("stale"),
  });
  ok(
    (await savedPreferences())[0]?.email === prefValues.email &&
      (
        await db.query("select name from console_companies where id=$1", [
          companyIds[1],
        ])
      ).rows[0].name !== "Stale",
    "Forms captured before revocation cannot save data or notification preferences",
  );
  await db.query(
    "update console_memberships set active=true where company_id=$1 and email=$2",
    [companyIds[1], people.client.email],
  );
  await db.query("update console_companies set name=$2 where id=$1", [
    companyIds[1],
    `Members company 1 ${marker}`,
  ]);

  const grantStaff = await capturedForm("Adicionar");
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
      !staffPage.text.includes("Acessos de clientes") &&
      staffPage.text.includes("Pessoas do ambiente") &&
      !staffPage.text.includes("Compartilhar acesso") &&
      !staffPage.text.includes(">Convidar pessoa<"),
    "Dynamic administrator sees only environment members without owner controls",
  );
  const managerPage = await request(page, "client");
  ok(
    managerPage.status === 200 &&
      managerPage.text.includes("Membros da empresa") &&
      managerPage.text.includes(`Members company 1 ${marker}`) &&
      !managerPage.text.includes(`Members company 0 ${marker}`) &&
      !managerPage.text.includes(companyIds[0]) &&
      !managerPage.text.includes(email("outside-member")) &&
      !managerPage.text.includes("Equipe Anuntech") &&
      !managerPage.text.includes(ownerEmail) &&
      !managerPage.text.includes(staffEmail),
    "Company manager sees only tenant members, without other company or Console staff data",
  );
  ok(
    (await request("/conta", "client")).text.includes(
      'href="/configuracoes/membros"',
    ),
    "Company manager can reach Members from account settings",
  );
  ok(
    deniedPage(await request("/configuracoes", "client")) &&
      deniedPage(await request("/configuracoes/notificacoes", "client")),
    "Company manager cannot access Console integrations or operational notices",
  );
  for (const role of ["support", "finance"]) {
    ok(
      deniedPage(await request(page, role)) &&
        !(await request("/conta", role)).text.includes(
          'href="/configuracoes/membros"',
        ),
      `${role} has no member-management page or navigation link`,
    );
  }
  const supportAlias = email("support-finance-alias");
  await db.query(
    "insert into console_account_emails(id,user_id,email,verified_at) values($1,$2,$3,now())",
    [randomUUID(), people.support.id, supportAlias],
  );
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'finance')",
    [randomUUID(), companyIds[1], supportAlias],
  );
  ok(
    deniedPage(await request(page, "support")),
    "Combining support and finance through aliases does not grant member administration",
  );
  const combinedPermissionForm = await capturedForm(
    `Salvar permissão de ${people.support.email} em Members company 1 ${marker}`,
    "client",
  );
  const combinedPermissionSelect = combinedPermissionForm.match(
    /<select\b[^>]*name="role"[^>]*>([\s\S]*?)<\/select>/,
  )?.[1];
  const selectedPermission = [
    ...(combinedPermissionSelect || "").matchAll(/<option\b[^>]*>/g),
  ].find(([tag]) => /\bselected(?:=|\s|>)/.test(tag))?.[0];
  ok(
    selectedPermission?.includes('value=""'),
    "Editing combined legacy permissions requires a choice instead of defaulting to company administrator",
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

  const revokeStaff = await capturedForm(`Expulsar de ${staffEmail}`);
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

  const grantClient = await capturedForm("Liberar acesso", "client");
  const managerGrant = await capturedForm("Liberar acesso", "client");
  const managedEmail = email("managed-member");
  await post(managerGrant, "client", {
    email: managedEmail,
    companyId: companyIds[1],
    role: "support",
  });
  ok(
    (await activeGrants([managedEmail], companyIds[1]))[0]?.role === "support",
    "Company manager grants access only to the chosen tenant",
  );
  await post(managerGrant, "client", {
    email: managedEmail,
    companyId: companyIds[1],
    role: "finance",
  });
  ok(
    (await activeGrants([managedEmail], companyIds[1]))[0]?.role === "finance",
    "Company manager changes a tenant member's permission",
  );
  for (const role of ["support", "finance"])
    await post(managerGrant, role, {
      email: email(`${role}-forged-grant`),
      companyId: companyIds[1],
      role: "manager",
    });
  ok(
    (
      await activeGrants(
        [email("support-forged-grant"), email("finance-forged-grant")],
        companyIds[1],
      )
    ).length === 0,
    "Support and finance cannot invoke a captured manager action",
  );
  await post(managerGrant, "client", {
    email: people.colleague.email,
    companyId: companyIds[1],
    role: "manager",
  });
  ok(
    (await activeGrants([people.colleague.email], companyIds[1]))[0]?.role ===
      "manager" && (await request(page, "colleague")).status === 200,
    "Company manager can add another company administrator",
  );
  const managerAlias = email("manager-alias");
  await db.query(
    "insert into console_account_emails(id,user_id,email,verified_at) values($1,$2,$3,now())",
    [randomUUID(), people.client.id, managerAlias],
  );
  const selfGrant = (
    await activeGrants([people.client.email], companyIds[1])
  )[0];
  const managerRevoke = await capturedForm(
    `Revogar acesso de ${managedEmail} a Members company 1 ${marker}`,
    "client",
  );
  await post(managerGrant, "client", {
    email: managerAlias,
    companyId: companyIds[1],
    role: "finance",
  });
  await post(managerRevoke, "client", { id: selfGrant.id });
  ok(
    (await activeGrants([people.client.email, managerAlias], companyIds[1]))[0]
      ?.role === "manager",
    "Manager cannot demote or revoke self, including aliases and with another administrator present",
  );
  await post(managerRevoke, "client", { id: outsideGrant });
  ok(
    (
      await db.query("select active from console_memberships where id=$1", [
        outsideGrant,
      ])
    ).rows[0].active,
    "Forged membership ID cannot revoke a different company's member",
  );
  const colleagueGrant = (
    await activeGrants([people.colleague.email], companyIds[1])
  )[0];
  await post(managerRevoke, "client", { id: colleagueGrant.id });
  ok(
    (await activeGrants([people.colleague.email], companyIds[1])).length ===
      0 && deniedPage(await request(page, "colleague")),
    "Manager revokes another manager while retaining one administrator",
  );
  await post(managerGrant, "colleague", {
    email: email("stale-manager"),
    companyId: companyIds[1],
    role: "manager",
  });
  ok(
    (await activeGrants([email("stale-manager")], companyIds[1])).length === 0,
    "Revoked manager cannot reuse a previously captured form",
  );
  // Two legacy rows for one verified identity must not satisfy the last-admin rule.
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'manager')",
    [randomUUID(), companyIds[1], managerAlias],
  );
  await post(grantClient, "staff", {
    email: people.client.email,
    companyId: companyIds[1],
    role: "finance",
  });
  await post(managerRevoke, "staff", { id: selfGrant.id });
  ok(
    (
      await activeGrants([people.client.email, managerAlias], companyIds[1])
    ).every((entry) => entry.role === "manager") &&
      (await activeGrants([people.client.email, managerAlias], companyIds[1]))
        .length === 2,
    "Console staff cannot remove the final company administrator; aliases are not another administrator",
  );
  await post(managerGrant, "client", {
    email: managerAlias,
    companyId: companyIds[1],
    role: "manager",
  });
  ok(
    (await activeGrants([people.client.email, managerAlias], companyIds[1]))
      .length === 1,
    "Keeping the manager role consolidates the administrator's legacy aliases",
  );
  await db.query(
    "update console_memberships set active=(email=$1) where company_id=$2 and email=any($3::text[])",
    [managerAlias, companyIds[1], [managerAlias, people.client.email]],
  );
  await post(managerGrant, "client", {
    email: managerAlias,
    companyId: companyIds[1],
    role: "manager",
  });
  ok(
    (await activeGrants([people.client.email, managerAlias], companyIds[1]))[0]
      ?.email === people.client.email,
    "A manager grant on a verified alias authorizes and consolidates through the current account",
  );
  const managedGrant = (await activeGrants([managedEmail], companyIds[1]))[0];
  await post(managerRevoke, "client", { id: managedGrant.id });
  ok(
    (await activeGrants([managedEmail], companyIds[1])).length === 0,
    "Company manager revokes an ordinary tenant member",
  );
  await post(grantClient, "client", {
    email: people.client.email,
    companyId: companyIds[0],
    role: "manager",
  });
  ok(
    (await activeGrants([people.client.email], companyIds[0])).length === 0,
    "Company manager cannot grant access in another company",
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
  ok(
    !(await request(page, "client")).text.includes(
      `Members company 0 ${marker}`,
    ),
    "A manager's finance access to another company does not expose that company's members",
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
  // Reuse the same tenant action captured as a manager; global admins retain
  // server authority while their Members screen no longer lists client access.
  const revokeClient = managerRevoke;
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
  await post(managerGrant, "client", {
    email: unknown,
    companyId: companyIds[1],
    role: "admin",
  });
  ok(
    (await activeGrants([unknown], companyIds[1])).length === 0,
    "Company manager cannot submit a global administrator role",
  );

  await makePerson("race-other");
  const raceCompany = randomUUID();
  companyIds.push(raceCompany);
  await db.query(
    "insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)",
    [
      raceCompany,
      `Members concurrency ${marker}`,
      raceCompany.replaceAll("-", "").slice(0, 14),
      email("race-company"),
    ],
  );
  for (const who of ["colleague", "race-other"])
    await post(grantClient, "staff", {
      email: people[who].email,
      companyId: raceCompany,
      role: "manager",
    });
  await Promise.all(
    ["colleague", "race-other"].map((who) =>
      post(grantClient, "staff", {
        email: people[who].email,
        companyId: raceCompany,
        role: "finance",
      }),
    ),
  );
  const raceRows = await activeGrants(
    [people.colleague.email, people["race-other"].email],
    raceCompany,
  );
  ok(
    raceRows.filter((row) => row.role === "manager").length === 1 &&
      raceRows.filter((row) => row.role === "finance").length === 1,
    "Concurrent demotions cannot remove every company administrator",
  );
  const winner =
    raceRows.find((row) => row.role === "manager").email ===
    people.colleague.email
      ? "colleague"
      : "race-other";
  const other = winner === "colleague" ? "race-other" : "colleague";
  await post(grantClient, "staff", {
    email: people[other].email,
    companyId: raceCompany,
    role: "manager",
  });
  const queuedForm = await capturedForm("Liberar acesso", winner);
  const lock = await db.connect();
  let queuedRequest;
  try {
    await lock.query("begin");
    const locker = (await lock.query("select pg_backend_pid() as pid")).rows[0]
      .pid;
    await lock.query(
      "select id from console_companies where id=$1 for update",
      [raceCompany],
    );
    queuedRequest = post(queuedForm, winner, {
      email: email("queued-manager-grant"),
      companyId: raceCompany,
      role: "manager",
    });
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const result = await db.query(
        "select exists(select 1 from pg_stat_activity where datname=current_database() and $1::int=any(pg_blocking_pids(pid))) as waiting",
        [locker],
      );
      if (result.rows[0].waiting) {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(
      waiting,
      "Manager action waits on the company's serialization lock",
    );
    await lock.query(
      "update console_memberships set role='finance' where company_id=$1 and email=$2",
      [raceCompany, people[winner].email],
    );
    await lock.query("commit");
  } finally {
    await lock.query("rollback");
    lock.release();
    if (queuedRequest) await queuedRequest;
  }
  ok(
    (await activeGrants([email("queued-manager-grant")], raceCompany))
      .length === 0,
    "Queued manager mutation rechecks permission after a concurrent revocation",
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
