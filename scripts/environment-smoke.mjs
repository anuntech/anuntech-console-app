// Run via test-isolated --environment-only, never against customer data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { serializeSignedCookie } from "better-call";
assert.match(
  new URL(process.env.DATABASE_URL).pathname,
  /^\/console_test_[a-f0-9]+$/,
);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = "http://127.0.0.1:3114",
  marker = randomUUID(),
  companyId = randomUUID();
const address = (name) => `navigation-${name}-${marker}@example.invalid`;
const ownerEmail = address("owner"),
  people = {},
  userIds = [];
const dir = mkdtempSync(join(tmpdir(), "console-navigation-test-")),
  capture = join(dir, "otp.jsonl");
let server;
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
  if (name !== "owner")
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
  for (const name of ["owner", "client"]) await makePerson(name);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3114",
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
  assert.ok(ready, "Navigation test server starts");

  const { chromium } = await import(
    process.env.CONSOLE_PLAYWRIGHT_MODULE || "playwright"
  );
  const browser = await chromium.launch({ headless: true });
  try {
    for (const who of ["client", "owner"]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      await context.addCookies(
        people[who].cookie.split("; ").map((value) => ({
          name: value.slice(0, value.indexOf("=")),
          value: value.slice(value.indexOf("=") + 1),
          url: base,
        })),
      );
      const page = await context.newPage();
      let documents = 0;
      page.on("request", (request) => {
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        ) {
          documents++;
        }
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + "/configuracoes/empresa");
      await page.locator('[data-preference-content="company"]').waitFor();
      assert.equal(await page.locator('select[name="companyId"]').count(), 0);
      assert.equal(
        await page
          .getByText("Notificações financeiras", { exact: true })
          .count(),
        0,
      );
      const companyName = await page.locator('input[name="name"]').inputValue();
      assert.equal(
        companyName,
        who === "owner" ? "Anuntech" : `Account QA ${marker}`,
      );
      await page.screenshot({ path: `.next/environment-company-${who}.png` });
      await page
        .getByRole("link", { name: "Notificações", exact: true })
        .click();
      await page.locator('[data-preference-content="notifications"]').waitFor();
      const topic = who === "client" ? "billing" : "tickets";
      const form = page
        .locator("form")
        .filter({ has: page.locator(`input[name="topic"][value="${topic}"]`) });
      await form
        .locator('input[name="emails"]')
        .first()
        .fill(`${who}-one@example.invalid`);
      await form
        .getByRole("button", { name: "Adicionar e-mail", exact: true })
        .click();
      await form
        .locator('input[name="emails"]')
        .nth(1)
        .fill(`${who}-two@example.invalid`);
      await form.locator('input[name="phones"]').first().fill("11966665555");
      await form
        .getByRole("button", { name: "Adicionar telefone", exact: true })
        .click();
      await form.locator('input[name="phones"]').nth(1).fill("11955554444");
      await form.locator('input[name="emailEnabled"]').check();
      await form.locator('input[name="whatsappEnabled"]').check();
      await form.getByRole("button", { name: /Salvar preferências/ }).click();
      await page
        .getByText("Preferências de notificações atualizadas.", { exact: true })
        .waitFor();
      const saved = (
        await db.query(
          "select * from console_notification_preferences where key=$1",
          [`${who === "client" ? companyId : "console"}:${topic}`],
        )
      ).rows[0];
      assert.equal(saved.emails.length, 2);
      assert.equal(saved.phones.length, 2);
      assert.equal(
        documents,
        1,
        "Settings navigation and saving do not reload the document",
      );
      await page.reload();
      await form.locator('input[name="emails"]').nth(1).waitFor();
      assert.equal(
        await form.locator('input[name="emails"]').nth(1).inputValue(),
        `${who}-two@example.invalid`,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `.next/environment-notifications-${who}-mobile.png`,
      });
      await page.getByRole("link", { name: "Membros", exact: true }).click();
      await page
        .getByRole("tab", { name: "Membros (1)", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Convidar pessoa", exact: true })
        .click();
      const invite = page.getByRole("dialog", {
        name: "Convidar pessoa",
        exact: true,
      });
      await invite
        .getByRole("textbox", { name: "E-mail", exact: false })
        .fill(`${who}-invited@example.invalid`);
      await invite
        .getByRole("button", { name: "Adicionar", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "Convidados (1)", exact: true })
        .click();
      await page.screenshot({
        path: `.next/environment-members-${who}-mobile.png`,
      });
      await page
        .getByRole("button", {
          name: `Cancelar convite de ${who}-invited@example.invalid`,
          exact: true,
        })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Cancelar convite", exact: true })
        .click();
      await page
        .getByRole("tab", { name: "Convidados (0)", exact: true })
        .waitFor();
      assert.equal(
        documents,
        2,
        "Saving and member mutations do not reload the document",
      );
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS UI ${who}: own company without selector; multiple contacts persist; member invitations and cancellation; mobile fit`,
      );
    }
  } finally {
    await browser.close();
  }
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
      "delete from console_staff_members where created_by=any($1::text[])",
      [userIds],
    );
    await db.query(
      "delete from console_audit_events where actor_id=any($1::text[])",
      [userIds],
    );
    await db.query("delete from console_memberships where company_id=$1", [
      companyId,
    ]);
    await db.query("delete from console_companies where id=$1", [companyId]);
    await db.query("delete from console_user where id=any($1::text[])", [
      userIds,
    ]);
  } finally {
    await db.end();
    rmSync(dir, { recursive: true, force: true });
  }
}
