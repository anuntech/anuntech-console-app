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
const base = "http://127.0.0.1:3105",
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
    .filter(([, value]) => value.filename === "src/lib/account-actions.ts")
    .map(([id, value]) => [value.exportedName, id]),
);
let server,
  count = 0;
const ok = (condition, message) => {
  assert.ok(condition, message);
  count++;
  console.log("PASS", message);
};
const messages = () => {
  try {
    return readFileSync(capture, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
  } catch {
    return [];
  }
};
async function limits() {
  await db.query("delete from console_otp_limits");
  await db.query("delete from console_rate_limit");
}
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
  const response = await request("/conta", who, {
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
async function rowFor(email) {
  return (
    await db.query("select * from console_account_emails where email=$1", [
      email,
    ])
  ).rows[0];
}
async function begin(who, email, primary = false) {
  await limits();
  const before = messages().length;
  const response = await action("requestAccountEmail", who, { email, primary });
  if (!response.value.challengeId) return { response };
  const records = (
    await db.query(
      "select id,value from console_verification where identifier=$1",
      [`account-email:${response.value.challengeId}`],
    )
  ).rows;
  const proof = JSON.parse(records[0].value),
    sent = messages().slice(before);
  return {
    response,
    id: records[0].id,
    sourceCode: sent.find((message) => message.to === proof.sourceEmail)?.code,
    targetCode: sent.find((message) => message.to === email)?.code,
    proof,
  };
}
const confirm = (who, proof, overrides = {}) =>
  action("confirmAccountEmail", who, {
    challengeId: proof.id,
    sourceCode: proof.sourceCode,
    targetCode: proof.targetCode,
    ...overrides,
  });
async function api(path, body, cookie) {
  const response = await fetch(`${base}/api/auth${path}`, {
    redirect: "manual",
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  };
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
      "3105",
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

  // Bundled avatars use the same authorization and transaction as uploads.
  const chosen = "/brand/avatars/avatar-01.svg";
  const avatarRequest = (who, image, origin = base) =>
    request("/api/conta/foto", who, {
      method: "PATCH",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
  ok(
    (await avatarRequest(null, chosen)).status === 401,
    "Avatar selection requires authentication",
  );
  ok(
    (await avatarRequest("client", chosen, "https://evil.invalid")).status ===
      403,
    "Avatar selection rejects cross-origin requests",
  );
  for (const value of [
    "https://evil.invalid/x.svg",
    "/brand/avatars/../x.svg",
    "/brand/avatars/avatar-90.svg",
    null,
  ])
    ok(
      (await avatarRequest("client", value)).status === 400,
      "Avatar selection rejects values outside the catalog",
    );
  ok(
    (await avatarRequest("client", chosen)).status === 200,
    "Member can select an illustrated avatar",
  );
  ok(
    (
      await db.query("select image from console_user where id=$1", [
        people.client.id,
      ])
    ).rows[0].image === chosen,
    "Selected avatar is persisted",
  );
  ok(
    (
      await db.query("select image from console_user where id=$1", [
        people.other.id,
      ])
    ).rows[0].image === null,
    "Avatar change leaves another account untouched",
  );
  ok(
    (await request("/conta", "client")).text.includes(chosen),
    "Account renders the selected avatar",
  );
  ok(
    (await request(chosen)).status === 200,
    "Bundled illustration is served successfully",
  );
  const removed = await request("/api/conta/foto", "client", {
    method: "DELETE",
    headers: { Origin: base },
  });
  ok(
    removed.status === 200 &&
      /^\/brand\/avatars\/avatar-\d{2}\.svg$/.test(
        JSON.parse(removed.text).image,
      ),
    "Removing a photo assigns a default avatar",
  );
  const freshEmail = address("invited-avatar");
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'support')",
    [randomUUID(), companyId, freshEmail],
  );
  await limits();
  await api("/email-otp/send-verification-otp", {
    email: freshEmail,
    type: "sign-in",
  });
  const fresh = await api("/sign-in/email-otp", {
    email: freshEmail,
    otp: messages().at(-1).code,
  });
  ok(
    fresh.status === 200 &&
      /^\/brand\/avatars\/avatar-\d{2}\.svg$/.test(fresh.body.user?.image),
    "Invited user's first login creates an account with a random avatar",
  );
  ok(
    (await api("/get-session", undefined, fresh.cookie)).body?.user.image ===
      fresh.body.user.image,
    "Default avatar remains stable across session reads",
  );

  const target = address("additional");
  let proof = await begin("client", target);
  ok(
    !!proof.id &&
      /^\d{6}$/.test(proof.sourceCode) &&
      /^\d{6}$/.test(proof.targetCode),
    "Adding an email requires two independent mocked codes",
  );
  const stored = (
    await db.query("select value from console_verification where id=$1", [
      proof.id,
    ])
  ).rows[0].value;
  ok(
    !stored.includes(proof.sourceCode) && !stored.includes(proof.targetCode),
    "Email ownership codes are stored only as HMAC hashes",
  );
  let result = await confirm("other", proof);
  ok(
    !!result.value.error && !(await rowFor(target)),
    "Another user cannot redeem the email proof",
  );
  result = await confirm("client-second", proof);
  ok(
    !!result.value.error && !(await rowFor(target)),
    "A different session of the same user cannot redeem the proof",
  );
  result = await confirm("client", proof);
  ok(
    !!result.value.success &&
      (await rowFor(target))?.user_id === people.client.id &&
      !!(await rowFor(target))?.verified_at,
    "Both codes add the verified address to the requesting account",
  );
  result = await confirm("client", proof);
  ok(
    !!result.value.error &&
      (
        await db.query("select id from console_account_emails where email=$1", [
          target,
        ])
      ).rowCount === 1,
    "Email proof is single-use",
  );
  const primaryId = (await rowFor(people.client.email)).id;
  result = await action("removeAccountEmail", "client", { id: primaryId });
  ok(
    !!result.value.error && !!(await rowFor(people.client.email)),
    "Principal email cannot be removed",
  );
  result = await action("removeAccountEmail", "other", {
    id: (await rowFor(target)).id,
  });
  ok(
    !!result.value.error && !!(await rowFor(target)),
    "Another account cannot remove a verified email",
  );
  result = await action("removeAccountEmail", "client", {
    id: (await rowFor(target)).id,
  });
  ok(
    !!result.value.success && !(await rowFor(target)),
    "Unlinked additional email can be removed",
  );
  ok(
    (
      await db.query("select id from console_session where user_id=$1", [
        people.client.id,
      ])
    ).rows.every((row) => row.id === people.client.sessionId),
    "Removing an email revokes other sessions while retaining the current one",
  );

  proof = await begin("client", address("expired"));
  await db.query(
    "update console_verification set expires_at=now()-interval '1 second' where id=$1",
    [proof.id],
  );
  result = await confirm("client", proof);
  ok(
    !!result.value.error && !(await rowFor(address("expired"))),
    "Expired proofs do not add contacts",
  );
  proof = await begin("client", address("attempts"));
  const wrong = proof.sourceCode === "000000" ? "000001" : "000000";
  for (let i = 0; i < 5; i++)
    await confirm("client", proof, { sourceCode: wrong });
  result = await confirm("client", proof);
  const attemptRecord = JSON.parse(
    (
      await db.query("select value from console_verification where id=$1", [
        proof.id,
      ])
    ).rows[0].value,
  );
  ok(
    attemptRecord.attempts === 5 &&
      !!result.value.error &&
      !(await rowFor(address("attempts"))),
    "Five incorrect attempts exhaust the proof even when valid codes follow",
  );
  proof = await begin("origin", address("source-bound"));
  await db.query("update console_user set email=$1 where id=$2", [
    address("origin-current"),
    people.origin.id,
  ]);
  result = await confirm("origin", proof);
  ok(
    !!result.value.error && !(await rowFor(address("source-bound"))),
    "Changing the principal address invalidates a proof from the previous origin",
  );

  proof = await begin("client", people.other.email);
  ok(
    !!proof.response.value.error && !proof.id,
    "A primary address owned by another account cannot be requested",
  );
  const contested = address("contested"),
    first = await begin("client", contested),
    second = await begin("other", contested);
  const collisions = await Promise.all([
    confirm("client", first),
    confirm("other", second),
  ]);
  const winner = await rowFor(contested);
  ok(
    collisions.filter((response) => response.value.success).length === 1 &&
      collisions.filter((response) => response.value.error).length === 1 &&
      [people.client.id, people.other.id].includes(winner?.user_id),
    "Concurrent confirmation cannot attach the same email to two users",
  );

  for (let i = 0; i < 3; i++)
    await db.query(
      "insert into console_account_emails(id,user_id,email,verified_at) values($1,$2,$3,now())",
      [randomUUID(), people.limit.id, address(`limit-${i}`)],
    );
  const fifthA = await begin("limit", address("fifth-a")),
    fifthB = await begin("limit", address("fifth-b"));
  const capped = await Promise.all([
    confirm("limit", fifthA),
    confirm("limit", fifthB),
  ]);
  ok(
    capped.filter((response) => response.value.success).length === 1 &&
      (
        await db.query(
          "select id from console_account_emails where user_id=$1",
          [people.limit.id],
        )
      ).rowCount === 5,
    "Concurrent proofs cannot exceed the five-email limit",
  );
  proof = await begin("limit", address("sixth"));
  ok(
    !!proof.response.value.error && !proof.id,
    "A sixth email is rejected before delivery",
  );

  const historyEmail = address("historical"),
    historyId = randomUUID();
  await db.query(
    "insert into console_account_emails(id,user_id,email,verified_at) values($1,$2,$3,now())",
    [historyId, people.client.id, historyEmail],
  );
  await db.query(
    "insert into console_memberships(id,company_id,email,role,active) values($1,$2,$3,'support',false)",
    [randomUUID(), companyId, historyEmail],
  );
  result = await action("removeAccountEmail", "client", { id: historyId });
  ok(
    !!result.value.error && !!(await rowFor(historyEmail)),
    "Historical membership identity remains protected after revocation",
  );
  await addSession("owner", "owner-second");
  const newOwner = address("owner-new");
  proof = await begin("owner", newOwner, true);
  result = await confirm("owner", proof);
  ok(
    !!result.value.success &&
      (
        await db.query("select email from console_user where id=$1", [
          people.owner.id,
        ])
      ).rows[0].email === newOwner,
    "Two proofs can change the principal email",
  );
  ok(
    (
      await db.query("select id from console_session where user_id=$1", [
        people.owner.id,
      ])
    ).rowCount === 0,
    "Principal email change revokes every existing session",
  );
  ok(
    (await rowFor(ownerEmail))?.user_id === people.owner.id &&
      !!(await rowFor(ownerEmail))?.verified_at &&
      (
        await db.query(
          "select id from console_memberships where email=$1 and active",
          [ownerEmail],
        )
      ).rowCount === 1,
    "Previous verified identity and company grants are retained",
  );
  ok(
    !(await api("/get-session", undefined, people.owner.cookie)).body?.user,
    "Old owner cookie no longer authenticates",
  );
  await limits();
  let before = messages().length;
  await api("/email-otp/send-verification-otp", {
    email: ownerEmail,
    type: "sign-in",
  });
  ok(
    messages().length === before,
    "A retained alias cannot create a second login identity",
  );
  await limits();
  await api("/email-otp/send-verification-otp", {
    email: newOwner,
    type: "sign-in",
  });
  const login = await api("/sign-in/email-otp", {
    email: newOwner,
    otp: messages().at(-1).code,
  });
  ok(
    login.status === 200 && login.body.user?.id === people.owner.id,
    "New principal signs into the original account",
  );
  people["owner-new"] = { ...people.owner, cookie: login.cookie };
  const ownerPage = await request("/configuracoes/membros", "owner-new");
  ok(
    ownerPage.status === 200 && ownerPage.text.includes("Convidar pessoa"),
    "Configured owner retains administration through the verified previous email",
  );
  result = await action("removeAccountEmail", "owner-new", {
    id: (await rowFor(ownerEmail)).id,
  });
  ok(
    !!result.value.error && !!(await rowFor(ownerEmail)),
    "Configured owner identity cannot be removed as an alias",
  );
  await db.query(
    "update console_session set created_at=now()-interval '11 minutes' where user_id=$1",
    [people.limit.id],
  );
  proof = await begin("limit", address("old-session"));
  ok(
    !!proof.response.value.error && !proof.id,
    "Email changes require a recent session",
  );
  const audits = (
    await db.query(
      "select action from console_audit_events where actor_id=any($1::text[])",
      [userIds],
    )
  ).rows;
  ok(
    audits.some((row) => row.action === "account.email.added") &&
      audits.some((row) => row.action === "account.email.primary_changed"),
    "Verified contact changes leave audit records",
  );
  console.log(
    `Concluído: ${count} verificações de contatos e provas de e-mail.`,
  );
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
