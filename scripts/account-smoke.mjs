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
  capture = join(dir, "otp.jsonl"),
  mail = join(dir, "mail.jsonl");
const manifest = JSON.parse(
  readFileSync(".next/server/server-reference-manifest.json", "utf8"),
);
const actionIds = Object.fromEntries(
  Object.entries(manifest.node)
    .filter(([, value]) => value.filename === "src/lib/account/account-actions.ts")
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
  if (name !== "owner")
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
        CONSOLE_TEST_MAIL_FILE: mail,
        RESEND_API_KEY: "test",
        EMAIL_FROM: "Console <test@example.invalid>",
        // The deletion code can go by WhatsApp; otp-mock.cjs answers for the FLW.
        FLW_SYNOVA: "test",
        FLW_SENDER_NUMBER: "5511000000000",
        FLW_OTP_TEMPLATE_ID: randomUUID(),
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

  const foreignEmail = address("foreign-environment");
  await db.query(
    "insert into console_staff_members(id,email,created_by) values($1,$2,$3)",
    [randomUUID(), foreignEmail, people.owner.id],
  );
  const foreignProof = await begin("client", foreignEmail);
  assert.ok(foreignProof.id, "Can prove ownership before access validation");
  const foreignResult = await confirm("client", foreignProof);
  ok(
    !!foreignResult.value.error && !(await rowFor(foreignEmail)),
    "Verified alias cannot combine client and console environments",
  );

  // Bundled avatars use the same authorization and transaction as uploads.
  const chosen = "/brand/avatars/marca-01.svg";
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
    "/brand/avatars/avatar-01.svg",
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
      /^\/brand\/avatars\/marca-\d{2}\.(svg|png)$/.test(
        JSON.parse(removed.text).image,
      ),
    "Removing a photo assigns a default avatar",
  );
  const freshEmail = address("invited-avatar");
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'member')",
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
      /^\/brand\/avatars\/marca-\d{2}\.(svg|png)$/.test(fresh.body.user?.image),
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
  ok(
    !actionIds.removeAccountEmail,
    "Email removal is not exposed as a public action",
  );
  const securityPage = await request("/configuracoes/seguranca", "client");
  ok(
    securityPage.status === 200 && securityPage.text.includes("Esta sessão"),
    "Member sees security settings and current session",
  );
  const tokens = (
    await db.query(
      "select token from console_session where user_id=any($1::text[])",
      [[people.client.id, people.other.id]],
    )
  ).rows;
  ok(
    tokens.every(({ token }) => !securityPage.text.includes(token)),
    "Security page never exposes session tokens",
  );
  ok(
    !securityPage.text.includes(people.other.sessionId),
    "Another account session is absent from security page",
  );
  const appearancePage = await request("/configuracoes/aparencia", "client");
  ok(
    appearancePage.status === 200 &&
      appearancePage.text.includes("Posição do menu"),
    "Member can open appearance settings",
  );
  const accountPage = await request("/conta", "client");
  ok(
    !accountPage.text.includes("Adicionar e-mail"),
    "Account offers replacement instead of additional emails",
  );
  ok(
    accountPage.status === 200 && accountPage.text.includes("nos últimos 12 meses") && accountPage.text.includes('role="grid"'),
    "Account shows the person's activity of the last 12 months",
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
      ).rowCount === 0,
    "Previous verified owner identity is retained without a client environment",
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
  await db.query(
    "update console_session set created_at=now()-interval '11 minutes' where user_id=$1",
    [people.limit.id],
  );
  proof = await begin("limit", address("old-session"));
  ok(
    !!proof.response.value.error && !proof.id,
    "Email changes require a recent session",
  );
  // Account deletion: a fresh code, the typed word, and the company keeps its records.
  await makePerson("leaver");
  await addSession("leaver", "leaver-second");
  const leaver = people.leaver,
    leaverAlias = address("leaver-alias"),
    leaverPhone = `+5511${String(Date.now()).slice(-9)}`,
    soloCompany = randomUUID();
  await db.query(
    "update console_user set phone_number=$2,phone_number_verified=true,image='/brand/avatars/marca-02.svg' where id=$1",
    [leaver.id, leaverPhone],
  );
  // Two-step on: the contacts trigger must not block the deletion.
  await db.query("update console_user set two_factor_enabled=true where id=$1", [leaver.id]);
  await db.query(
    "insert into console_account_emails(id,user_id,email,verified_at) values(gen_random_uuid(),$1,$2,now())",
    [leaver.id, leaverAlias],
  );
  await db.query(
    "insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)",
    [soloCompany, `Solo QA ${marker}`, marker.replaceAll("-", "").slice(-14), address("solo")],
  );
  // One environment per account: the leaver manages only the solo company, through the alias.
  await db.query("delete from console_memberships where email=$1", [leaver.email]);
  await db.query(
    "insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'manager')",
    [randomUUID(), soloCompany, leaverAlias],
  );
  const conversation = randomUUID(),
    privateFolder = randomUUID(),
    sharedFolder = randomUUID();
  await db.query(
    "insert into console_assistant_conversations(id,user_id,title) values($1,$2,'QA')",
    [conversation, leaver.id],
  );
  await db.query(
    "insert into console_assistant_messages(id,conversation_id,role,content) values(gen_random_uuid(),$1,'user','oi')",
    [conversation],
  );
  for (const [folder, name] of [[privateFolder, "private"], [sharedFolder, "shared"]])
    await db.query(
      "insert into console_bookmark_folders(id,company_id,owner_id,name,visibility) values($1,$2,$3,$4,'people')",
      [folder, soloCompany, leaver.id, `QA ${name} ${marker}`],
    );
  await db.query(
    "insert into console_bookmark_folder_shares(folder_id,user_id) values($1,$2)",
    [sharedFolder, people.owner.id],
  );
  await db.query(
    "insert into console_bookmarks(id,company_id,author_id,folder_id,title,url) values(gen_random_uuid(),$1,$2,$3,'QA private','https://example.invalid'),(gen_random_uuid(),$1,$2,$4,'QA shared','https://example.invalid')",
    [soloCompany, leaver.id, privateFolder, sharedFolder],
  );
  await db.query(
    "insert into console_audit_events(id,actor_id,action,entity_id) values(gen_random_uuid(),$1,'qa.history',$1)",
    [leaver.id],
  );
  const pendingDeletion = (challengeId) =>
    db.query("select id from console_verification where identifier=$1", [
      `account-deletion:${challengeId}`,
    ]);
  await limits();
  const ownerDeletion = await action("requestAccountDeletion", "owner-new", {
    channel: "email",
  });
  ok(
    !!ownerDeletion.value.error && !ownerDeletion.value.challengeId,
    "The Console owner cannot delete the account",
  );
  const anonymousDeletion = await action("requestAccountDeletion", null, {
    channel: "email",
  });
  ok(
    !!anonymousDeletion.value.error && !anonymousDeletion.value.challengeId,
    "Account deletion requires a session",
  );
  await limits();
  const noPhone = await action("requestAccountDeletion", "other", {
    channel: "whatsapp",
  });
  ok(
    !!noPhone.value.error && !noPhone.value.challengeId,
    "A WhatsApp code needs a verified number",
  );
  await limits();
  before = messages().length;
  const byWhatsapp = await action("requestAccountDeletion", "leaver", {
    channel: "whatsapp",
  });
  ok(
    !!byWhatsapp.value.challengeId &&
      byWhatsapp.value.destination.endsWith(leaverPhone.slice(-4)) &&
      messages().slice(before).some((m) => m.to === leaverPhone && m.code),
    "Deletion code goes to the verified WhatsApp",
  );
  await limits();
  before = messages().length;
  const deletion = await action("requestAccountDeletion", "leaver", {
    channel: "email",
  });
  const deletionCode = messages()
    .slice(before)
    .find((m) => m.to === leaver.email)?.code;
  ok(
    !!deletion.value.challengeId &&
      !!deletionCode &&
      (await pendingDeletion(byWhatsapp.value.challengeId)).rowCount === 0,
    "A new deletion code replaces the previous one",
  );
  const wrongCode = deletionCode === "000000" ? "111111" : "000000";
  const attempt = (who, values) =>
    action("confirmAccountDeletion", who, {
      challengeId: deletion.value.challengeId,
      code: deletionCode,
      confirmation: "EXCLUIR",
      ...values,
    });
  ok(
    !!(await attempt("leaver", { confirmation: "apagar" })).value.error,
    "Deletion requires the typed word",
  );
  ok(
    !!(await attempt("leaver", { code: wrongCode })).value.error,
    "Deletion refuses a wrong code",
  );
  ok(
    !!(await attempt("leaver-second", {})).value.error &&
      !!(await attempt("other", {})).value.error,
    "A deletion code works only in the session that asked for it",
  );
  before = messages().length;
  const deleted = await attempt("leaver", { confirmation: " excluir " });
  ok(
    deleted.value.success && deleted.value.href === "/entrar?conta=excluida",
    "Person deletes the account with the code and the word",
  );
  const [gone] = (
    await db.query("select * from console_user where id=$1", [leaver.id])
  ).rows;
  ok(
    gone.name === "Conta excluída" &&
      gone.email === `excluida+${leaver.id}@invalid` &&
      !gone.email_verified &&
      gone.phone_number === null &&
      gone.image === null,
    "Deleted account keeps no name, e-mail, phone or photo",
  );
  const total = async (query, values) =>
    Number((await db.query(query, values)).rows[0].count);
  ok(
    (await total("select count(*) from console_session where user_id=$1", [leaver.id])) === 0 &&
      (await total(
        "select count(*) from console_account_emails where user_id=$1 and (verified_at is not null or email<>$2)",
        [leaver.id, `excluida+${leaver.id}@invalid`],
      )) === 0 &&
      (await total(
        "select count(*) from console_memberships where email=any($1::text[]) and active",
        [[leaver.email, leaverAlias]],
      )) === 0,
    "Deletion ends every session, address and access",
  );
  ok(
    (await total("select count(*) from console_assistant_conversations where user_id=$1", [leaver.id])) === 0 &&
      (await total("select count(*) from console_assistant_messages where conversation_id=$1", [conversation])) === 0 &&
      (await total("select count(*) from console_bookmark_folders where id=$1", [privateFolder])) === 0 &&
      (await total("select count(*) from console_bookmarks where folder_id=$1", [sharedFolder])) === 1,
    "Personal content goes; what was shared stays with the company",
  );
  ok(
    (await total(
      "select count(*) from console_audit_events where actor_id=$1 and action in ('qa.history','account.deleted')",
      [leaver.id],
    )) === 2,
    "The history stays and records the deletion",
  );
  const sent = readFileSync(mail, "utf8").trim().split("\n").map(JSON.parse);
  ok(
    sent.some((m) => m.to === leaver.email && /excluída/.test(m.subject || "")) &&
      sent.some((m) => m.to === ownerEmail && /sem Administrador/.test(m.subject || "")),
    "Deletion confirms by e-mail and warns the team about a company left without a manager",
  );
  ok(
    (await request("/conta", "leaver")).status !== 200,
    "The old session no longer opens the Console",
  );
  await limits();
  before = messages().length;
  await api("/email-otp/send-verification-otp", {
    email: leaver.email,
    type: "sign-in",
  });
  ok(
    messages().length === before,
    "A deleted account's address no longer receives sign-in codes",
  );
  await db.query("delete from console_bookmarks where folder_id=$1", [sharedFolder]);
  await db.query("delete from console_bookmark_folder_shares where folder_id=$1", [sharedFolder]);
  await db.query("delete from console_bookmark_folders where id=$1", [sharedFolder]);
  await db.query("delete from console_memberships where company_id=$1", [soloCompany]);
  await db.query("delete from console_companies where id=$1", [soloCompany]);
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
    await db.query(
      "delete from console_staff_members where created_by=any($1::text[])",
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
