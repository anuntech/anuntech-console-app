// Push to the native app (lib/notifications/push-*.ts), end to end against
// the Expo mock (scripts/push-mock.cjs): who gets each push, who never does,
// DeviceNotRegistered and the receipts. Called from api-smoke.mjs with what
// it already has in scope; creates its own company, people and phones and
// removes them at the end.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * @param {{
 *   db: import("pg").Pool,
 *   rpc: (path: string, input: unknown, cookie?: string, headers?: Record<string, string>) => Promise<{ status: number, body: any }>,
 *   ok: (condition: unknown, message: string) => void,
 *   marker: string,
 *   emailSignIn: (email: string) => Promise<{ status: number, body: any, cookie: string }>,
 *   staff: string,
 *   base: string,
 *   pushFile: string,
 *   cronSecret: string,
 * }} ctx
 */
export async function pushChecks({ db, rpc, ok, marker, emailSignIn, staff, base, pushFile, cronSecret }) {
  const address = (name) => `api-push-${name}-${marker}@example.invalid`;
  const company = randomUUID();
  const engagements = { seen: randomUUID(), hidden: randomUUID() };
  const people = {};
  const userIds = [];
  const ticketId = randomUUID();
  const contractId = randomUUID();
  const token = (name) => `ExponentPushToken[push${name}${marker.slice(0, 12)}]`;
  const goneToken = `ExponentPushToken[NotRegistered${marker.slice(0, 12)}]`;
  const pushes = () => {
    try {
      return readFileSync(pushFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
    } catch {
      return [];
    }
  };
  const sentTo = (value, url) => pushes().filter((p) => p.kind === "send" && p.to === value && (!url || p.url === url));
  const wait = async (condition, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await condition()) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  };
  const rows = async (entityId) =>
    (
      await db.query(
        "select n.*, d.token from console_push_notices n join console_push_devices d on d.id=n.device_id where n.entity_id=$1",
        [entityId],
      )
    ).rows;
  async function person(name, role, access = "all") {
    const id = randomUUID(),
      email = address(name),
      membership = randomUUID();
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Push ${name}`, email]);
    userIds.push(id);
    await db.query(
      "insert into console_memberships(id,company_id,email,role,engagement_access) values($1,$2,$3,$4,$5)",
      [membership, company, email, role, access],
    );
    const session = (await emailSignIn(email)).cookie;
    people[name] = { id, email, membership, session };
    const r = await rpc("devices.register", { token: token(name), platform: "ios", appVersion: "1.0.0" }, session);
    if (r.status !== 200) throw Error(`Phone of ${name} not registered (${r.status})`);
  }
  // A server action posted the way a page posts it (scripts/contract-signing-smoke.mjs).
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  const action = async (page, cookie, name, values) => {
    const found = Object.entries(manifest).filter(([, entry]) => entry.exportedName === name);
    if (found.length !== 1) throw Error(`Action ${name} not found in the build`);
    const body = new FormData();
    for (const [key, value] of Object.entries(values)) body.append(`_1_${key}`, value);
    body.set("0", JSON.stringify([null, "$K1"]));
    const response = await fetch(`${base}${page}`, {
      method: "POST",
      body,
      headers: { Cookie: cookie, Origin: base, "Next-Action": found[0][0], Accept: "text/x-component" },
    });
    return { status: response.status, text: await response.text() };
  };

  try {
    await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
      company,
      `API push ${marker}`,
      (randomUUID().replace(/\D/g, "") + "48201937465012").slice(0, 14),
      address("billing"),
    ]);
    await db.query(
      "insert into console_engagements(id,company_id,name,kind) values($1,$2,'Produto visto','product'),($3,$2,'Produto restrito','product')",
      [engagements.seen, company, engagements.hidden],
    );
    await person("boss", "manager");
    await person("opener", "member");
    await person("narrow", "member", "selected");
    await db.query("insert into console_membership_engagements(membership_id,engagement_id) values($1,$2)", [
      people.narrow.membership,
      engagements.seen,
    ]);
    // The team's own phone, and the team as a member of the client: still never pushed.
    const me = await rpc("me.get", undefined, staff);
    const staffEmail = me.body?.email;
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'manager')", [
      randomUUID(),
      company,
      staffEmail,
    ]);
    await rpc("devices.register", { token: token("staff"), platform: "android" }, staff);

    // A team reply on a ticket of the restricted product, opened by a Membro.
    await db.query(
      "insert into console_tickets(id,company_id,engagement_id,subject,author_id,kind) values($1,$2,$3,$4,$5,'question')",
      [ticketId, company, engagements.hidden, `Push ${marker}`, people.opener.id],
    );
    let r = await rpc("tickets.reply", { id: ticketId, body: "Resposta da equipe." }, staff);
    ok(r.status === 200, "The team replies on the ticket from the app's API");
    const url = `/chamados/${ticketId}`;
    ok(
      await wait(() => sentTo(token("opener"), url).length === 1 && sentTo(token("boss"), url).length === 1),
      "A team reply pushes the client's phones (the opener and the Administrador)",
    );
    const reply = sentTo(token("opener"), url)[0];
    ok(
      reply.title === "Anuntech Console" && reply.body === "Nova resposta no chamado",
      "The lock screen shows only the minimal text, without subject or company",
    );
    ok(
      sentTo(token("staff"), url).length === 0,
      "The team member who replied gets no push",
    );
    ok(
      sentTo(token("narrow"), url).length === 0 && !(await rows(ticketId)).some((row) => row.user_id === people.narrow.id),
      "A Membro outside the ticket's product gets no push",
    );
    ok(
      await wait(async () => {
        const saved = await rows(ticketId);
        return saved.length === 2 && saved.every((row) => row.status === "accepted" && row.provider_id && row.attempts === 1);
      }),
      "Each push records the attempt and Expo's ticket",
    );
    // A client's own reply pushes nobody.
    const before = pushes().length;
    r = await rpc("tickets.reply", { id: ticketId, body: "Resposta do cliente." }, people.opener.session);
    ok(r.status === 200, "The client answers from the app");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    ok(pushes().length === before, "A client's reply sends no push");

    // A contract sent for signature: the Administradores only. The Administrador
    // also has a second phone, where the app was uninstalled.
    await rpc("devices.register", { token: goneToken, platform: "android" }, people.boss.session);
    await db.query(
      "insert into console_contracts(id,company_id,title,body,author_id) values($1,$2,$3,'Texto do contrato.',$4)",
      [contractId, company, `Contrato push ${marker}`, people.boss.id],
    );
    r = await action(`/contratos/${contractId}`, staff, "sendContract", { id: contractId });
    ok(
      r.status === 200 && (await db.query("select status from console_contracts where id=$1", [contractId])).rows[0]?.status === "sent",
      "The team sends the contract",
    );
    const contractUrl = `/contratos/${contractId}`;
    ok(
      await wait(() => sentTo(token("boss"), contractUrl).length === 1),
      "A contract sent pushes the Administrador",
    );
    ok(sentTo(token("boss"), contractUrl)[0].body === "Contrato para assinar", "The contract push reads Contrato para assinar");
    ok(
      sentTo(token("opener"), contractUrl).length === 0 &&
        sentTo(token("narrow"), contractUrl).length === 0 &&
        sentTo(token("staff"), contractUrl).length === 0,
      "Membros and the team get no contract push",
    );
    ok(
      await wait(async () => {
        const gone = (await rows(contractId)).find((row) => row.token === goneToken);
        const phone = (await db.query("select disabled_at from console_push_devices where token=$1", [goneToken])).rows[0];
        return gone?.status === "failed" && gone.provider_status === "DeviceNotRegistered" && !!phone?.disabled_at;
      }),
      "DeviceNotRegistered fails the push and disables the phone",
    );

    // Receipts, 15 minutes later (moved back in time here), once every push of the contract is saved.
    await wait(async () => (await rows(contractId)).every((row) => !["pending", "sending"].includes(row.status)));
    await db.query(
      "update console_push_notices set updated_at=now()-interval '20 minutes' where company_id=$1 and status='accepted'",
      [company],
    );
    const cron = await fetch(`${base}/api/cron/ticket-notifications`, { headers: { Authorization: `Bearer ${cronSecret}` } });
    ok(cron.status === 200, "The ticket-notifications cron runs the push queue");
    const all = (await db.query("select * from console_push_notices where company_id=$1", [company])).rows;
    ok(
      all.filter((row) => row.provider_id).length > 0 &&
        all.filter((row) => row.provider_id).every((row) => row.status === "delivered" && row.receipt_checked_at),
      "Expo's receipts mark the pushes delivered",
    );
    ok(
      pushes().some((p) => p.kind === "receipts" && all.some((row) => p.ids.includes(row.provider_id))),
      "The receipts are asked by Expo's ticket ids",
    );
  } finally {
    for (const [statement, values] of [
      ["delete from console_push_notices where company_id=$1", [company]],
      ["delete from console_ticket_notices where ticket_id=$1", [ticketId]],
      ["delete from console_messages where ticket_id=$1", [ticketId]],
      ["delete from console_tickets where id=$1", [ticketId]],
      ["delete from console_contract_versions where contract_id=$1", [contractId]],
      ["delete from console_contracts where id=$1", [contractId]],
      ["delete from console_audit_events where company_id=$1 or actor_id=any($2::text[])", [company, userIds]],
      ["delete from console_automation_events where company_id=$1", [company]],
      ["delete from console_membership_engagements where engagement_id=any($1::text[])", [Object.values(engagements)]],
      ["delete from console_memberships where company_id=$1", [company]],
      ["delete from console_engagements where company_id=$1", [company]],
      ["delete from console_push_devices where user_id=any($1::text[]) or token=$2", [userIds, token("staff")]],
      ["delete from console_session where user_id=any($1::text[])", [userIds]],
      ["delete from console_user where id=any($1::text[])", [userIds]],
      ["delete from console_companies where id=$1", [company]],
    ])
      await db.query(statement, values).catch((error) => console.warn("push cleanup:", error.message));
  }
}
