// A disposable database keeps all test fixtures separate from customer data.
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import pg from "pg";
const name = `console_test_${randomBytes(8).toString("hex")}`;
const source = new URL(process.env.DATABASE_URL);
source.hostname = source.hostname.replace("-pooler.", ".");
const admin = new pg.Pool({ connectionString: source.toString() });
let created = false;
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  const target = new URL(source);
  target.pathname = `/${name}`;
  const db = new pg.Pool({ connectionString: target.toString() });
  try {
    for (const file of (await readdir("drizzle"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.query(await readFile(`drizzle/${file}`, "utf8"));
  } finally {
    await db.end();
  }
  console.log("Banco temporário criado e migrações aplicadas.");
  for (const script of process.argv.includes("--otp-only")
    ? ["scripts/otp-smoke.mjs"]
    : ["scripts/otp-smoke.mjs", "scripts/smoke.mjs"]) {
    const child = spawn(process.execPath, [script], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: target.toString() },
    });
    const status = await new Promise((resolve) => child.on("exit", resolve));
    if (status !== 0) throw new Error(`Falha em ${script}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) {
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    console.log("Banco temporário removido.");
  }
  await admin.end();
}
