// A disposable database keeps all test fixtures separate from customer data.
import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
const name = `console_test_${randomBytes(8).toString("hex")}`;
const source = new URL(process.env.DATABASE_URL);
source.hostname = source.hostname.replace("-pooler.", ".");
const admin = new pg.Pool({ connectionString: source.toString() });
let created = false;
let certDir;
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  const target = new URL(source);
  target.pathname = `/${name}`;
  const db = new pg.Pool({ connectionString: target.toString() });
  try {
    // Use production's journal; ignore duplicate files left by filesystem sync.
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const { tag } of journal.entries)
      await db.query(await readFile(`drizzle/${tag}.sql`, "utf8"));
  } finally {
    await db.end();
  }
  console.log("Banco temporário criado e migrações aplicadas.");
  const bankEnv = {};
  if (
    ![
      "--otp-only",
      "--security-only",
      "--members-only",
      "--account-only",
      "--notifications-only",
    ].some((flag) => process.argv.includes(flag))
  ) {
    certDir = await mkdtemp(join(tmpdir(), "console-bank-test-"));
    const cert = join(certDir, "test.crt"),
      key = join(certDir, "test.key");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=console-test.invalid",
      ],
      { stdio: "ignore" },
    );
    Object.assign(bankEnv, {
      INTER_CLIENT_ID: "test",
      INTER_CLIENT_SECRET: "test",
      INTER_CERTIFICATE_BASE64: (await readFile(cert)).toString("base64"),
      INTER_PRIVATE_KEY_BASE64: (await readFile(key)).toString("base64"),
    });
  }
  const focusedSuites = {
    "--otp-only": "scripts/otp-smoke.mjs",
    "--security-only": "scripts/security-smoke.mjs",
    "--members-only": "scripts/members-smoke.mjs",
    "--account-only": "scripts/account-smoke.mjs",
    "--notifications-only": "scripts/notifications-smoke.mjs",
    "--billing-only": "scripts/smoke.mjs",
    "--regression-only": "scripts/smoke.mjs",
  };
  const focused = Object.keys(focusedSuites).find((flag) =>
    process.argv.includes(flag),
  );
  const scripts = focused
    ? [focusedSuites[focused]]
    : [
        "scripts/otp-smoke.mjs",
        "scripts/security-smoke.mjs",
        "scripts/members-smoke.mjs",
        "scripts/account-smoke.mjs",
        "scripts/notifications-smoke.mjs",
        "scripts/smoke.mjs",
      ];
  for (const script of scripts) {
    const child = spawn(process.execPath, [script], {
      stdio: "inherit",
      env: {
        ...process.env,
        ...bankEnv,
        DATABASE_URL: target.toString(),
        CONSOLE_TEST_BILLING_ONLY: process.argv.includes("--billing-only")
          ? "1"
          : "",
      },
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
  if (certDir) await rm(certDir, { recursive: true, force: true });
}
