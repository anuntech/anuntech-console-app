// Runs the integration suites against a local Postgres 17, like CI, so the
// disposable database never lands on the server named in .env.local.
import { execFileSync, spawn } from "node:child_process";
import pg from "pg";
const container = "console-smoke-pg17";
const url = "postgres://postgres:ci-test-only@127.0.0.1:5434/postgres";
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
let running;
try {
  running = docker("inspect", "-f", "{{.State.Running}}", container);
} catch (error) {
  if (error.code === "ENOENT")
    fail("Docker não encontrado. Instale o OrbStack ou o Docker Desktop.");
  if (!/no such (object|container)/i.test(error.stderr))
    fail(`O Docker não respondeu: ${error.stderr.trim()}`);
}
if (running === undefined) {
  console.log(`Criando o contêiner ${container} (postgres:17, porta 5434).`);
  docker(
    "run",
    "-d",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=ci-test-only",
    "-p",
    "127.0.0.1:5434:5432",
    "postgres:17",
  );
} else if (running !== "true") docker("start", container);
// The image's first-boot server only listens on the socket, so a TCP
// connection means the real server is up.
for (let attempt = 1; ; attempt++) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.end();
    break;
  } catch (error) {
    if (attempt === 60)
      fail(
        `O Postgres de ${container} não respondeu em 127.0.0.1:5434: ${error.message}`,
      );
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
// The shell's DATABASE_URL wins over the one --env-file reads from .env.local.
const child = spawn(
  process.execPath,
  [
    "--env-file-if-exists=.env.local",
    "scripts/test-isolated.mjs",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
);
child.on("exit", (code, signal) => process.exit(signal ? 1 : code));
