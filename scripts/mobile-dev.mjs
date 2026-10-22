// Try the native app in the iPhone simulator against a Console on this Mac,
// with its own database and fictitious people: never the production one in
// .env.local. Codes are not sent anywhere; they show up in this terminal.
//   npm run mobile:dev            (first run builds the Console and the app)
//   npm run mobile:dev -- --reset (fresh demo data)
//   npm run mobile:dev -- --build (rebuild the Console after code changes)
//   DEVICE="iPhone de Kauan Ketner" npm run mobile:dev (an iPhone on the cable,
//   Developer Mode on, same Wi-Fi as the Mac)
//   npm run mobile:dev -- --serve (app already installed: only the Console and
//   Metro, no build, no cable; the phone just needs the same Wi-Fi)
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, watchFile, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import pg from "pg";

const args = process.argv.slice(2);
const container = "console-smoke-pg17";
const server = "postgres://postgres:ci-test-only@127.0.0.1:5434";
const database = "console_mobile_dev";
const dir = "/tmp/console-mobile-dev";
const otpFile = `${dir}/otp.jsonl`;
const children = [];
const say = (text) => console.log(`\x1b[36m[console]\x1b[0m ${text}`);
const fail = (text) => {
  console.error(`\x1b[31m[console]\x1b[0m ${text}`);
  stop(1);
};
function stop(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => stop(0));

