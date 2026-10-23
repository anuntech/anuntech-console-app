// Lacunas L13 and L14 (front lac4): the proposal's header document in
// quotes.get (the CNPJ frozen with what was sent, else the company's), and the
// clause text a change request was made against, which the app diffs word by
// word. Called from api-smoke.mjs; creates its own companies, people, quotes
// and contracts and removes them.
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
export async function lac4Checks({ db, rpc, ok, marker, emailSignIn, staff }) {
  const address = (name) => `api-lac4-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "73917305829164").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const documents = { own: cnpj(), other: cnpj() };
  const userIds = [];
  const quoteIds = [];
  const contractIds = [];
  const people = {};
  const tag = marker.slice(0, 8);
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Lac4 ${name}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email };
  }

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API lac4 ${key} ${marker}`,
        documents[key],
        address(`billing-${key}`),
      ]);
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    const admin = (await emailSignIn(people.admin.email)).cookie;
    const membro = (await emailSignIn(people.membro.email)).cookie;

    // L13: a quote sent with the document frozen in it, one from before the field was frozen, and another company's.
    const year = 2095;
    const seq = 100 + Math.floor(Math.random() * 800);
    const frozenDocument = "11222333000181";
    const content = {
      summary: "Um portal.",
      stack: [],
      phases: [{ name: "Descoberta", description: "", hoursMin: 10, hoursMax: 20, tasks: [{ title: "Reunião", description: "" }] }],
      hourlyRateCents: 10000,
      discountCents: 0,
      upfrontPercent: 0,
      notes: "",
    };
    const quote = async (company, offset, publication) => {
      const id = randomUUID();
      quoteIds.push(id);
      await db.query(
        `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash)
         values($1,$2,$3,$4,$5,$6,$7,'sent',1,'2099-01-01',now(),$8,$9)`,
        [id, company, year, seq + offset, `Portal ${tag}`, JSON.stringify(content), people.admin.id, JSON.stringify(publication), `qhash-${id}`],
      );
      return id;
    };
    const base = { number: `${year}-${seq}`, title: `Portal ${tag}`, companyName: "A", validUntil: "2099-01-01", version: 1, ...content };
    const frozen = await quote(companies.own, 0, { ...base, companyDocument: frozenDocument });
    const older = await quote(companies.own, 1, { ...base, companyDocument: "" });
    const foreign = await quote(companies.other, 2, { ...base, companyDocument: frozenDocument });

    let r = await rpc("quotes.get", { id: frozen }, admin);
    ok(
      r.status === 200 && r.body.companyDocument === frozenDocument && r.body.upfrontPercent === 0 && r.body.balanceCents === r.body.totalCents,
      "quotes.get: the header's CNPJ is the one frozen with the proposal; with no entry the balance is the whole total",
    );
    r = await rpc("quotes.get", { id: older }, admin);
    ok(r.status === 200 && r.body.companyDocument === documents.own, "quotes.get: a proposal sent without the CNPJ shows the company's current one");
    ok((await rpc("quotes.get", { id: frozen }, staff)).body?.companyDocument === frozenDocument, "quotes.get: the team reads the same header");
    ok(
      (await rpc("quotes.get", { id: foreign }, admin)).status === 404 && (await rpc("quotes.get", { id: frozen }, membro)).status === 404,
      "quotes.get: another company's quote or a Membro answers 404, without the CNPJ",
    );

    // L14: a change request keeps the clause text it was made against, so the app can diff the proposal.
    const body = ["CONTRATO DE SUPORTE", "CLÁUSULA 1 — PAGAMENTO\n1.1. Pagamento em 30 dias."].join("\n\n");
    const contract = randomUUID();
    contractIds.push(contract);
    await db.query(
      `insert into console_contracts(id,company_id,title,body,author_id,status,published_at,published_version,publication,document_hash)
       values($1,$2,$3,$4,$5,'sent',now(),1,$6,$7)`,
      [contract, companies.own, `Suporte ${tag}`, body, people.admin.id, JSON.stringify({ title: `Suporte ${tag}`, body, companyName: "A", companyDocument: "0", kind: "contract", version: 1 }), `hash-${contract}-1`],
    );
    r = await rpc("contracts.get", { id: contract }, admin);
    const clause = r.body?.blocks?.find((block) => block.type === "clause" && block.requestable);
    r = await rpc(
      "contracts.saveRequest",
      { contractId: contract, blockIndex: clause?.index ?? -1, comment: "Prazo menor.", proposedText: "Pagamento em 15 dias após a entrega." },
      admin,
    );
    ok(r.status === 200, "contracts.saveRequest: an Administrador proposes new text for a clause");
    r = await rpc("contracts.get", { id: contract }, admin);
    const draft = r.body?.review?.requests?.find((request) => request.status === "draft");
    ok(
      draft?.excerpt === clause?.text && draft?.proposedText === "Pagamento em 15 dias após a entrega.",
      "contracts.get: a request carries the clause text it was made against and the proposed text, for the word diff",
    );
    ok((await rpc("contracts.get", { id: contract }, membro)).status === 404, "contracts.get: a Membro answers 404");
  } finally {
    const ids = Object.values(companies);
    for (const [statement, values] of [
      ["delete from console_contract_change_requests where contract_id=any($1::text[])", [contractIds]],
      ["delete from console_contract_versions where contract_id=any($1::text[])", [contractIds]],
      ["delete from console_contracts where id=any($1::text[])", [contractIds]],
      ["delete from console_quote_versions where quote_id=any($1::text[])", [quoteIds]],
      ["delete from console_quotes where id=any($1::text[])", [quoteIds]],
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
