// Frente 8 of the native app (Conta, notificações e assistente): the
// Histórico de envios of Configurações → Notificações (notifications.history)
// and dictation through /api/v1/transcricao, with the web's rules. Called
// from api-smoke.mjs with what it already has in scope; creates its own
// companies, people, tickets, invoices and notices and removes them at the end.
import { createHmac, randomUUID } from "node:crypto";

/**
 * @param {{
 *   db: import("pg").Pool,
 *   rpc: (path: string, input: unknown, cookie?: string, headers?: Record<string, string>) => Promise<{ status: number, body: any }>,
 *   ok: (condition: unknown, message: string) => void,
 *   marker: string,
 *   emailSignIn: (email: string) => Promise<{ status: number, body: any, cookie: string }>,
 *   staff: string,
 *   base: string,
 * }} ctx
 */
export async function f8Checks({ db, rpc, ok, marker, emailSignIn, staff, base }) {
  const address = (name) => `api-f8-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "48213905716254").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID(), second: randomUUID() };
  const people = {};
  const userIds = [];
  const tickets = { own: randomUUID(), other: randomUUID() };
  const invoices = { own: randomUUID(), other: randomUUID() };
  async function person(name, grants) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `F8 ${name}`, email]);
    userIds.push(id);
    for (const [company, role] of grants)
      await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email };
  }
  async function ticketNotice(ticket, company, { channel, destination, status, error = null, minutesAgo, preference = `${company}:tickets` }) {
    const event = randomUUID();
    await db.query(
      "insert into console_audit_events(id,actor_id,company_id,action,entity_id,created_at) values($1,$2,$3,'ticket.created',$4,now())",
      [event, people.admin.id, company, ticket],
    );
    const id = randomUUID();
    await db.query(
      `insert into console_ticket_notices(id,event_id,ticket_id,channel,preference_key,destination,payload,status,error,created_at)
       values($1,$2,$3,$4,$5,$6,'{}'::jsonb,$7,$8,now()-make_interval(mins=>$9))`,
      [id, event, ticket, channel, preference, destination, status, error, minutesAgo],
    );
    return id;
  }
  const audio = (prefix = "") => Buffer.concat([Buffer.from(prefix, "latin1"), Buffer.alloc(3000, 7)]);
  const speak = (cookie, body, type = "audio/wav", headers = {}) =>
    fetch(`${base}/api/v1/transcricao`, {
      method: "POST",
      headers: { "Content-Type": type, ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body,
    }).then(async (response) => ({
      status: response.status,
      body: await response.json().catch(() => null),
      cache: response.headers.get("cache-control"),
    }));

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API f8 ${key} ${marker}`,
        cnpj(),
        address(`billing-${key}`),
      ]);
    await person("admin", [[companies.own, "manager"]]);
    await person("membro", [[companies.own, "member"]]);
    await person("elsewhere", [[companies.other, "manager"]]);
    await person("both", [
      [companies.own, "manager"],
      [companies.second, "manager"],
    ]);
    await person("nobody", []);
    for (const key of ["own", "other"]) {
      const company = companies[key];
      await db.query("insert into console_tickets(id,company_id,subject,author_id) values($1,$2,$3,$4)", [
        tickets[key],
        company,
        `Formulário ${key} ${marker}`,
        people.admin.id,
      ]);
      await db.query(
        "insert into console_invoices(id,company_id,description,amount_cents,due_date,status) values($1,$2,$3,15000,current_date,'issued')",
        [invoices[key], company, `Mensalidade ${key} ${marker}`],
      );
    }
    const delivered = await ticketNotice(tickets.own, companies.own, { channel: "whatsapp", destination: "5511987650002", status: "delivered", minutesAgo: 30 });
    const failedNotice = await ticketNotice(tickets.own, companies.own, {
      channel: "email",
      destination: address("contato"),
      status: "failed",
      error: "Caixa de entrada cheia.",
      minutesAgo: 20,
    });
    // Another company's notice and the team's own never show.
    await ticketNotice(tickets.other, companies.other, { channel: "email", destination: address("alheio"), status: "sent", minutesAgo: 5 });
    await ticketNotice(tickets.own, companies.own, { channel: "email", destination: address("equipe"), status: "sent", minutesAgo: 4, preference: "console:tickets" });
    const billing = randomUUID();
    await db.query(
      "insert into console_billing_notices(id,invoice_id,actor_id,channel,recipient,kind,status,created_at) values($1,$2,$3,'email',$4,'initial','accepted',now()-interval '10 minutes')",
      [billing, invoices.own, people.admin.id, address("financeiro")],
    );
    await db.query(
      "insert into console_billing_notices(id,invoice_id,actor_id,channel,recipient,kind,status) values($1,$2,$3,'email',$4,'initial','delivered')",
      [randomUUID(), invoices.other, people.elsewhere.id, address("financeiro-alheio")],
    );

    const admin = (await emailSignIn(people.admin.email)).cookie;
    const membro = (await emailSignIn(people.membro.email)).cookie;
    const both = (await emailSignIn(people.both.email)).cookie;
    const nobody = (await emailSignIn(people.nobody.email)).cookie;

    // Histórico de envios: the web's rows, for the Administrador of exactly one company.
    let r = await rpc("notifications.history", { page: 1 }, admin);
    const rows = r.body?.rows ?? [];
    ok(
      r.status === 200 && r.body.total === 3 && r.body.page === 1 && r.body.pageCount === 1 && rows.map((row) => row.id).join() === [billing, failedNotice, delivered].join(),
      "The history lists the company's ticket and billing notices, newest first",
    );
    const [money, failed, whatsapp] = rows;
    ok(
      money?.kind === "invoice" && money.recordId === invoices.own && money.actionLabel === "Financeiro" && money.statusLabel === "Aceito pelo provedor" && money.tone === "info",
      "A billing notice points at its invoice, named as on the web",
    );
    ok(
      failed?.kind === "ticket" && failed.recordId === tickets.own && failed.statusLabel === "Falhou" && failed.tone === "danger" && failed.error === "Caixa de entrada cheia." && failed.actionLabel === "Chamado aberto",
      "A failed notice says why, with the ticket it is about",
    );
    ok(whatsapp?.channel === "whatsapp" && whatsapp.recipient === "(11) 98765-0002" && whatsapp.statusLabel === "Entregue", "A WhatsApp number reads as the web shows it");
    ok(!JSON.stringify(rows).includes("alheio") && !JSON.stringify(rows).includes(address("equipe")), "Another company's and the team's notices stay out");
    r = await rpc("notifications.history", { page: 99 }, admin);
    ok(r.status === 200 && r.body.page === 1 && r.body.rows.length === 3, "A page past the end answers the last one, as the web");
    ok((await rpc("notifications.history", { page: 0 }, admin)).status === 400, "A page below 1 is refused");
    ok((await rpc("notifications.history", { page: 1 }, membro)).status === 404, "A Membro does not see the history");
    ok((await rpc("notifications.history", { page: 1 }, both)).status === 404, "Someone managing two companies does not either, as settingsEnvironment");
    ok((await rpc("notifications.history", { page: 1 }, staff)).status === 404, "The team keeps the history on the web");
    ok((await rpc("notifications.history", { page: 1 })).status === 401, "Without a session there is no history");

    // Dictation: the same rules as the web's /api/transcricao, with the app's session.
    let s = await speak(admin, audio());
    ok(s.status === 200 && s.body?.text === "Texto ditado de teste" && s.cache?.includes("no-store"), "The app dictates and gets the text back");
    s = await speak(membro, audio());
    ok(s.status === 200 && s.body?.text === "Texto ditado de teste", "A Membro dictates too (support area)");
    ok((await speak(nobody, audio())).status === 403, "An account without a company does not dictate");
    ok((await speak(undefined, audio())).status === 401, "Without a session there is no dictation");
    ok((await speak(admin, audio(), "audio/wav", { "Sec-Fetch-Site": "cross-site" })).status === 403, "A browser on another site cannot use it");
    ok((await speak(admin, audio(), "text/plain")).status === 415, "Only audio formats are taken");
    ok((await speak(admin, Buffer.alloc(4_000_001, 1))).status === 413, "Audio over the limit is refused");
    ok((await speak(admin, Buffer.alloc(100, 1))).status === 400, "Empty audio is refused");
    s = await speak(admin, audio("SILENCE"));
    ok(s.status === 422 && s.body?.error?.includes("Não deu para entender"), "Silence comes back as a notice, without text");
    if (process.env.BETTER_AUTH_SECRET) {
      const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(`voice:${people.admin.id}`).digest("hex");
      await db.query("update console_otp_limits set count=30, window_start=now() where key=$1", [key]);
      s = await speak(admin, audio());
      ok(s.status === 429 && s.body?.error?.includes("muitas vezes"), "The app shares the web's 30 an hour");
    }
  } finally {
    const ids = Object.values(companies);
    for (const [statement, values] of [
      ["delete from console_ticket_notices where ticket_id=any($1::text[])", [Object.values(tickets)]],
      ["delete from console_billing_notices where invoice_id=any($1::text[])", [Object.values(invoices)]],
      ["delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [ids, userIds]],
      ["delete from console_tickets where id=any($1::text[])", [Object.values(tickets)]],
      ["delete from console_invoices where id=any($1::text[])", [Object.values(invoices)]],
      ["delete from console_user_milestones where user_id=any($1::text[])", [userIds]],
      ["delete from console_session where user_id=any($1::text[])", [userIds]],
      ["delete from console_account where user_id=any($1::text[])", [userIds]],
      ["delete from console_memberships where company_id=any($1::text[])", [ids]],
      ["delete from console_memberships where email=any($1::text[])", [Object.values(people).map((p) => p.email)]],
      ["delete from console_companies where id=any($1::text[])", [ids]],
      ["delete from console_user where id=any($1::text[])", [userIds]],
    ])
      await db.query(statement, values).catch((error) => console.warn("cleanup", statement, error.message));
  }
}
