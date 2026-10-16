// Fails on high or critical advisories in production dependencies, except the
// ones listed in .github/audit-allowlist.json with a date that has not passed.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = spawnSync(
  "npm",
  ["audit", "--package-lock-only", "--omit=dev", "--json"],
  {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);
let audit;
try {
  audit = JSON.parse(run.stdout);
} catch {
  audit = null;
}
if (!audit?.metadata) {
  console.error("npm audit não respondeu com um relatório.");
  console.error(run.stderr || run.stdout);
  process.exit(1);
}

const allowlist = JSON.parse(
  readFileSync(new URL("../.github/audit-allowlist.json", import.meta.url), "utf8"),
);
const today = new Date().toISOString().slice(0, 10);
for (const entry of allowlist)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? "")) {
    console.error(`Exceção sem prazo válido: ${entry.id} (${entry.package}).`);
    process.exit(1);
  }

const open = new Set();
const expired = new Set();
const used = new Set();
for (const vulnerability of Object.values(audit.vulnerabilities ?? {}))
  for (const via of vulnerability.via) {
    // Strings in `via` point to another package; its own entry carries the advisory.
    if (typeof via !== "object") continue;
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id = via.url?.split("/").pop() ?? String(via.source);
    const line = `${via.severity} ${vulnerability.name} ${id} ${via.title}`;
    const entry = allowlist.find(
      (item) => item.id === id && item.package === vulnerability.name,
    );
    if (!entry) open.add(line);
    else if (entry.expires < today) expired.add(`${line} (exceção venceu em ${entry.expires})`);
    else used.add(`${entry.id} ${entry.package}`);
  }

for (const entry of allowlist)
  if (!used.has(`${entry.id} ${entry.package}`) && entry.expires >= today)
    console.log(`Exceção sem uso, pode sair da lista: ${entry.id} (${entry.package}).`);

const counts = audit.metadata.vulnerabilities;
console.log(
  `Produção: ${counts.critical} crítica(s), ${counts.high} alta(s), ${counts.moderate} média(s), ${counts.low} baixa(s). ${used.size} aviso(s) em exceção até o prazo.`,
);
if (open.size || expired.size) {
  console.error("\nAvisos altos ou críticos sem exceção válida:");
  for (const line of [...open, ...expired]) console.error(`  ${line}`);
  process.exit(1);
}
