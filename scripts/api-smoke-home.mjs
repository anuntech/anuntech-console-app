// Início, Produtos e serviços, apps and the hours bank in the native app
// (overview.get, products.*, apps.open, hours.*): the web's rules through
// /api/v1. Called from api-smoke.mjs with what it already has in scope;
// creates its own companies, people and records and removes them at the end.
import { randomUUID } from "node:crypto";

/**
 * @param {{
 *   db: import("pg").Pool,
 *   rpc: (path: string, input: unknown, cookie?: string, headers?: Record<string, string>) => Promise<{ status: number, body: any }>,
 *   ok: (condition: unknown, message: string) => void,
 *   marker: string,
 *   emailSignIn: (email: string) => Promise<{ status: number, body: any, cookie: string }>,
 *   staff: string,
 * }} ctx
 */
export async function homeChecks({ db, rpc, ok, marker, emailSignIn, staff }) {
  const address = (name) => `api-home-${name}-${marker}@example.invalid`;
  // 14 digits from a fresh UUID: unique per run, never a real CNPJ.
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "73917305829164").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const userIds = [];
  const people = {};
  const item = randomUUID();
  const e = {
    service: randomUUID(),
    link: randomUUID(),
    app: randomUUID(),
    suspended: randomUUID(),
    project: randomUUID(),
    other: randomUUID(),
  };
  const ticket = randomUUID(),
    task = randomUUID(),
    quote = randomUUID(),
    contract = randomUUID(),
    terms = randomUUID();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const month = today.slice(0, 7);
  const last = (() => {
    const [y, m] = month.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  })();
  const refused = (r, message) => r.status === 400 && r.body?.message === message;

  async function person(name, company, role, selected) {
    const id = randomUUID(),
      email = address(name),
      membership = randomUUID();
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Home ${name}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role,engagement_access) values($1,$2,$3,$4,$5)", [
      membership,
      company,
      email,
      role,
      selected ? "selected" : "all",
    ]);
    for (const engagement of selected ?? [])
      await db.query("insert into console_membership_engagements(membership_id,engagement_id) values($1,$2)", [membership, engagement]);
    people[name] = { id, email, session: (await emailSignIn(email)).cookie };
  }

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API home ${key} ${marker}`,
        cnpj(),
        address(`billing-${key}`),
      ]);
    await db.query(
      "insert into console_catalog_items(id,kind,name,what_we_do,what_we_need,expected_results,deadlines,interval) values($1,'service',$2,'Cuidamos do site.','Acesso ao domínio.','Site no ar.','Resposta em 1 dia útil.','monthly')",
      [item, `Suporte home ${marker}`],
    );
    await db.query(
      `insert into console_engagements(id,company_id,name,kind,url,status,catalog_item_id,amount_cents) values
       ($1,$7,'Suporte mensal','service',null,'active',$8,50000),
       ($2,$7,'Site institucional','product','https://example.com/','active',null,null),
       ($3,$7,'Roteiro','product','https://brastemp-roteiro-digital.vercel.app/','active',null,null),
       ($4,$7,'Servidor','product','https://brastemp-base-pendente.vercel.app/','suspended',null,null),
       ($5,$7,'Projeto da loja','project',null,'active',null,null),
       ($6,$9,'Produto de outra empresa','product','https://example.org/','active',null,null)`,
      [e.service, e.link, e.app, e.suspended, e.project, e.other, companies.own, item, companies.other],
    );
    await person("admin", companies.own, "manager");
    // A Membro who sees only the service and the project.
    await person("member", companies.own, "member", [e.service, e.project]);
    await person("outsider", companies.other, "manager");
    await db.query(
      "insert into console_engagement_suspensions(id,engagement_id,company_id,reason,suspended_at,actor_id) values($1,$2,$3,'overdue',now(),$4)",
      [randomUUID(), e.suspended, companies.own, people.admin.id],
    );
    await db.query(
      "insert into console_tasks(id,engagement_id,company_id,title,status,created_by) values($1,$2,$3,'Testar a home','review',$4),($5,$2,$3,'Publicar','done',$4)",
      [task, e.project, companies.own, people.admin.id, randomUUID()],
    );
    await db.query(
      "insert into console_tickets(id,company_id,subject,author_id,status,estimate_minutes,estimate_status) values($1,$2,$3,$4,'in_progress',120,'proposed')",
      [ticket, companies.own, `Melhoria ${marker}`, people.admin.id],
    );
    await db.query(
      `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash)
       values($1,$2,2097,$3,'Loja nova',$4,$5,'sent',1,'2099-01-01',now(),$6,'qh')`,
      [
        quote,
        companies.own,
        Math.floor(Math.random() * 1e6),
        JSON.stringify({ summary: "", stack: [], phases: [], hourlyRateCents: 0, discountCents: 0, upfrontPercent: 50, notes: "" }),
        people.admin.id,
        JSON.stringify({ number: "2097-900", title: "Loja nova", companyName: "A", companyDocument: "0", validUntil: "2099-01-01", summary: "", stack: [], phases: [], hourlyRateCents: 15000, discountCents: 0, upfrontPercent: 50, notes: "" }),
      ],
    );
    await db.query(
      "insert into console_contracts(id,company_id,title,body,author_id,status,published_at,published_version,publication,document_hash) values($1,$2,'Contrato home','x',$3,'sent',now(),1,$4,'hh')",
      [contract, companies.own, people.admin.id, JSON.stringify({ title: "Contrato home", body: "Cláusula 1.", companyName: "A", companyDocument: "0" })],
    );
    // A published hours bank: 10 h a month, contest within 5 business days; last month's report just went out.
    await db.query(
      `insert into console_service_terms(id,company_id,basis,preset,label,policy,verified_by,verified_at,publish_at)
       values($1,$2,'external_contract','support','Suporte home',$3,$4,now(),now() - interval '1 day')`,
      [
        terms,
        companies.own,
        JSON.stringify({ levels: false, response: { normal: { firstResponseMinutes: 540 } }, pausesWhileWaiting: false, tacitAcceptance: false, outOfHours: "unspecified", includesDevelopment: true, hoursBank: { monthlyMinutes: 600, alertPercent: 80, overageCents: 15000, reportContestDays: 5 }, clauses: { response: "QA 1" } }),
        people.admin.id,
      ],
    );
    await db.query(
      "insert into console_time_entries(id,company_id,author_id,minutes,note,worked_on,kind,engagement_id) values($1,$2,$3,540,'Ajustes no suporte',$4,'bank',$5),($6,$2,$3,30,'Ajuste no site',$4,'bank',$7)",
      [randomUUID(), companies.own, people.admin.id, today, e.service, randomUUID(), e.link],
    );
    await db.query("insert into console_hours_months(id,company_id,month,report_sent_at,report_sent_by) values($1,$2,$3,now() - interval '1 hour',$4)", [
      randomUUID(),
      companies.own,
      last,
      people.admin.id,
    ]);
    const { admin, member, outsider } = { admin: people.admin.session, member: people.member.session, outsider: people.outsider.session };

    // Início.
    let r = await rpc("overview.get", {}, admin);
    const o = r.body;
    ok(
      r.status === 200 &&
        o.attention.quotesToAnswer === 1 &&
        o.attention.contractsToSign === 1 &&
        o.attention.estimates.count === 1 &&
        o.attention.estimates.ticketId === ticket &&
        o.attention.reviews.count === 1 &&
        o.attention.reviews.projectId === e.project &&
        o.attention.suspended.length === 1 &&
        o.attention.suspended[0].id === e.suspended,
      "Início tells the Administrador what needs them: quotes, contracts, estimates, reviews and the suspended product",
    );
    const product = (id) => o?.products?.find((p) => p.id === id);
    ok(
      o.products[0]?.id === e.suspended &&
        product(e.service)?.opensAs === "service" &&
        product(e.link)?.opensAs === "link" &&
        product(e.link)?.url === "https://example.com/" &&
        product(e.app)?.opensAs === "app" &&
        product(e.app)?.url === null &&
        !product(e.other),
      "Início lists the products suspended first, each with how it opens, never another company's",
    );
    ok(
      o.projects.some((p) => p.id === e.project && p.tasks.total === 2 && p.tasks.done === 1),
      "Início shows the projects with their progress",
    );
    const bank = o.banks.find((b) => b.companyId === companies.own);
    ok(
      bank?.viewer === "approver" && bank.usedMinutes === 570 && bank.includedMinutes === 600 && bank.entries.length === 2 && bank.previous?.month === last && !("overageCents" in bank),
      "The Administrador sees the month's hours bank, last month's report and no price",
    );
    r = await rpc("overview.get", {}, member);
    ok(
      r.status === 200 &&
        !r.body.canFinance &&
        r.body.nextCharge === null &&
        r.body.attention.quotesToAnswer === 0 &&
        r.body.attention.contractsToSign === 0 &&
        r.body.attention.estimates.count === 0 &&
        r.body.attention.reviews.count === 0 &&
        r.body.attention.suspended.length === 0 &&
        r.body.products.length === 1 &&
        r.body.products[0].id === e.service,
      "A Membro's Início has no money and no decisions, only the products chosen for them",
    );
    const memberBank = r.body.banks.find((b) => b.companyId === companies.own);
    ok(
      memberBank?.viewer === "member" && memberBank.usedMinutes === 570 && memberBank.entries.length === 1 && memberBank.entries[0].note === "Ajustes no suporte",
      "A Membro reads the bank with only the lines about what they see",
    );
    r = await rpc("overview.get", {}, outsider);
    ok(r.status === 200 && !r.body.products.some((p) => p.id === e.service) && !r.body.banks.some((b) => b.companyId === companies.own), "Another company's Início shows nothing of this one");

    // Produtos e serviços.
    r = await rpc("products.list", {}, admin);
    const service = r.body?.rows?.find((row) => row.id === e.service);
    ok(
      r.status === 200 &&
        service?.money?.amountCents === 50000 &&
        r.body.rows.some((row) => row.id === e.suspended && row.statusLabel === "Suspenso") &&
        !r.body.rows.some((row) => row.id === e.project || row.id === e.other) &&
        r.body.suspended?.canPay === true &&
        /^Servidor está suspenso desde .*, por atraso no pagamento\.$/.test(r.body.suspended.title),
      "The Administrador lists products with their price and the suspension notice with Pagar agora",
    );
    r = await rpc("products.list", { search: "roteiro" }, admin);
    ok(r.status === 200 && r.body.rows.length === 1 && r.body.rows[0].id === e.app, "The products list searches by name");
    r = await rpc("products.list", {}, member);
    ok(
      r.status === 200 && r.body.rows.length === 1 && r.body.rows[0].id === e.service && !("money" in r.body.rows[0]) && r.body.suspended === null && !r.body.showStatusFilter,
      "A Membro lists only the items chosen for them, without money",
    );
    r = await rpc("products.get", { id: e.service }, admin);
    ok(
      r.status === 200 && r.body.sections.whatWeDo === "Cuidamos do site." && r.body.billing?.amountCents === 50000 && r.body.billing.interval === "monthly" && r.body.companyId === companies.own,
      "A service opens with the catalog's sections and its billing for the Administrador",
    );
    r = await rpc("products.get", { id: e.service }, member);
    ok(r.status === 200 && r.body.sections.deadlines === "Resposta em 1 dia útil." && !("billing" in r.body), "A Membro reads the service without its billing");
    r = await rpc("products.get", { id: e.suspended }, admin);
    ok(r.status === 200 && r.body.suspension?.canPay === true, "A suspended product says why and offers Pagar agora");
    ok((await rpc("products.get", { id: e.link }, member)).status === 404, "A product outside the Membro's selection answers 404");
    ok((await rpc("products.get", { id: e.service }, outsider)).status === 404, "Another company's service answers 404");
    ok((await rpc("products.get", { id: e.project }, admin)).status === 404, "A project is not a product");

    // Apps.
    r = await rpc("apps.open", { id: e.link }, admin);
    ok(r.status === 200 && r.body.kind === "blocked" && r.body.link === "https://example.com/" && r.body.title === "Este produto abre fora do Console", "A plain link is not an app: the app says so and offers the link");
    r = await rpc("apps.open", { id: e.service }, admin);
    ok(r.status === 200 && r.body.kind === "page" && r.body.to === "service", "A service opens its own screen");
    r = await rpc("apps.open", { id: e.suspended }, admin);
    ok(r.status === 200 && r.body.kind === "blocked" && r.body.title === "Servidor está suspenso" && r.body.pay === true, "A suspended app is blocked with the way out");
    ok((await rpc("apps.open", { id: e.app }, member)).status === 404, "A Membro cannot open an app outside their selection");
    ok((await rpc("apps.open", { id: e.app }, outsider)).status === 404, "Another company's app answers 404");
    const audits = async () => (await db.query("select count(*)::int as n from console_audit_events where entity_id=$1 and action='app.opened'", [e.app])).rows[0].n;
    r = await rpc("apps.open", { id: e.app }, admin);
    // Without the pass key the Console fails closed, as the web does; with it, the address carries the pass.
    ok(
      (r.status === 200 && r.body.kind === "open" && r.body.url.startsWith("https://brastemp-roteiro-digital.vercel.app/?console_pass=") && (await audits()) === 1) ||
        (r.status === 400 && /não conseguiu abrir o app/.test(r.body?.message ?? "") && (await audits()) === 0),
      "An app opens only with a signed pass, recorded as app.opened",
    );

    // Banco de horas.
    r = await rpc("hours.banks", {}, member);
    ok(r.status === 200 && r.body.banks.some((b) => b.companyId === companies.own && b.viewer === "member"), "hours.banks gives a Membro the bank to read");
    ok((await rpc("hours.approveOverage", { companyId: companies.own, hours: "5" }, member)).status === 404, "A Membro cannot approve hours beyond the bank");
    ok((await rpc("hours.approveOverage", { companyId: companies.own, hours: "5" }, outsider)).status === 404, "Another company cannot approve this bank");
    ok(
      refused(await rpc("hours.approveOverage", { companyId: companies.own, hours: "5" }, staff), "Só um Administrador da empresa aprova horas além do banco."),
      "The team never approves hours for the client",
    );
    ok(refused(await rpc("hours.approveOverage", { companyId: companies.own, hours: "muitas" }, admin), "Informe as horas como 2 ou 1,5."), "The hours are read as on the web");
    r = await rpc("hours.approveOverage", { companyId: companies.own, hours: "1,5" }, admin);
    const months = (await db.query("select * from console_hours_months where company_id=$1 and month=$2", [companies.own, month])).rows;
    ok(
      r.status === 200 &&
        r.body.message === "Aprovado: até 1,5 horas além do banco neste mês. O excedente é cobrado pelo valor do contrato." &&
        months[0]?.overage_approved_minutes === 90 &&
        months[0].overage_approved_by === people.admin.id &&
        (await db.query("select 1 from console_audit_events where company_id=$1 and action='hours.overage_approved'", [companies.own])).rowCount === 1,
      "The Administrador approves hours beyond the bank from the app",
    );
    ok((await rpc("hours.contestReport", { companyId: companies.own, month: last, note: "Não confere" }, member)).status === 404, "A Membro cannot contest the report");
    ok(
      refused(await rpc("hours.contestReport", { companyId: companies.own, month: last, note: "Não confere" }, staff), "Só um Administrador da empresa contesta o relatório."),
      "The team never contests for the client",
    );
    ok(refused(await rpc("hours.contestReport", { companyId: companies.own, month: last, note: "Oi" }, admin), "Conte o que não confere."), "A contest needs a reason");
    ok(refused(await rpc("hours.contestReport", { companyId: companies.own, month, note: "Não confere" }, admin), "O relatório deste mês ainda não foi enviado."), "A month without a report cannot be contested");
    r = await rpc("hours.contestReport", { companyId: companies.own, month: last, note: "A tarefa do dia 10 não foi feita." }, admin);
    const contested = (await db.query("select * from console_hours_months where company_id=$1 and month=$2", [companies.own, last])).rows[0];
    ok(
      r.status === 200 && r.body.message === "Contestação enviada. A equipe responde por chamado." && contested?.contested_by === people.admin.id && contested.contest_note === "A tarefa do dia 10 não foi feita.",
      "The Administrador contests last month's report from the app",
    );
    ok(refused(await rpc("hours.contestReport", { companyId: companies.own, month: last, note: "De novo, não confere" }, admin), "Este relatório já foi contestado."), "A report is contested once");
  } finally {
    const ids = Object.values(companies);
    const memberships = (await db.query("select id from console_memberships where company_id=any($1::text[])", [ids])).rows.map((m) => m.id);
    for (const [statement, values] of [
      ["delete from console_membership_engagements where membership_id=any($1::text[])", [memberships]],
      ["delete from console_time_entries where company_id=any($1::text[])", [ids]],
      ["delete from console_hours_months where company_id=any($1::text[])", [ids]],
      ["delete from console_service_terms where company_id=any($1::text[])", [ids]],
      ["delete from console_engagement_suspensions where company_id=any($1::text[])", [ids]],
      ["delete from console_tasks where company_id=any($1::text[])", [ids]],
      ["delete from console_ticket_notices where ticket_id=$1", [ticket]],
      ["delete from console_tickets where company_id=any($1::text[])", [ids]],
      ["delete from console_quotes where company_id=any($1::text[])", [ids]],
      ["delete from console_contracts where company_id=any($1::text[])", [ids]],
      ["delete from console_automation_events where company_id=any($1::text[])", [ids]],
      ["delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [ids, userIds]],
      ["delete from console_session where user_id=any($1::text[])", [userIds]],
      ["delete from console_account where user_id=any($1::text[])", [userIds]],
      ["delete from console_memberships where company_id=any($1::text[])", [ids]],
      ["delete from console_engagements where company_id=any($1::text[])", [ids]],
      ["delete from console_catalog_items where id=$1", [item]],
      ["delete from console_companies where id=any($1::text[])", [ids]],
      ["delete from console_user where id=any($1::text[])", [userIds]],
    ])
      await db.query(statement, values);
  }
}
