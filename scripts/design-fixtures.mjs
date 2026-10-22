// Banco local com dados fictícios para revisar o visual do Console (capturas de tela, nova identidade).
// Só aceita o Postgres desta máquina. Recria o banco console_design e grava os cookies de sessão em
// .design-session (pessoa da equipe) e .design-session-client (Administradora de uma empresa cliente),
// os dois fora do git. Os ids são estáveis entre execuções, então os links de /tmp/telas/rotas.md
// continuam valendo depois de rodar de novo.
// Uso: BETTER_AUTH_SECRET=<o do servidor de desenvolvimento> node scripts/design-fixtures.mjs
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import pg from "pg";
import { serializeSignedCookie } from "better-call";
import { seedData } from "./design-fixtures-data.mjs";

const server = process.env.DESIGN_DATABASE_SERVER || "postgres://postgres:ci-test-only@127.0.0.1:5434/postgres";
const source = new URL(server);
if (!/^(localhost|127(\.\d{1,3}){3})$/.test(source.hostname)) {
  console.error(`Recusado: ${source.hostname} não é esta máquina.`);
  process.exit(1);
}
if (!process.env.BETTER_AUTH_SECRET) {
  console.error("Falta BETTER_AUTH_SECRET (o mesmo do servidor de desenvolvimento).");
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

/** Stable ids: the same name gives the same UUID on every run. */
const uid = (key) => {
  const h = createHash("sha256").update(`design:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const summary = await seedData({ db, uid });
await db.end();

const cookieFor = async (token) =>
  (await serializeSignedCookie("anuntech-console.session_token", token, process.env.BETTER_AUTH_SECRET, { path: "/" })).split(";")[0];
await writeFile(
  ".design-session",
  JSON.stringify({ cookie: await cookieFor(summary.staff.token), staffEmail: summary.staff.email, databaseUrl: target.toString() }, null, 2) + "\n",
);
await writeFile(
  ".design-session-client",
  JSON.stringify(
    {
      cookie: await cookieFor(summary.client.token),
      clientEmail: summary.client.email,
      companyId: summary.client.companyId,
      databaseUrl: target.toString(),
    },
    null,
    2,
  ) + "\n",
);
await writeFile(".design-ids.json", JSON.stringify(summary.ids, null, 2) + "\n");
console.log(`Banco ${name} pronto: ${summary.counts}.`);
console.log(`Sessões: .design-session (equipe, ${summary.staff.email}) e .design-session-client (${summary.client.email}). Ids em .design-ids.json.`);
console.log(`Suba o Console com DATABASE_URL=${target} CONSOLE_ADMIN_EMAIL=${summary.staff.email}`);
