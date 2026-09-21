// Run via test-isolated --navigation-only, never against customer data.
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
const base = "http://127.0.0.1:3113",
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
  for (const name of ["owner"]) await makePerson(name);
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3113",
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
    for (const [entry, width] of [
      ["/conta", 1280],
      ["/painel", 1280],
      ["/conta", 390],
      ["/painel", 390],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      await context.addCookies(
        people.owner.cookie
          .split("; ")
          .filter(Boolean)
          .map((value) => ({
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
        )
          documents++;
      });
      await page.route("**/*", async (route) => {
        if (route.request().headers().rsc === "1")
          await new Promise((resolve) => setTimeout(resolve, 350));
        await route.continue();
      });
      await page.goto(base + entry);
      if (entry === "/painel")
        await page.getByRole("link", { name: "Ajustes", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await page.locator('[data-preference-content="account"]').waitFor();
      await page.evaluate(() => {
        window.qaFrames = [];
        window.qaDialog = document.querySelector('[role="dialog"]');
        window.qaSampling = true;
        function sample() {
          if (!window.qaSampling) return;
          const dialogs = [
            ...document.querySelectorAll('[role="dialog"]'),
          ].filter((node) => node.getClientRects().length);
          window.qaFrames.push({
            path: location.pathname,
            count: dialogs.length,
            sameDialog: dialogs[0] === window.qaDialog,
            loading: document.body.innerText.includes("Carregando o Console"),
          });
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      for (const [name, path] of [
        ["Membros", "/configuracoes/membros"],
        ["Notificações", "/configuracoes/notificacoes"],
        ["Integrações", "/configuracoes"],
        ["Dados da empresa", "/configuracoes/empresa"],
        ["Minha conta", "/conta"],
      ]) {
        await page
          .getByRole("navigation", { name: "Categorias dos ajustes" })
          .getByRole("link", { name, exact: name !== "Minha conta" })
          .click();
        await page.waitForURL(base + path);
        await page
          .getByRole("dialog")
          .getByRole("heading", { name, exact: true })
          .waitFor();
        const section =
          path === "/conta"
            ? "account"
            : path.endsWith("/membros")
              ? "members"
              : path.endsWith("/notificacoes")
                ? "notifications"
                : path.endsWith("/empresa")
                  ? "company"
                  : "integrations";
        await page.locator(`[data-preference-content="${section}"]`).waitFor();
        await page.waitForTimeout(100);
      }
      const missing = await page.evaluate(() => {
        window.qaSampling = false;
        return window.qaFrames.filter(
          (x) => x.count !== 1 || !x.sameDialog || x.loading,
        );
      });
      console.log(
        "NAVIGATION",
        JSON.stringify({
          entry,
          width,
          documents,
          missing: missing.length,
          examples: missing.slice(0, 3),
        }),
      );
      assert.equal(documents, 1);
      assert.equal(missing.length, 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.getByRole("button", { name: "Fechar ajustes" }).click();
      await page.waitForURL(base + "/painel");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      if (entry === "/painel") {
        await page.goForward();
        await page.waitForURL(base + "/conta");
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await page.waitForURL(base + "/painel");
      }
      assert.equal(
        documents,
        1,
        "Closing and history navigation keep the document",
      );
      await context.close();
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
