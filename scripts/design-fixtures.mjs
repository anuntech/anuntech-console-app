// Banco local com dados fictícios para revisar o visual do Console (capturas de tela, nova identidade).
// Só aceita o Postgres desta máquina. Recria o banco console_design e grava o cookie de sessão
// da pessoa da equipe em .design-session (fora do git).
// Uso: node --env-file-if-exists=.env.local scripts/design-fixtures.mjs
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import pg from "pg";
import { serializeSignedCookie } from "better-call";

const server = process.env.DESIGN_DATABASE_SERVER || "postgres://postgres:ci-test-only@127.0.0.1:5434/postgres";
const source = new URL(server);
if (!/^(localhost|127(\.\d{1,3}){3})$/.test(source.hostname)) {
  console.error(`Recusado: ${source.hostname} não é esta máquina.`);
  process.exit(1);
}
if (!process.env.BETTER_AUTH_SECRET) {
  console.error("Falta BETTER_AUTH_SECRET (rode com --env-file-if-exists=.env.local).");
  process.exit(1);
}

const name = "console_design";
const admin = new pg.Pool({ connectionString: server });
await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
await admin.query(`CREATE DATABASE "${name}"`);
await admin.end();

const target = new URL(server);
target.pathname = `/${name}`;
const db = new pg.Pool({ connectionString: target.toString() });
const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
for (const { tag } of journal.entries) await db.query(await readFile(`drizzle/${tag}.sql`, "utf8"));

const staffEmail = "equipe@design.invalid";
const staffId = randomUUID();
const token = randomUUID();
await db.query("insert into console_user (id,name,email,email_verified) values ($1,$2,$3,true)", [
  staffId,
  "Kauan Silva",
  staffEmail,
]);
await db.query("insert into console_session (id,token,user_id,expires_at) values ($1,$2,$3,$4)", [
  randomUUID(),
  token,
  staffId,
  new Date(Date.now() + 30 * 24 * 3600 * 1000),
]);

const companies = [
  ["Padaria Bom Grão", "contato@bomgrao.invalid"],
  ["Clínica Vida Plena", "financeiro@vidaplena.invalid"],
  ["Transportes Rota Sul", "adm@rotasul.invalid"],
  ["Oficina Torque", "oficina@torque.invalid"],
  ["Escola Pequeno Saber", "secretaria@pequenosaber.invalid"],
].map(([label, email], i) => ({ id: randomUUID(), label, email, document: String(11222333000100 + i * 1111).padStart(14, "0") }));
for (const c of companies)
  await db.query("insert into console_companies(id,name,document,billing_email) values ($1,$2,$3,$4)", [
    c.id,
    c.label,
    c.document,
    c.email,
  ]);

const day = (offset) => new Date(Date.now() + offset * 24 * 3600 * 1000);
const tickets = [
  [0, "O relatório do contador saiu sem as notas de setembro", "open", "high", -0.1],
  [1, "Agenda não mostra os horários de sábado", "in_progress", "normal", -1],
  [2, "Incluir o motorista novo no app de entregas", "waiting_customer", "normal", -2],
  [3, "Ordem de serviço duplicada ao salvar", "open", "urgent", -0.3],
  [4, "Boletos da rematrícula com vencimento errado", "in_progress", "high", -3],
  [0, "Exportar vendas do mês em planilha", "resolved", "low", -6],
  [1, "Trocar o logotipo nos lembretes por WhatsApp", "resolved", "normal", -9],
  [2, "Acesso para a nova gerente da filial", "closed", "normal", -14],
];
for (const [ci, subject, status, priority, created] of tickets)
  await db.query(
    "insert into console_tickets(id,company_id,subject,status,priority,author_id,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$7)",
    [randomUUID(), companies[ci].id, subject, status, priority, staffId, day(created)],
  );

const invoices = [
  [0, "Mensalidade do sistema · outubro", "issued", 49000, 4],
  [1, "Primeiro Módulo · 2ª parcela", "issued", 500000, -2],
  [2, "Mensalidade do sistema · outubro", "paid", 49000, -10],
  [3, "Hospedagem e e-mail · outubro", "issued", 18900, 0],
  [4, "Primeiro Módulo · 1ª parcela", "paid", 500000, -20],
  [0, "Mensalidade do sistema · novembro", "draft", 49000, 34],
];
for (const [ci, description, status, cents, due] of invoices)
  await db.query(
    "insert into console_invoices(id,company_id,status,description,amount_cents,due_date) values($1,$2,$3,$4,$5,$6)",
    [randomUUID(), companies[ci].id, status, description, cents, day(due).toISOString().slice(0, 10)],
  );

await db.end();

const cookie = (
  await serializeSignedCookie("anuntech-console.session_token", token, process.env.BETTER_AUTH_SECRET, { path: "/" })
).split(";")[0];
await writeFile(
  ".design-session",
  JSON.stringify({ cookie, staffEmail, databaseUrl: target.toString() }, null, 2) + "\n",
);
console.log(`Banco ${name} pronto: ${companies.length} empresas, ${tickets.length} chamados, ${invoices.length} faturas.`);
console.log(`Suba o Console com DATABASE_URL=${target} CONSOLE_ADMIN_EMAIL=${staffEmail}`);
