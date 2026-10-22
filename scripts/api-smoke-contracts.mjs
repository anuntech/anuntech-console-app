// Contracts and quotes in the native app (frente 3): the web's list filters,
// the review of a sent contract (change requests per clause, the round sent to
// Anuntech, earlier rounds with the answers), versions with their PDFs and the
// full proposal. Called from api-smoke.mjs with what it already has in scope;
// creates its own companies, people, contracts and quotes and removes them.
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
 *   mailFile?: string,
 * }} ctx
 */
export async function contractsChecks({ db, rpc, ok, marker, emailSignIn, staff, base, mailFile }) {
  const address = (name) => `api-contracts-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "73917305829164").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const userIds = [];
  const people = {};
  const contractIds = [];
  const quoteIds = [];
  const tag = marker.slice(0, 8);
  const mails = () => {
    if (!mailFile) return [];
    try {
      return readFileSync(mailFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
    } catch {
      return [];
    }
  };
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Contracts ${name}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email };
  }
  const refused = (r, message) => r.status === 400 && r.body?.message === message;
  const v1 = [
    "CONTRATO DE SUPORTE",
    "CONTRATANTE: Empresa A.",
    "CLÁUSULA 1 — OBJETO\n1.1. Suporte mensal ao site.\n1.2. Atendimento em horário comercial.",
    "CLÁUSULA 2 — PAGAMENTO\n2.1. Pagamento em 30 dias.",
  ].join("\n\n");
  const v2 = v1.replace("2.1. Pagamento em 30 dias.", "2.1. Pagamento em 15 dias.");
  async function contract({ company, title, status, version = 1, body = v1, kind = "contract", parentId = null, endsAt = null }) {
    const id = randomUUID();
    contractIds.push(id);
    const publication = { title, body, companyName: "A", companyDocument: "0", kind, version };
    await db.query(
      `insert into console_contracts(id,company_id,title,body,author_id,status,published_at,published_version,publication,document_hash,kind,parent_id,ends_at,signed_at)
       values($1,$2,$3,$4,$5,$6,${status === "draft" ? "null" : "now()"},$7,$8,$9,$10,$11,$12,${status === "signed" ? "now()" : "null"})`,
      [
        id,
        company,
        title,
        body,
        people.author.id,
        status,
        status === "draft" ? 0 : version,
        status === "draft" ? null : JSON.stringify(publication),
        status === "draft" ? null : `hash-${id}-${version}`,
        kind,
        parentId,
        endsAt,
      ],
    );
    return id;
  }

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API contracts ${key} ${marker}`,
        cnpj(),
        address(`billing-${key}`),
      ]);
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("elsewhere", companies.other, "manager");
    people.author = people.admin;
    const admin = (await emailSignIn(people.admin.email)).cookie;
    const membro = (await emailSignIn(people.membro.email)).cookie;
    const elsewhere = (await emailSignIn(people.elsewhere.email)).cookie;

    // A contract on its second version, with the first round answered, an amendment and a draft.
    const title = `Suporte ${tag}`;
    const reviewed = await contract({ company: companies.own, title, status: "sent", version: 2, body: v2 });
    for (const [version, body] of [
      [1, v1],
      [2, v2],
    ])
      await db.query(
        "insert into console_contract_versions(id,contract_id,version,title,body,document_hash,sent_by) values($1,$2,$3,$4,$5,$6,$7)",
        [randomUUID(), reviewed, version, title, body, `hash-${reviewed}-${version}`, people.admin.id],
      );
    await db.query(
      `insert into console_contract_change_requests(id,contract_id,version,block_index,label,excerpt,comment,proposed_text,status,applied,response,author_id,submitted_at,decided_at)
       values($1,$2,1,6,'Cláusula 2.1','Pagamento em 30 dias.','Precisamos de 15 dias.','Pagamento em 15 dias.','accepted',true,'Ajustado.',$3,now(),now())`,
      [randomUUID(), reviewed, people.admin.id],
    );
    const amendment = await contract({
      company: companies.own,
      title: `Aditivo ${tag}`,
      status: "signed",
      kind: "amendment",
      parentId: reviewed,
      endsAt: "2020-01-01",
    });
    const draft = await contract({ company: companies.own, title: `Rascunho ${tag}`, status: "draft" });
    const foreign = await contract({ company: companies.other, title: `Outra ${tag}`, status: "sent" });

    // The list: situation and search, as on the web.
    let r = await rpc("contracts.list", { status: "sent", search: tag }, admin);
    ok(
      r.status === 200 &&
        r.body.rows.length === 1 &&
        r.body.rows[0].id === reviewed &&
        r.body.rows[0].kind === "contract" &&
        r.body.rows[0].signedBy.length === 0 &&
        r.body.rows[0].term === null,
      "contracts.list: filters by situation and searches the title",
    );
    r = await rpc("contracts.list", { status: "signed", search: tag }, admin);
    const listedAmendment = r.body?.rows?.find((row) => row.id === amendment);
    ok(
      r.status === 200 &&
        r.body.rows.length === 1 &&
        listedAmendment?.parentTitle === title &&
        listedAmendment.term?.state === "expired" &&
        /^Vencido há \d+ dias$/.test(listedAmendment.term.label),
      "contracts.list: an amendment names its contract and a signed one says it expired",
    );
    r = await rpc("contracts.list", { status: "all", search: tag }, admin);
    ok(
      r.status === 200 && !r.body.rows.some((row) => row.id === draft || row.id === foreign) && r.body.rows.length === 2,
      "contracts.list: a client never lists drafts nor another company's contracts",
    );
    ok((await rpc("contracts.list", { search: tag }, membro)).body?.rows?.length === 0, "contracts.list: a Membro lists no contracts");

    // The detail: blocks with their index, what changed, the rounds, versions and amendments.
    r = await rpc("contracts.get", { id: reviewed }, admin);
    const blocks = r.body?.blocks ?? [];
    const clause = (n) => blocks.find((b) => b.number === n);
    ok(
      r.status === 200 &&
        blocks.filter((b) => b.index !== null).every((b, i) => b.index === i) &&
        blocks[0].type === "title" &&
        !blocks[0].requestable &&
        clause("2.1")?.change === "added" &&
        clause("2.1").requestable &&
        clause("1.1")?.change === "same" &&
        blocks.some((b) => b.change === "removed" && b.index === null) &&
        r.body.previousVersion === 1,
      "contracts.get: the text comes as blocks with the index a request names and what changed since the previous version",
    );
    ok(
      r.body.review?.canRequest === true &&
        r.body.review.requests.length === 0 &&
        r.body.review.history.length === 1 &&
        r.body.review.history[0].version === 1 &&
        r.body.review.history[0].requests[0].response === "Ajustado." &&
        r.body.review.history[0].requests[0].statusLabel === "Aceito" &&
        r.body.review.history[0].requests[0].applied === true,
      "contracts.get: the client can ask for changes and reads the earlier round with Anuntech's answer",
    );
    ok(
      r.body.versions?.length === 2 &&
        r.body.versions[0].current === true &&
        r.body.versions[0].pdfPath === `/api/contratos/${reviewed}/pdf` &&
        r.body.versions[1].pdfPath === `/api/contratos/${reviewed}/pdf?versao=1` &&
        r.body.amendments?.length === 1 &&
        r.body.amendments[0].id === amendment &&
        !!r.body.sentAt &&
        r.body.kind === "contract",
      "contracts.get: versions with their PDFs, the amendments and when it was sent",
    );
    const pdf = await fetch(`${base}/api/contratos/${reviewed}/pdf?versao=1`, { headers: { Cookie: admin } });
    ok(pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf", "An earlier version's PDF opens with the app's session");
    r = await rpc("contracts.get", { id: amendment }, admin);
    ok(r.status === 200 && r.body.parent?.id === reviewed && r.body.kind === "amendment", "contracts.get: an amendment links to its contract");
    ok((await rpc("contracts.get", { id: reviewed }, staff)).body?.review?.canRequest === false, "contracts.get: the team never asks for changes");

    // Who may write a request.
    const block = clause("2.1").index;
    const request = { contractId: reviewed, blockIndex: block, comment: "Queremos 10 dias.", proposedText: "Pagamento em 10 dias." };
    ok(
      (await rpc("contracts.saveRequest", request, membro)).status === 404 &&
        (await rpc("contracts.saveRequest", request, elsewhere)).status === 404 &&
        (await rpc("contracts.saveRequest", { ...request, contractId: foreign }, admin)).status === 404 &&
        (await rpc("contracts.saveRequest", { ...request, contractId: draft }, admin)).status === 404,
      "contracts.saveRequest: a Membro, another company and a draft answer 404",
    );
    ok(
      refused(await rpc("contracts.saveRequest", request, staff), "Você não tem permissão para fazer isso."),
      "contracts.saveRequest: the team does not ask for changes for the client",
    );
    ok(
      refused(await rpc("contracts.saveRequest", { ...request, blockIndex: 0 }, admin), "Escolha uma cláusula do texto.") &&
        refused(await rpc("contracts.saveRequest", { ...request, comment: "  " }, admin), "Explique o que precisa mudar."),
      "contracts.saveRequest: a heading or an empty comment is refused with the web's words",
    );
    r = await rpc("contracts.saveRequest", request, admin);
    const [saved] = (await db.query("select * from console_contract_change_requests where contract_id=$1 and version=2", [reviewed])).rows;
    ok(
      r.status === 200 &&
        r.body.message === "Pedido salvo. Envie à Anuntech quando terminar." &&
        saved?.status === "draft" &&
        saved.label === "Cláusula 2.1" &&
        saved.excerpt === "Pagamento em 15 dias." &&
        saved.proposed_text === "Pagamento em 10 dias.",
      "contracts.saveRequest: the Administrador writes a request on a clause, kept as a draft",
    );
    r = await rpc("contracts.saveRequest", { ...request, requestId: saved.id, comment: "Queremos 12 dias." }, admin);
    ok(
      r.body?.message === "Pedido atualizado." &&
        (await db.query("select comment from console_contract_change_requests where id=$1", [saved.id])).rows[0].comment === "Queremos 12 dias.",
      "contracts.saveRequest: a draft can be edited",
    );
    ok(
      (await rpc("contracts.get", { id: reviewed }, staff)).body?.review?.requests?.length === 0 &&
        (await rpc("contracts.get", { id: reviewed }, admin)).body?.review?.drafts === 1,
      "contracts.get: drafts reach only the client's side",
    );

    // Discarding.
    await rpc("contracts.saveRequest", { ...request, blockIndex: clause("1.1").index, comment: "Outro pedido." }, admin);
    const [other] = (
      await db.query("select id from console_contract_change_requests where contract_id=$1 and version=2 and id<>$2", [reviewed, saved.id])
    ).rows;
    ok(
      (await rpc("contracts.discardRequest", { id: other.id }, membro)).status === 404 &&
        (await rpc("contracts.discardRequest", { id: other.id }, elsewhere)).status === 404 &&
        refused(await rpc("contracts.discardRequest", { id: other.id }, staff), "Você não tem permissão para fazer isso.") &&
        (await rpc("contracts.discardRequest", { id: randomUUID() }, admin)).status === 404,
      "contracts.discardRequest: only the company's Administrador discards; an unknown request answers 404",
    );
    r = await rpc("contracts.discardRequest", { id: other.id }, admin);
    ok(
      r.body?.message === "Pedido descartado." &&
        (await db.query("select 1 from console_contract_change_requests where id=$1", [other.id])).rowCount === 0,
      "contracts.discardRequest: the Administrador discards a draft",
    );

    // Sending the round.
    ok(
      (await rpc("contracts.submitRequests", { contractId: reviewed }, membro)).status === 404 &&
        (await rpc("contracts.submitRequests", { contractId: foreign }, admin)).status === 404 &&
        refused(await rpc("contracts.submitRequests", { contractId: reviewed }, staff), "Você não tem permissão para fazer isso."),
      "contracts.submitRequests: a Membro or another company answers 404, the team is refused",
    );
    r = await rpc("contracts.submitRequests", { contractId: reviewed }, admin);
    const [sent] = (await db.query("select status from console_contracts where id=$1", [reviewed])).rows;
    ok(
      r.status === 200 &&
        r.body.message === "Pedido enviado. A Anuntech revisa e manda uma nova versão." &&
        sent.status === "in_review" &&
        (await db.query("select status from console_contract_change_requests where id=$1", [saved.id])).rows[0].status === "pending" &&
        (await db.query("select 1 from console_audit_events where entity_id=$1 and action='contract.changes_requested'", [reviewed])).rowCount === 1,
      "contracts.submitRequests: the round goes to Anuntech and the contract is in review",
    );
    if (mailFile) ok(mails().some((m) => m.subject === `Pedido de alteração: ${title}`), "contracts.submitRequests: the team gets the requests by e-mail");
    r = await rpc("contracts.get", { id: reviewed }, admin);
    ok(
      r.body?.statusLabel === "Em revisão" && r.body.review.canRequest === false && r.body.review.requests[0]?.statusLabel === "Aguardando a Anuntech",
      "contracts.get: in review, the round's requests wait for Anuntech",
    );
    ok(
      refused(await rpc("contracts.discardRequest", { id: saved.id }, admin), "Este pedido já foi enviado e fica no histórico.") &&
        refused(
          await rpc("contracts.saveRequest", request, admin),
          "Este contrato não está aguardando assinatura; não há o que revisar agora.",
        ),
      "After sending, requests stay in the history and no new ones are written",
    );

    // Quotes: filters, the whole proposal and its versions.
    const year = 2096;
    // Up to three digits, so the list's search reads it as a number (2096-123).
    const seq = 100 + Math.floor(Math.random() * 800);
    const proposal = (number, version) => ({
      number,
      title: `Portal ${tag}`,
      companyName: "A",
      companyDocument: "0",
      validUntil: "2099-01-01",
      version,
      summary: "Um portal.",
      stack: ["Next.js", "Postgres"],
      phases: [
        {
          name: "Descoberta",
          description: "Entender.",
          hoursMin: 10,
          hoursMax: 20,
          weeks: 2,
          tasks: [{ title: "Reunião", description: "Com a equipe do cliente." }],
        },
      ],
      hourlyRateCents: 10000,
      discountCents: 20000,
      upfrontPercent: 50,
      notes: "",
    });
    const accepted = randomUUID();
    const lapsed = randomUUID();
    const foreignQuote = randomUUID();
    quoteIds.push(accepted, lapsed, foreignQuote);
    const number = `${year}-${String(seq).padStart(3, "0")}`;
    const publication = proposal(number, 2);
    const content = Object.fromEntries(
      ["summary", "stack", "phases", "hourlyRateCents", "discountCents", "upfrontPercent", "notes"].map((key) => [key, publication[key]]),
    );
    await db.query(
      `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash,decided_at,decided_party,decided_name,decided_email,decided_ip,decided_by)
       values($1,$2,$3,$4,$5,$6,$7,'accepted',2,'2099-01-01',now(),$8,$9,now(),'client','Contracts admin',$10,'198.51.100.9',$7)`,
      [accepted, companies.own, year, seq, publication.title, JSON.stringify(content), people.admin.id, JSON.stringify(publication), `qhash-${accepted}-2`, people.admin.email],
    );
    for (const version of [1, 2])
      await db.query(
        "insert into console_quote_versions(id,quote_id,version,publication,document_hash,sent_by) values($1,$2,$3,$4,$5,$6)",
        [randomUUID(), accepted, version, JSON.stringify(proposal(number, version)), `qhash-${accepted}-${version}`, people.admin.id],
      );
    for (const [id, company, offset, validUntil] of [
      [lapsed, companies.own, 1, "2020-01-01"],
      [foreignQuote, companies.other, 2, "2099-01-01"],
    ])
      await db.query(
        `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash)
         values($1,$2,$3,$4,$5,$6,$7,'sent',1,$8,now(),$9,$10)`,
        [id, company, year, seq + offset, `Vencido ${tag}`, JSON.stringify(content), people.admin.id, validUntil, JSON.stringify({ ...publication, validUntil }), `qhash-${id}`],
      );
    r = await rpc("quotes.list", { status: "accepted", search: number }, admin);
    ok(r.status === 200 && r.body.rows.length === 1 && r.body.rows[0].id === accepted, "quotes.list: filters by situation and finds a quote by its number");
    r = await rpc("quotes.list", { status: "expired", search: tag }, admin);
    ok(
      r.status === 200 && r.body.rows.length === 1 && r.body.rows[0].id === lapsed && r.body.rows[0].expired && r.body.rows[0].statusLabel === "Expirado",
      "quotes.list: a quote past its date reads as expired, and never another company's",
    );
    ok((await rpc("quotes.list", { search: tag }, membro)).body?.rows?.length === 0, "quotes.list: a Membro lists no quotes");
    r = await rpc("quotes.get", { id: accepted }, admin);
    ok(
      r.status === 200 &&
        r.body.stack.join() === "Next.js,Postgres" &&
        r.body.hourlyRateCents === 10000 &&
        r.body.subtotalCents === 200000 &&
        r.body.discountCents === 20000 &&
        r.body.discountShare === "10%" &&
        r.body.totalCents === 180000 &&
        r.body.upfrontCents === 90000 &&
        r.body.phases[0].weeks === 2 &&
        r.body.phases[0].tasks[0].description === "Com a equipe do cliente." &&
        !!r.body.sentAt &&
        r.body.decision?.email === people.admin.email &&
        r.body.decision.ip === "198.51.100.9",
      "quotes.get: the whole proposal (stack, rate, discount, weeks, task descriptions) and who answered",
    );
    ok(
      r.body.versions.length === 2 &&
        r.body.versions[0].current &&
        r.body.versions[1].pdfPath === `/api/orcamentos/${accepted}/pdf?versao=1`,
      "quotes.get: versions with their PDFs",
    );
    ok(
      (await rpc("quotes.get", { id: foreignQuote }, admin)).status === 404 && (await rpc("quotes.get", { id: accepted }, membro)).status === 404,
      "quotes.get: another company's quote or a Membro answers 404",
    );
  } finally {
    const ids = Object.values(companies);
    for (const [statement, values] of [
      ["delete from console_contract_change_requests where contract_id=any($1::text[])", [contractIds]],
      ["delete from console_contract_signatures where contract_id=any($1::text[])", [contractIds]],
      ["delete from console_contract_versions where contract_id=any($1::text[])", [contractIds]],
      ["update console_contracts set parent_id=null where id=any($1::text[])", [contractIds]],
      ["delete from console_contracts where id=any($1::text[])", [contractIds]],
      ["delete from console_quote_versions where quote_id=any($1::text[])", [quoteIds]],
      ["delete from console_quotes where id=any($1::text[])", [quoteIds]],
      ["delete from console_automation_events where kind='ops-mail' and details->>'subject' like $1", [`%${tag}%`]],
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
