// Account mutations go through real HTTP Server Actions in a disposable database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { serializeSignedCookie } from "better-call";
import { encodeReply } from "next/dist/compiled/react-server-dom-webpack/client.node.js";

assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /^\/console_test_[a-f0-9]+$/,
  "Use test-isolated; never run against customer data",
);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = "http://127.0.0.1:3108",
  marker = randomUUID(),
  companyId = randomUUID();
const address = (name) => `account-${name}-${marker}@example.invalid`;
const ownerEmail = address("owner"),
  people = {},
  userIds = [];
const dir = mkdtempSync(join(tmpdir(), "console-account-test-")),
  capture = join(dir, "otp.jsonl");
const manifest = JSON.parse(
  readFileSync(".next/server/server-reference-manifest.json", "utf8"),
);
const actionIds = Object.fromEntries(
  Object.entries(manifest.node)
    .filter(([, value]) =>
      [
        "src/lib/notification-actions.ts",
        "src/lib/members-actions.ts",
      ].includes(value.filename),
    )
    .map(([id, value]) => [value.exportedName, id]),
);
let server,
  count = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  count++;
  console.log("PASS", message);
};
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
// Action values are plain JSON. Resolve the action-result reference without executing UI modules.
function actionValue(flight) {
  const records = new Map();
  for (const line of flight.split("\n")) {
    const match = line.match(/^([0-9a-f]+):(\{.*)$/);
    if (match) {
      try {
        records.set(match[1], JSON.parse(match[2]));
      } catch {
        /* UI records can be binary-framed; only the action JSON is needed. */
      }
    }
  }
  const root = records.get("0"),
    reference = root?.a;
  const value =
    typeof reference === "string" && reference.startsWith("$@")
      ? records.get(reference.slice(2))
      : reference;
  assert.ok(
    value && typeof value === "object",
    "Server Action returned a structured result",
  );
  return value;
}
async function action(name, who, values) {
  assert.ok(actionIds[name], `Build includes ${name}`);
  const form = new FormData();
  for (const [key, value] of Object.entries(values))
    form.set(key, String(value));
  const response = await request("/configuracoes/notificacoes", who, {
    method: "POST",
    headers: {
      Origin: base,
      "Next-Action": actionIds[name],
      Accept: "text/x-component",
    },
    body: await encodeReply([{}, form]),
  });
  assert.ok(response.status < 500, `Action ${name} did not fail at the server`);
  return { ...response, value: actionValue(response.text) };
}
async function addSession(who, label) {
  const id = randomUUID(),
    token = randomUUID();
  await db.query(
    "insert into console_session(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",
    [id, token, people[who].id],
  );
  people[label] = {
    ...people[who],
    sessionId: id,
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
async function makePerson(name) {
  const id = randomUUID(),
    email = name === "owner" ? ownerEmail : address(name);
  await db.query(
    "insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)",
    [id, `QA ${name}`, email],
  );
  userIds.push(id);
  people[name] = { id, email };
  await addSession(name, name);
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'manager')",
    [randomUUID(), companyId, email],
  );
}

try {
  await db.query(
    "insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)",
    [
      companyId,
      `Account QA ${marker}`,
      marker.replaceAll("-", "").slice(0, 14),
      address("company"),
    ],
  );
  for (const name of ["owner", "client", "other", "limit", "origin"])
    await makePerson(name);
  await addSession("client", "client-second");
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3108",
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
  assert.ok(ready, "Account test server starts");

  const path = "/configuracoes/notificacoes";
  let result = await action("setTicketNotifications", "client", {
    enabled: "false",
  });
  ok(
    !!result.value.error,
    "Company manager cannot change notification settings",
  );
  result = await action("setTicketNotifications", "owner", {
    enabled: "invalid",
  });
  ok(!!result.value.error, "Notification toggle rejects malformed state");
  const ticketId = randomUUID();
  await db.query(
    "insert into console_tickets(id,company_id,subject,author_id) values($1,$2,'Teste de notificações',$3)",
    [ticketId, companyId, people.owner.id],
  );
  await db.query(
    "insert into console_audit_events(id,actor_id,company_id,action,entity_id) select $1||lpad(i::text,2,'0'),$2,$3,'ticket.created',$4 from generate_series(1,25) i",
    [marker, people.owner.id, companyId, ticketId],
  );
  await db.query(
    "insert into console_ticket_notices(id,event_id,ticket_id,channel,destination,payload,status,created_at) select $1||lpad(i::text,2,'0'),$1||lpad(i::text,2,'0'),$2,'email',$3,'{}'::jsonb,case when i=1 then 'pending' else 'delivered' end,now() from generate_series(1,25) i",
    [marker, ticketId, ownerEmail],
  );
  const rowIds = (html) =>
    [...html.matchAll(/data-notice-id="([^"]+)"/g)].map((m) => m[1]);
  const first = await request(path, "owner"),
    second = await request(path + "?page=2", "owner");
  ok(
    rowIds(first.text).length === 20 && rowIds(second.text).length === 5,
    "History is paginated on the server, 20 then 5 rows",
  );
  ok(
    new Set([...rowIds(first.text), ...rowIds(second.text)]).size === 25,
    "Tied timestamps have deterministic non-overlapping pages",
  );
  ok(
    rowIds(first.text)[0] === marker + "25" &&
      rowIds(second.text)[4] === marker + "01",
    "History orders latest first with stable ID tie-breaker",
  );
  ok(
    rowIds((await request(path + "?page=-5", "owner")).text).join() ===
      rowIds(first.text).join(),
    "Invalid page falls back to first page",
  );
  ok(
    rowIds((await request(path + "?page=999", "owner")).text).length === 5,
    "Out-of-range page clamps to final page",
  );
  ok(
    !first.text.includes("Destinatários") &&
      !first.text.includes("Verificar avisos pendentes") &&
      !first.text.includes("notificação_chamado_console"),
    "Notification page omits the removed explanations and contact settings",
  );
  result = await action("setTicketNotifications", "owner", {
    enabled: "false",
  });
  ok(
    !!result.value.success &&
      (await db.query("select enabled from console_notification_settings"))
        .rows[0].enabled === false,
    "Disable is persisted",
  );
  ok(
    (
      await db.query("select status from console_ticket_notices where id=$1", [
        marker + "01",
      ])
    ).rows[0].status === "cancelled",
    "Disabling cancels unsent queued notifications",
  );
  ok(
    (await db.query("select count(*)::int n from console_ticket_notices"))
      .rows[0].n === 25,
    "Disabling preserves history",
  );
  const queueEvent = randomUUID();
  await db.query(
    "insert into console_audit_events(id,actor_id,company_id,action,entity_id) values($1,$2,$3,'ticket.created',$4)",
    [queueEvent, people.owner.id, companyId, ticketId],
  );
  const { execFileSync } = await import("node:child_process");
  const queueCheck = (enabled) =>
    execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/notification-queue-check.mts",
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          CONSOLE_ADMIN_EMAIL: ownerEmail,
          CONSOLE_QUEUE_FIXTURE: JSON.stringify({
            ticketId,
            companyId,
            eventId: queueEvent,
            enabled,
          }),
        },
      },
    );
  queueCheck(false);
  result = await action("setTicketNotifications", "owner", { enabled: "true" });
  ok(!!result.value.success, "Notifications can be enabled again");
  await db.query(
    "update console_user set phone_number='+5511999999999',phone_number_verified=true where id=$1",
    [people.owner.id],
  );
  queueCheck(true);
  ok(
    (
      await db.query("select status from console_ticket_notices where id=$1", [
        marker + "01",
      ])
    ).rows[0].status === "cancelled",
    "Re-enabling does not replay cancelled notifications",
  );
  await action("saveConsoleStaffMember", "owner", {
    email: address("invited"),
  });
  await action("saveConsoleStaffMember", "owner", {
    email: people.other.email,
  });
  if (process.env.CONSOLE_PLAYWRIGHT_MODULE) {
    const { chromium } = await import(process.env.CONSOLE_PLAYWRIGHT_MODULE);
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      await context.addCookies(
        people.owner.cookie.split("; ").map((value) => ({
          name: value.slice(0, value.indexOf("=")),
          value: value.slice(value.indexOf("=") + 1),
          url: base,
        })),
      );
      const page = await context.newPage();
      await page.goto(base + "/configuracoes/membros");
      await page
        .getByRole("tab", { name: "Membros (2)", exact: true })
        .waitFor();
      await page.screenshot({ path: ".next/members-desktop.png" });
      await page
        .getByRole("tab", { name: "Convidados (1)", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: `Cancelar convite de ${address("invited")}`,
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("tab", { name: "Convidados (1)", exact: true })
        .press("ArrowLeft");
      await page
        .getByRole("button", {
          name: `Expulsar de ${people.other.email}`,
          exact: true,
        })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Expulsar", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "Membros (1)", exact: true })
        .waitFor();
      await page
        .getByRole("link", { name: "Notificações", exact: true })
        .click();
      await page.getByRole("switch").waitFor();
      await page.getByRole("switch").click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[role="switch"]')
            ?.getAttribute("aria-checked") === "false",
      );
      await page.reload();
      assert.equal(
        await page.getByRole("switch").getAttribute("aria-checked"),
        "false",
      );
      await page.getByRole("link", { name: "Próxima", exact: true }).click();
      await page.waitForURL("**page=2");
      await page.waitForFunction(
        () => document.querySelectorAll("[data-notice-id]").length === 7,
      );
      await page.screenshot({ path: ".next/notifications-desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: ".next/notifications-mobile.png" });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.getByRole("link", { name: "Membros", exact: true }).click();
      await page
        .getByRole("tab", { name: "Membros (1)", exact: true })
        .waitFor();
      await page.screenshot({ path: ".next/members-mobile.png" });
      ok(
        true,
        "Browser: member tabs, keyboard, expulsion, notification toggle, reload and mobile pagination",
      );
      // Intercepted preferences keep their origin through pagination.
      await page.goto(base + "/painel");
      await page.getByRole("link", { name: "Ajustes", exact: true }).click();
      await page
        .getByRole("link", { name: "Notificações", exact: true })
        .click();
      await page.getByRole("link", { name: "Próxima", exact: true }).click();
      await page.waitForURL("**page=2");
      await page.waitForFunction(
        () => document.querySelectorAll("[data-notice-id]").length === 7,
      );
      await page
        .getByRole("button", { name: "Fechar ajustes", exact: true })
        .click();
      await page.waitForURL("**/painel");
      ok(
        true,
        "Intercepted notification pagination preserves modal close destination",
      );
    } finally {
      await browser.close();
    }
  }
  console.log(`Concluído: ${count} verificações de preferências.`);
} catch (error) {
  console.error("FAIL", error.stack);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await db.end();
  rmSync(dir, { recursive: true, force: true });
}