// 1. Postgres 17 in Docker (OrbStack), the same container the integration tests use.
const docker = (...a) => execFileSync("docker", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
let running;
try {
  running = docker("inspect", "-f", "{{.State.Running}}", container);
} catch (error) {
  if (error.code === "ENOENT") fail("Docker não encontrado. Abra o OrbStack.");
  if (!/no such (object|container)/i.test(error.stderr || "")) fail("O Docker não respondeu. Abra ou reinicie o OrbStack.");
}
if (running === undefined) {
  say(`Criando o Postgres local (${container}, porta 5434).`);
  docker("run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=ci-test-only", "-p", "127.0.0.1:5434:5432", "postgres:17");
} else if (running !== "true") docker("start", container);
for (let attempt = 0; ; attempt++) {
  const client = new pg.Client({ connectionString: `${server}/postgres` });
  try {
    await client.connect();
    await client.end();
    break;
  } catch {
    if (attempt > 60) fail("O Postgres local não respondeu na porta 5434.");
    await new Promise((r) => setTimeout(r, 500));
  }
}

// 2. The demo database: people, a company, a product and two tickets.
const admin = new pg.Client({ connectionString: `${server}/postgres` });
await admin.connect();
const exists = (await admin.query("select 1 from pg_database where datname=$1", [database])).rowCount > 0;
if (exists && args.includes("--reset")) {
  await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname='${database}'`);
  await admin.query(`drop database ${database}`);
}
const fresh = !exists || args.includes("--reset");
if (fresh) await admin.query(`create database ${database}`);
await admin.end();
const db = new pg.Client({ connectionString: `${server}/${database}` });
await db.connect();
if (fresh) {
  say("Criando o banco de demonstração.");
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  for (const { tag } of journal.entries) await db.query(readFileSync(`drizzle/${tag}.sql`, "utf8"));
  const company = randomUUID(), product = randomUUID();
  const ana = randomUUID(), bruno = randomUUID(), team = randomUUID();
  await db.query("insert into console_companies(id,name,document,billing_email) values($1,'Empresa Demonstração','00000000000191','financeiro@demo.invalid')", [company]);
  await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,'Site institucional','project')", [product, company]);
  const person = (id, name, email, phone, image) =>
    db.query(
      "insert into console_user(id,name,email,email_verified,phone_number,phone_number_verified,image) values($1,$2,$3,true,$4,$5,$6)",
      [id, name, email, phone, !!phone, image],
    );
  await person(ana, "Ana Demonstração", "ana@demo.invalid", "+5511900000001", "/brand/avatars/avatar-07.svg");
  await person(bruno, "Bruno Demonstração", "bruno@demo.invalid", null, "/brand/avatars/avatar-12.svg");
  await person(team, "Equipe Anuntech", "equipe@demo.invalid", null, "/brand/avatars/avatar-03.svg");
  await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,'ana@demo.invalid','manager'),($3,$2,'bruno@demo.invalid','member')", [randomUUID(), company, randomUUID()]);
  const ticket = async (subject, status, kind, lines) => {
    const id = randomUUID();
    await db.query(
      "insert into console_tickets(id,company_id,engagement_id,subject,status,kind,author_id,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,now()-interval '2 days',now()-interval '1 hour')",
      [id, company, product, subject, status, kind, ana],
    );
    for (const [i, [author, body]] of lines.entries())
      await db.query(
        "insert into console_messages(id,ticket_id,author_id,body,created_at) values($1,$2,$3,$4,now()-interval '2 days'+($5 || ' hours')::interval)",
        [randomUUID(), id, author, body, String(i * 3)],
      );
  };
  await ticket("Formulário de contato não envia", "in_progress", "problem", [
    [ana, "Desde ontem o formulário de contato do site mostra erro ao enviar."],
    [team, "Olá, Ana. Já reproduzimos o erro e estamos corrigindo. Avisamos por aqui."],
  ]);
  await ticket("Trocar o telefone do rodapé", "waiting_customer", "change", [
    [ana, "Precisamos trocar o telefone que aparece no rodapé do site."],
    [team, "Claro. Qual é o número novo?"],
  ]);
  await db.query("update console_tickets set waiting_for='O número novo do rodapé', waiting_since=now() where status='waiting_customer'");
  // Invoices: one open with Pix and boleto line (fictitious codes), one overdue, one paid.
  const invoice = (description, cents, due, status, extra = {}) =>
    db.query(
      "insert into console_invoices(id,company_id,engagement_id,description,amount_cents,due_date,status,public_id,public_enabled,pix_copy_paste,boleto_line) values($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)",
      [randomUUID(), company, product, description, cents, due, status, randomUUID().replaceAll("-", "").padEnd(43, "x"), extra.pix ?? null, extra.line ?? null],
    );
  const month = (offset) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + offset, 10);
    return d.toISOString().slice(0, 10);
  };
  await invoice("Manutenção do site (mês atual)", 189000, month(1), "issued", {
    pix: "00020126580014BR.GOV.BCB.PIX0136DEMONSTRACAO-NAO-PAGUE5204000053039865406189.005802BR6009SAO PAULO62070503***6304ABCD",
    line: "00190.00009 01234.567890 12345.678901 1 99990000189000",
  });
  await invoice("Manutenção do site (mês passado)", 189000, month(-1), "issued");
  await invoice("Ajustes no formulário de contato", 45000, month(-2), "paid");
  // The board, a contract and a quote waiting for Ana, and a folder of bookmarks.
  for (const [title, status, priority] of [
    ["Nova seção de depoimentos", "todo", "normal"],
    ["Corrigir o formulário de contato", "in_progress", "high"],
    ["Revisar a página inicial", "review", "normal"],
    ["Publicar o site no domínio novo", "done", "normal"],
  ])
    await db.query(
      "insert into console_tasks(id,engagement_id,company_id,title,status,priority,created_by) values($1,$2,$3,$4,$5,$6,$7)",
      [randomUUID(), product, company, title, status, priority, team],
    );
  // The hash signing and answering check (src/lib/document-hash.ts): SHA-256 of the publication with sorted keys.
  const canonical = (v) => (Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);
  const hash = (publication) => createHash("sha256").update(JSON.stringify(canonical(publication))).digest("hex");
  const contractBody =
    "# 1. Objeto\n\nManutenção mensal do site institucional da Empresa Demonstração.\n\n# 2. Preço\n\nR$ 1.890,00 por mês, com vencimento todo dia 10.\n\n# 3. Vigência\n\nDoze meses a partir da assinatura.";
  const contract = { title: "Contrato de manutenção do site", body: contractBody, companyName: "Empresa Demonstração", companyDocument: "00000000000191" };
  await db.query(
    "insert into console_contracts(id,company_id,title,body,author_id,status,published_at,published_version,publication,document_hash) values($1,$2,'Contrato de manutenção do site',$3,$4,'sent',now(),1,$5,$6)",
    [randomUUID(), company, contractBody, team, JSON.stringify(contract), hash(contract)],
  );
  const quote = { summary: "Uma loja virtual ligada ao site.", stack: [], phases: [{ name: "Loja virtual", description: "Catálogo, carrinho e Pix.", hoursMin: 60, hoursMax: 80, tasks: [] }], hourlyRateCents: 15000, discountCents: 0, upfrontPercent: 50, notes: "" };
  const proposal = { ...quote, number: `${new Date().getFullYear()}-001`, title: "Loja virtual", companyName: "Empresa Demonstração", companyDocument: "00000000000191", validUntil: month(1) };
  await db.query(
    `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash)
     values($1,$2,extract(year from now())::int,1,'Loja virtual',$3,$4,'sent',1,$5,now(),$6,$7)`,
    [randomUUID(), company, JSON.stringify(quote), team, month(1), JSON.stringify(proposal), hash(proposal)],
  );
  const folder = randomUUID();
  await db.query("insert into console_bookmark_folders(id,company_id,owner_id,name) values($1,$2,$3,'Acessos do site')", [folder, company, team]);
  await db.query(
    "insert into console_bookmarks(id,company_id,author_id,folder_id,title,url) values(gen_random_uuid(),$1,$2,$3,'Painel da hospedagem','https://example.com'),(gen_random_uuid(),$1,$2,null,'Guia da marca','https://example.org')",
    [company, team, folder],
  );
}
await db.end();

// 3. The Console on port 3100, with code delivery and every outside call simulated.
if (args.includes("--build") || !existsSync(".next/BUILD_ID")) {
  say("Gerando o build do Console (alguns minutos na primeira vez).");
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
}
mkdirSync(dir, { recursive: true });
writeFileSync(otpFile, "");
const consoleEnv = {
  ...process.env,
  DATABASE_URL: `${server}/${database}`,
  BETTER_AUTH_URL: "http://localhost:3100",
  CONSOLE_ADMIN_EMAIL: "equipe@demo.invalid",
  // otp-mock.cjs records the codes and refuses every request outside this Mac;
  // ai-gateway-mock.cjs answers the assistant with scripted replies, never a real model.
  NODE_OPTIONS: `--require=${process.cwd()}/scripts/otp-mock.cjs --require=${process.cwd()}/scripts/ai-gateway-mock.cjs`,
  AI_GATEWAY_API_KEY: "test",
  CONSOLE_TEST_ASSISTANT_FILE: `${dir}/ai.jsonl`,
  CONSOLE_TEST_OTP_FILE: otpFile,
  CONSOLE_TEST_MAIL_FILE: `${dir}/mail.jsonl`,
  RESEND_API_KEY: "test",
  EMAIL_FROM: "Console <test@example.invalid>",
  FLW_SYNOVA: "test",
  FLW_SENDER_NUMBER: "5511000000000",
  FLW_OTP_TEMPLATE_ID: "test",
};
const web = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3100"], {
  env: consoleEnv,
  stdio: ["ignore", "ignore", "inherit"],
});
children.push(web);
web.on("exit", (code) => code && fail("O Console parou. A porta 3100 pode estar em uso por outro processo."));
for (let attempt = 0; ; attempt++) {
  try {
    await fetch("http://localhost:3100/entrar");
    break;
  } catch {
    if (attempt > 100) fail("O Console não subiu na porta 3100.");
    await new Promise((r) => setTimeout(r, 300));
  }
}
say("Console local em http://localhost:3100 (banco de demonstração).");

// 4. Codes appear here instead of an e-mail or WhatsApp.
let seen = 0;
watchFile(otpFile, { interval: 500 }, () => {
  const lines = readFileSync(otpFile, "utf8").trim().split("\n").filter(Boolean);
  for (const line of lines.slice(seen)) {
    const { to, code } = JSON.parse(line);
    console.log(`\n\x1b[42m\x1b[30m CÓDIGO \x1b[0m ${to}: \x1b[1m${code}\x1b[0m\n`);
  }
  seen = lines.length;
});
say("Entre no app com ana@demo.invalid (Administradora) ou bruno@demo.invalid (Membro).");
say("Ou pelo WhatsApp (11) 90000-0001, da Ana. O código aparece aqui.");

// 5. The app: builds the first time, then opens on the simulator (or the iPhone) with Metro.
// The phone reaches the Console by the Mac's .local name, which iOS allows on
// the local network; the simulator could use localhost, but one URL serves both.
let local = "localhost";
try {
  local = `${execFileSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8" }).trim()}.local`;
} catch {
  local = hostname();
}
const target = process.env.DEVICE || process.env.SIMULATOR || "iPhone 17 Pro";
say(`${args.includes("--serve") ? "App já instalado" : `App em ${target}`}, falando com http://${local}:3100.`);
const serve = args.includes("--serve");
if (serve) say("Abra o app \"Console (development)\" no iPhone ou no simulador.");
const app = spawn("npx", serve ? ["expo", "start", "--dev-client", "--lan"] : ["expo", "run:ios", "--device", target], {
  cwd: "mobile",
  env: { ...process.env, APP_ENV: "development", CONSOLE_URL: `http://${local}:3100` },
  stdio: "inherit",
});
children.push(app);
app.on("exit", (code) => stop(code ?? 0));
