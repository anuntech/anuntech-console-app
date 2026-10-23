// Gaps L9–L12 of the native app (mobile/task.md, "Lacunas (mapa de 23/10)"):
// company names as people read them (companyDisplayName) and named only for
// who has more than one company (showCompany), Financeiro's "Personalizado"
// period (period "custom" + from/to), and the company filter of Chamados,
// Financeiro and Produtos ("Só desta empresa"). Called from api-smoke.mjs;
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
export async function lac3Checks({ db, rpc, ok, marker, emailSignIn, staff }) {
  const address = (name) => `api-lac3-${name}-${marker}@example.invalid`;
  const digits = (n) => (randomUUID().replace(/\D/g, "") + "5820193746581029").slice(0, n);
  // A tag with a digit keeps its letters as typed (readableCase leaves words with numbers alone).
  const tag = `Q${marker.replaceAll("-", "").slice(0, 6)}7`.toUpperCase();
  const root = digits(8);
  const mei = `${root.slice(0, 2)}.${root.slice(2, 5)}.${root.slice(5)}`;
  const companies = { a: randomUUID(), b: randomUUID(), c: randomUUID() };
  // The razão social as the Receita writes it, and the name people read.
  const registry = {
    a: { name: `${mei} ALINE SOUZA ${tag} LTDA`, document: `${root}000112`, shown: `Aline Souza ${tag}` },
    b: { name: `CLINICA ${tag} LTDA`, document: digits(14), shown: `Clinica ${tag}` },
    c: { name: `OUTRA ${tag} LTDA`, document: digits(14), shown: `Outra ${tag}` },
  };
  const userIds = [];
  const people = {};
  const tickets = { a: randomUUID(), b: randomUUID(), c: randomUUID() };
  const invoices = { may: randomUUID(), july: randomUUID(), b: randomUUID(), c: randomUUID() };
  const e = { project: randomUUID(), productA: randomUUID(), productB: randomUUID(), productC: randomUUID() };
  const contract = randomUUID(),
    quote = randomUUID();

  async function person(name, memberships) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Lac3 ${name}`, email]);
    userIds.push(id);
    for (const [company, role] of memberships)
      await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email, session: (await emailSignIn(email)).cookie };
  }
  const invoice = (id, company, description, due) =>
    db.query(
      "insert into console_invoices(id,company_id,description,amount_cents,due_date,status,public_enabled,fiscal_status) values($1,$2,$3,10000,$4,'issued',false,'not_requested')",
      [id, company, description, due],
    );

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        registry[key].name,
        registry[key].document,
        address(`billing-${key}`),
      ]);
    // Several companies: Administrador of A and B. One company: Administrador of A. Another client: C.
    await person("multi", [
      [companies.a, "manager"],
      [companies.b, "manager"],
    ]);
    await person("single", [[companies.a, "manager"]]);
    await person("outsider", [[companies.c, "manager"]]);
    const { multi, single, outsider } = { multi: people.multi.session, single: people.single.session, outsider: people.outsider.session };

    for (const key of Object.keys(tickets))
      await db.query("insert into console_tickets(id,company_id,subject,author_id,status) values($1,$2,$3,$4,'open')", [
        tickets[key],
        companies[key],
        `Chamado ${key} ${marker}`,
        people.outsider.id,
      ]);
    await invoice(invoices.may, companies.a, `Maio ${marker}`, "2030-05-10");
    await invoice(invoices.july, companies.a, `Julho ${marker}`, "2030-07-10");
    await invoice(invoices.b, companies.b, `Clínica ${marker}`, "2030-05-15");
    await invoice(invoices.c, companies.c, `Outra ${marker}`, "2030-05-20");
    await db.query(
      `insert into console_engagements(id,company_id,name,kind,url,status) values
       ($1,$5,'Projeto lac3','project',null,'active'),
       ($2,$5,'Site lac3','product','https://example.com/','active'),
       ($3,$6,'Agenda lac3','product','https://example.com/','active'),
       ($4,$7,'Loja lac3','product','https://example.com/','active')`,
      [e.project, e.productA, e.productB, e.productC, companies.a, companies.b, companies.c],
    );
    await db.query(
      "insert into console_contracts(id,company_id,title,body,author_id,status,published_at,published_version,publication,document_hash) values($1,$2,'Contrato lac3','x',$3,'sent',now(),1,$4,'lh')",
      [contract, companies.a, people.single.id, JSON.stringify({ title: "Contrato lac3", body: "Cláusula 1.", companyName: registry.a.name, companyDocument: registry.a.document })],
    );
    await db.query(
      `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash,decided_at,decided_party,decided_name)
       values($1,$2,2097,$3,'Loja lac3',$4,$5,'accepted',1,'2099-01-01',now(),$6,'lq',now(),'client','Lac3 single')`,
      [
        quote,
        companies.a,
        Math.floor(Math.random() * 1e6),
        JSON.stringify({ summary: "", stack: [], phases: [], hourlyRateCents: 0, discountCents: 0, upfrontPercent: 50, notes: "" }),
        people.single.id,
        JSON.stringify({ number: "2097-930", title: "Loja lac3", companyName: registry.a.name, companyDocument: registry.a.document, validUntil: "2099-01-01", summary: "", stack: [], phases: [], hourlyRateCents: 15000, discountCents: 0, upfrontPercent: 50, notes: "" }),
      ],
    );

    // L9: the name people read, everywhere the app names a company.
    let r = await rpc("me.get", {}, multi);
    const nameOf = (list, id) => list?.find((c) => c.id === id)?.name;
    ok(
      r.status === 200 && nameOf(r.body.companies, companies.a) === registry.a.shown && nameOf(r.body.companies, companies.b) === registry.b.shown,
      "me.get names each company without the MEI number, the suffix or the registry's capitals",
    );
    r = await rpc("tickets.list", { status: "all", search: marker }, multi);
    const ticketRow = (id) => r.body?.rows?.find((row) => row.id === id);
    ok(
      r.status === 200 &&
        ticketRow(tickets.a)?.company === registry.a.shown &&
        ticketRow(tickets.b)?.company === registry.b.shown &&
        !ticketRow(tickets.c) &&
        r.body.showCompany === true &&
        nameOf(r.body.companies, companies.a) === registry.a.shown &&
        r.body.companies.length === 2 &&
        r.body.companyFilter === null,
      "tickets.list rows and its company choices carry the display name",
    );
    r = await rpc("tickets.list", { status: "all", search: registry.a.name.slice(0, 10) }, multi);
    ok(r.status === 200 && r.body.rows.some((row) => row.id === tickets.a), "The ticket search still finds the razão social");
    r = await rpc("tickets.get", { id: tickets.a }, multi);
    ok(r.status === 200 && r.body.company === registry.a.shown && r.body.showCompany === true, "A client of several companies reads the company on the ticket");
    r = await rpc("tickets.get", { id: tickets.a }, single);
    ok(r.status === 200 && r.body.company === registry.a.shown && r.body.showCompany === false, "A client of one company is not told its own name on the ticket");
    r = await rpc("tickets.choices", {}, multi);
    ok(r.status === 200 && nameOf(r.body.companies, companies.b) === registry.b.shown, "Opening a ticket offers the companies by display name");

    r = await rpc("finance.list", { search: marker }, multi);
    const invoiceRow = (id) => r.body?.rows?.find((row) => row.id === id);
    ok(
      r.status === 200 &&
        invoiceRow(invoices.may)?.company === registry.a.shown &&
        invoiceRow(invoices.b)?.company === registry.b.shown &&
        !invoiceRow(invoices.c) &&
        r.body.companies?.length === 2 &&
        r.body.showCompany === true,
      "finance.list rows and its company choices carry the display name",
    );
    r = await rpc("finance.get", { id: invoices.may }, single);
    ok(
      r.status === 200 && r.body.company === registry.a.shown && r.body.payer.name === registry.a.name,
      "An invoice reads the display name; the boleto's payer keeps the razão social",
    );

    r = await rpc("projects.list", { status: "all", search: "lac3" }, multi);
    ok(
      r.status === 200 &&
        r.body.rows.find((row) => row.id === e.project)?.company === registry.a.shown &&
        nameOf(r.body.companies, companies.b) === registry.b.shown,
      "projects.list rows and company chips carry the display name",
    );
    r = await rpc("projects.get", { id: e.project }, multi);
    ok(r.status === 200 && r.body.company === registry.a.shown && r.body.showCompany === true, "The board names whose it is for a client of several companies");
    r = await rpc("projects.get", { id: e.project }, single);
    ok(r.status === 200 && r.body.showCompany === false, "The board does not name a client's only company");

    r = await rpc("contracts.get", { id: contract }, single);
    ok(
      r.status === 200 && r.body.company === registry.a.name && r.body.companyName === registry.a.shown && r.body.showCompany === false,
      "A contract keeps the razão social for the text and signatures, reads the display name in the header, hidden for one company",
    );
    r = await rpc("contracts.get", { id: contract }, multi);
    ok(r.status === 200 && r.body.showCompany === true && r.body.companyName === registry.a.shown, "A client of several companies reads the company on the contract");
    r = await rpc("contracts.list", { search: "lac3" }, multi);
    ok(r.status === 200 && r.body.rows.find((row) => row.id === contract)?.company === registry.a.shown, "contracts.list rows carry the display name");
    r = await rpc("quotes.get", { id: quote }, single);
    ok(
      r.status === 200 && r.body.company === registry.a.name && r.body.companyName === registry.a.shown && r.body.showCompany === false && r.body.decision?.party === "client",
      "A quote keeps the razão social of the proposal, and hides “por <empresa>” from a client of one company",
    );
    r = await rpc("quotes.get", { id: quote }, multi);
    ok(r.status === 200 && r.body.showCompany === true, "A client of several companies reads who answered the quote");
    r = await rpc("quotes.list", { search: "lac3" }, multi);
    ok(r.status === 200 && r.body.rows.find((row) => row.id === quote)?.company === registry.a.shown, "quotes.list rows carry the display name");
    r = await rpc("contracts.get", { id: contract }, outsider);
    ok(r.status === 404, "Another company's contract answers 404");

    // L11: Financeiro's "Personalizado", by due date.
    const ids = (body) => new Set(body?.rows?.map((row) => row.id));
    r = await rpc("finance.list", { search: marker, period: "custom", from: "2030-05-01", to: "2030-05-31" }, single);
    let found = ids(r.body);
    ok(
      r.status === 200 && found.has(invoices.may) && !found.has(invoices.july) && !found.has(invoices.b) && r.body.totals.all.count === 1,
      "Personalizado lists the invoices due between De and Até, totals included",
    );
    r = await rpc("finance.list", { search: marker, period: "custom", from: "2030-06-01" }, single);
    found = ids(r.body);
    ok(r.status === 200 && found.has(invoices.july) && !found.has(invoices.may), "Personalizado with only De has no end");
    r = await rpc("finance.list", { search: marker, period: "custom", to: "2030-06-01" }, single);
    found = ids(r.body);
    ok(r.status === 200 && found.has(invoices.may) && !found.has(invoices.july), "Personalizado with only Até has no start");
    r = await rpc("finance.list", { search: marker, period: "custom", from: "2030-06-01", to: "2030-05-01" }, single);
    ok(r.status === 200 && r.body.rows.length === 0, "Até before De finds nothing, as on the web");
    r = await rpc("finance.list", { search: marker, period: "all", from: "2030-05-01", to: "2030-05-31" }, single);
    found = ids(r.body);
    ok(r.status === 200 && found.has(invoices.may) && found.has(invoices.july), "De and Até count only with Personalizado");
    r = await rpc("finance.list", { period: "custom", from: "31/05/2030" }, single);
    ok(r.status === 400, "A date that is not YYYY-MM-DD is refused");
    r = await rpc("finance.list", { search: marker, period: "custom", from: "2030-05-01", to: "2030-05-31" }, people.outsider.session);
    ok(r.status === 200 && !ids(r.body).has(invoices.may) && ids(r.body).has(invoices.c), "Personalizado stays within the person's companies");

    // L12: the company filter.
    r = await rpc("tickets.list", { status: "all", search: marker, company: companies.b }, multi);
    found = ids(r.body);
    ok(
      r.status === 200 && found.has(tickets.b) && !found.has(tickets.a) && r.body.companyFilter?.id === companies.b && r.body.companyFilter.name === registry.b.shown,
      "Chamados narrows to one company (/chamados?company=), named by display name",
    );
    r = await rpc("tickets.list", { status: "all", search: marker, company: companies.c }, multi);
    found = ids(r.body);
    ok(r.status === 200 && !found.has(tickets.c) && r.body.companyFilter === null, "Another company's id shows none of its tickets (the filter is dropped, as on the web)");
    r = await rpc("tickets.list", { status: "all", search: marker }, single);
    ok(r.status === 200 && r.body.companies?.length === 0 && r.body.showCompany === false, "A client of one company gets no company choices");
    r = await rpc("tickets.list", { status: "all", search: marker, company: companies.c }, staff);
    found = ids(r.body);
    ok(r.status === 200 && found.has(tickets.c) && !found.has(tickets.a) && r.body.companyFilter?.name === registry.c.shown, "The team follows a company link too");
    r = await rpc("tickets.list", { company: "não-é-id" }, multi);
    ok(r.status === 400, "A company that is not an id is refused");

    r = await rpc("finance.list", { search: marker, company: companies.a }, multi);
    found = ids(r.body);
    ok(
      r.status === 200 && found.has(invoices.may) && found.has(invoices.july) && !found.has(invoices.b) && r.body.companyFilter?.name === registry.a.shown && r.body.totals.all.count === 2,
      "Financeiro narrows to one company, totals included",
    );
    r = await rpc("finance.list", { search: marker, company: companies.c }, multi);
    found = ids(r.body);
    ok(r.status === 200 && !found.has(invoices.c) && r.body.companyFilter === null, "Another company's invoices stay out with its id");
    r = await rpc("finance.list", { search: marker, company: companies.a }, outsider);
    ok(r.status === 200 && !ids(r.body).has(invoices.may) && r.body.companyFilter === null, "A client never reaches another company's invoices by filter");

    r = await rpc("products.list", { status: "all", search: "clinica" }, multi);
    ok(
      r.status === 200 && r.body.shortcuts?.length === 1 && r.body.shortcuts[0].id === companies.b && r.body.shortcuts[0].name === registry.b.shown,
      "A search that names a company offers “Só desta empresa”",
    );
    r = await rpc("products.list", { status: "all", company: companies.b }, multi);
    found = ids(r.body);
    ok(
      r.status === 200 && found.has(e.productB) && !found.has(e.productA) && r.body.companyFilter?.name === registry.b.shown && r.body.shortcuts?.length === 0,
      "Produtos narrows to the chosen company",
    );
    r = await rpc("products.list", { status: "all", company: companies.c }, multi);
    found = ids(r.body);
    ok(r.status === 200 && !found.has(e.productC) && r.body.companyFilter === null, "Another company's products stay out with its id");
    r = await rpc("products.list", { status: "all", search: "aline" }, single);
    ok(r.status === 200 && r.body.shortcuts?.length === 0, "A client of one company gets no shortcuts");
  } finally {
    const all = Object.values(companies);
    for (const [statement, values] of [
      ["delete from console_ticket_notices where ticket_id=any($1::text[])", [Object.values(tickets)]],
      ["delete from console_tickets where company_id=any($1::text[])", [all]],
      ["delete from console_invoices where company_id=any($1::text[])", [all]],
      ["delete from console_quotes where company_id=any($1::text[])", [all]],
      ["delete from console_contracts where company_id=any($1::text[])", [all]],
      ["delete from console_automation_events where company_id=any($1::text[])", [all]],
      ["delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [all, userIds]],
      ["delete from console_session where user_id=any($1::text[])", [userIds]],
      ["delete from console_account where user_id=any($1::text[])", [userIds]],
      ["delete from console_memberships where company_id=any($1::text[])", [all]],
      ["delete from console_engagements where company_id=any($1::text[])", [all]],
      ["delete from console_companies where id=any($1::text[])", [all]],
      ["delete from console_user where id=any($1::text[])", [userIds]],
    ])
      await db.query(statement, values);
  }
}
