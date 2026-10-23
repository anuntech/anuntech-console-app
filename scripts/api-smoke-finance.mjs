// Financeiro in the native app (finance.list and finance.get): the web's
// /financeiro and /financeiro/[id] for a client's Administrador, through
// /api/v1. Search, period, recurrence, days overdue, Próximas cobranças, the
// payer, terms, fiscal card and the boleto PDF by the session route. Called
// from api-smoke.mjs; creates its own companies, people and invoices and
// removes them at the end. Nothing here talks to the bank.
import { randomUUID } from "node:crypto";

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
export async function financeChecks({ db, rpc, ok, marker, emailSignIn, staff, base }) {
  const address = (name) => `api-finance-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "41827364519203").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const documents = { own: cnpj(), other: cnpj() };
  const userIds = [];
  const people = {};
  const invoiceIds = [];
  const subscriptionIds = [];
  // Today's civil date in São Paulo, as the Console counts it (lib/dates.ts).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const shift = (day, days) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Finance ${name}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email, session: (await emailSignIn(email)).cookie };
  }
  const columns = [
    "id", "company_id", "subscription_id", "description", "amount_cents", "due_date", "bank_due_date", "status",
    "public_id", "public_enabled", "provider_id", "pix_copy_paste", "boleto_line", "discount_cents", "fine_bps",
    "interest_monthly_bps", "fiscal_status", "fiscal_url", "bank_checked_at",
  ];
  async function invoice(values) {
    const row = { id: randomUUID(), public_enabled: false, fiscal_status: "not_requested", amount_cents: 10000, ...values };
    await db.query(
      `insert into console_invoices(${columns.join(",")}) values(${columns.map((_, i) => `$${i + 1}`).join(",")})`,
      columns.map((c) => row[c] ?? null),
    );
    invoiceIds.push(row.id);
    return row.id;
  }
  const boleto = (id, cookie) =>
    fetch(`${base}/api/boletos/${id}`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API finance ${key} ${marker}`,
        documents[key],
        address(`billing-${key}`),
      ]);
    await person("admin", companies.own, "manager");
    await person("member", companies.own, "member");
    await person("outsider", companies.other, "manager");

    const sub = randomUUID();
    const nextDue = shift(today, 20);
    await db.query(
      "insert into console_subscriptions(id,company_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,lead_days,status,actor_id) values($1,$2,$3,9900,'monthly',$4,$5,$6,5,'active',$7)",
      [sub, companies.own, `Mensalidade ${marker}`, Number(nextDue.slice(8)), Number(nextDue.slice(5, 7)), nextDue, people.admin.id],
    );
    subscriptionIds.push(sub);
    const publicId = "f".repeat(31) + marker.replaceAll("-", "").slice(0, 12);
    const overdue = await invoice({
      company_id: companies.own,
      subscription_id: sub,
      description: `Mensalidade janeiro ${marker}`,
      due_date: "2020-01-10",
      bank_due_date: "2099-01-20",
      status: "issued",
      provider_id: `inter-${marker}-1`,
      pix_copy_paste: "00020126PIXFINANCE",
      boleto_line: "23790.00000 00000.000000 00000.000000 0 00000000000000",
      discount_cents: 500,
      fine_bps: 200,
      interest_monthly_bps: 100,
    });
    const paid = await invoice({
      company_id: companies.own,
      subscription_id: sub,
      description: `Mensalidade fevereiro ${marker}`,
      due_date: "2020-02-10",
      status: "paid",
      provider_id: `inter-${marker}-2`,
      fiscal_status: "authorized",
      fiscal_url: "https://nfe.example.invalid/nota",
      bank_checked_at: new Date().toISOString(),
      discount_cents: 500,
    });
    const processing = await invoice({
      company_id: companies.own,
      description: `Hospedagem ${marker}`,
      due_date: today,
      status: "issued",
      public_id: publicId,
      public_enabled: true,
      provider_id: `inter-${marker}-3`,
    });
    const draft = await invoice({ company_id: companies.own, description: `Rascunho ${marker}`, due_date: today, status: "draft" });
    const otherIssued = await invoice({ company_id: companies.other, description: `Outra ${marker}`, due_date: today, status: "issued" });

    // The list: rows, totals with counts, recurrence, days overdue and the next charges.
    let r = await rpc("finance.list", {}, people.admin.session);
    const rowOf = (id) => r.body?.rows?.find((row) => row.id === id);
    ok(
      r.status === 200 &&
        r.body.rows.length === 3 &&
        !rowOf(draft) &&
        !rowOf(otherIssued) &&
        r.body.totals.all.count === 3 &&
        r.body.totals.issued.count === 1 &&
        r.body.totals.overdue.count === 1 &&
        r.body.totals.paid.count === 1 &&
        r.body.totals.paid.cents === 10000,
      "Financeiro lists the company's invoices with each situation's count, Pagas included",
    );
    ok(
      rowOf(overdue)?.daysOverdue > 2000 &&
        rowOf(overdue).interval === "monthly" &&
        rowOf(overdue).bankDueDate === "2099-01-20" &&
        rowOf(processing)?.interval === null &&
        rowOf(processing).daysOverdue === 0,
      "A row says how many days late it is and its recurrence",
    );
    const upcoming = r.body.upcoming.find((c) => c.subscriptionId === sub);
    ok(
      r.body.upcoming.length === 1 &&
        upcoming?.dueDate === nextDue &&
        upcoming.issueDate === shift(nextDue, -5) &&
        upcoming.amountCents === 9900 &&
        [overdue, paid].includes(upcoming.invoiceId),
      "Próximas cobranças brings the recurrence's next charge and when the boleto arrives",
    );
    r = await rpc("finance.list", { search: `hospedagem ${marker}` }, people.admin.session);
    ok(
      r.status === 200 && r.body.rows.length === 1 && rowOf(processing) && r.body.upcoming.length === 0 && r.body.totals.all.count === 1,
      "The search finds by description and hides the next charges, like the web",
    );
    r = await rpc("finance.list", { search: `API finance own ${marker}` }, people.admin.session);
    ok(r.status === 200 && r.body.rows.length === 3, "The search also finds by the company's name");
    r = await rpc("finance.list", { search: `Outra ${marker}` }, people.admin.session);
    ok(r.status === 200 && r.body.rows.length === 0, "The search never reaches another company's invoices");
    r = await rpc("finance.list", { period: "this_month" }, people.admin.session);
    ok(r.status === 200 && r.body.rows.length === 1 && rowOf(processing) && r.body.totals.overdue.count === 0, "Este mês keeps only the month's due dates, totals included");
    r = await rpc("finance.list", { period: "last_month" }, people.admin.session);
    ok(r.status === 200 && r.body.rows.length === 0, "Mês passado leaves out this month and 2020");
    r = await rpc("finance.list", { period: "next_30", status: "overdue" }, people.admin.session);
    ok(r.status === 200 && r.body.rows.length === 0, "Period and situation combine");
    // "Personalizado" (custom + from/to) is checked in api-smoke-lac3.mjs.
    ok((await rpc("finance.list", { period: "next_year" }, people.admin.session)).status === 400, "Only the web's periods are accepted");

    // Who sees it: a Membro nothing, another company 404.
    r = await rpc("finance.list", {}, people.member.session);
    ok(r.status === 200 && r.body.rows.length === 0 && r.body.upcoming.length === 0, "A Membro sees no invoices nor next charges");
    ok((await rpc("finance.get", { id: overdue }, people.member.session)).status === 404, "A Membro opens no invoice");
    r = await rpc("finance.list", {}, people.outsider.session);
    ok(
      r.status === 200 && !r.body.rows.some((row) => row.id === overdue) && !r.body.upcoming.some((c) => c.subscriptionId === sub),
      "Another company's Administrador sees none of it",
    );
    ok((await rpc("finance.get", { id: overdue }, people.outsider.session)).status === 404, "Another company's invoice answers 404");
    ok((await rpc("finance.get", { id: draft }, people.admin.session)).status === 404, "A draft answers 404 to the client");
    r = await rpc("finance.list", {}, staff);
    ok(r.status === 200 && r.body.upcoming.length === 0, "The team gets no client's next charges in the app");

    // The detail: what the web's invoice page shows the client.
    r = await rpc("finance.get", { id: overdue }, people.admin.session);
    const d = r.body;
    ok(
      r.status === 200 &&
        d.display === "overdue" &&
        d.daysOverdue > 2000 &&
        d.bankDueDate === "2099-01-20" &&
        d.payer.name === `API finance own ${marker}` &&
        /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(d.payer.document) &&
        !!d.createdAt &&
        d.processing === false,
      "The invoice brings days overdue, the boleto's date and the payer with CNPJ",
    );
    ok(
      d.terms?.discountCents === 500 && d.terms.onTimeCents === 9500 && d.terms.lateFees === "multa de 2% e juros de 1% ao mês",
      "The terms say the discount, the on-time amount and the late fees",
    );
    ok(
      d.recurrence?.interval === "monthly" && d.recurrence.ahead?.id === paid && d.recurrence.ahead.status === "paid" && d.recurrence.next === null,
      "The recurrence points at the later period already at the bank",
    );
    ok(d.fiscal === null, "No fiscal card while the invoice is open and nothing was requested");
    ok(
      d.payPath === null && d.payUrl === null && d.boletoPath === `/api/boletos/${overdue}` && d.pix === "00020126PIXFINANCE",
      "Without the public link the boleto PDF comes by the session route",
    );
    r = await rpc("finance.get", { id: paid }, people.admin.session);
    ok(
      r.status === 200 &&
        r.body.fiscal?.status === "authorized" &&
        r.body.fiscal.url === "https://nfe.example.invalid/nota" &&
        r.body.terms === null &&
        r.body.pix === null &&
        r.body.boletoPath === null &&
        !!r.body.bankCheckedAt &&
        r.body.recurrence?.ahead === null &&
        r.body.recurrence.next?.dueDate === nextDue &&
        r.body.recurrence.next.onPayment === false,
      "A paid invoice shows the fiscal note and the last check, without terms or codes",
    );
    r = await rpc("finance.get", { id: processing }, people.admin.session);
    ok(
      r.status === 200 &&
        r.body.processing === true &&
        r.body.boletoPath === null &&
        r.body.recurrence === null &&
        r.body.payPath === `/pagar/${publicId}` &&
        /^https?:\/\/[^/]+\/pagar\//.test(r.body.payUrl ?? "") &&
        r.body.payUrl.endsWith(`/pagar/${publicId}`),
      "An invoice the bank is still preparing says so, with the full payment link to share",
    );
    await db.query("update console_invoices set status='paid' where id=$1", [processing]);
    r = await rpc("finance.get", { id: processing }, people.admin.session);
    ok(r.status === 200 && r.body.display === "paid" && r.body.processing === false, "A refetch reads the payment the bank confirmed");
    await db.query("update console_invoices set status='issued' where id=$1", [processing]);

    // The boleto PDF by the session: the app's cookie is accepted, and the same access rules apply.
    let response = await boleto(overdue, people.admin.session);
    ok([409, 502].includes(response.status), "The session route accepts the app's cookie (and never reaches a real bank here)");
    ok((await boleto(overdue, people.outsider.session)).status === 404, "Another company's boleto answers 404");
    ok((await boleto(overdue, people.member.session)).status === 404, "A Membro gets no boleto");
    response = await boleto(overdue);
    ok([303, 307, 308].includes(response.status) && /\/entrar/.test(response.headers.get("location") ?? ""), "Without a session the route sends to sign-in");
  } finally {
    const ids = Object.values(companies);
    for (const [statement, values] of [
      ["delete from console_invoices where id=any($1::text[]) or company_id=any($2::text[])", [invoiceIds, ids]],
      ["delete from console_subscriptions where id=any($1::text[]) or company_id=any($2::text[])", [subscriptionIds, ids]],
      ["delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [ids, userIds]],
      ["delete from console_session where user_id=any($1::text[])", [userIds]],
      ["delete from console_account where user_id=any($1::text[])", [userIds]],
      ["delete from console_memberships where company_id=any($1::text[])", [ids]],
      ["delete from console_companies where id=any($1::text[])", [ids]],
      ["delete from console_user where id=any($1::text[])", [userIds]],
    ])
      await db.query(statement, values);
  }
}
