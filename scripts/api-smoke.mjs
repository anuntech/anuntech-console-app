// The native app's API (/api/v1) and sign-in, called the way the app calls
// them: no browser, no Origin, the session cookie set by hand and the app's
// scheme in expo-origin. Runs in a disposable database (test-isolated).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

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
  await db.query(
    "update console_user set phone_number='+5511988880001',phone_number_verified=true where id=$1",
    [people.guarded.id],
  );
  await db.query("update console_user set two_factor_enabled=true where id=$1", [people.guarded.id]);
  await db.query(
    "insert into console_two_factor(id,user_id,secret,backup_codes,verified) values($1,$2,'','',false)",
    [randomUUID(), people.guarded.id],
  );
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3107"],
    {
      env: {
        ...process.env,
        CONSOLE_ADMIN_EMAIL: owner,
        BETTER_AUTH_URL: base,
        // The AI Gateway mock goes last so it wraps otp-mock's fetch (which refuses anything outside this Mac).
        NODE_OPTIONS: `--require=${process.cwd()}/scripts/otp-mock.cjs --require=${process.cwd()}/scripts/ai-gateway-mock.cjs`,
        AI_GATEWAY_API_KEY: "test",
        CONSOLE_TEST_ASSISTANT_FILE: join(dir, "ai.jsonl"),
        CONSOLE_TEST_MODELS_FILE: `${process.cwd()}/scripts/fixtures/gateway-models.json`,
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
  await db.query("delete from console_quotes where id=$1", [quoteSent]);
  await db.query("delete from console_contracts where id=any($1::text[])", [[contractSent, contractDraft]]);
  await db.query("delete from console_tasks where id=$1", [taskA]);
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
  console.log(`Concluído: ${count} verificações da API do app.`);
} catch (error) {
  console.error("FAIL", error.stack);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
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
