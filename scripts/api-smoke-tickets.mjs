// Chamados in the native app, beyond the basics in api-smoke.mjs: files sent
// by /api/v1/anexos (tickets and tasks), replies and tickets with files, the
// ticket's details (priority, Prazos, estimate), approving an estimate, the
// form's preview and the Ajuda's search. Called from api-smoke.mjs with what
// it already has in scope; creates its own companies and people and removes
// them at the end.
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
export async function ticketsChecks({ db, rpc, ok, marker, emailSignIn, staff, base }) {
  const address = (name) => `api-tickets-${name}-${marker}@example.invalid`;
  const companies = { own: randomUUID(), other: randomUUID() };
  const engagements = { chosen: randomUUID(), hidden: randomUUID(), other: randomUUID() };
  const userIds = [];
  const people = {};
  const termsId = randomUUID();
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name),
      membership = randomUUID();
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Tickets ${name}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [membership, company, email, role]);
    people[name] = { id, email, membership };
  }
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  /** The app's upload: raw bytes, the name URL-encoded in a header. */
  const upload = async (cookie, query, body, { type = "image/png", name = "Captura de tela.png", size, method = "POST", headers = {} } = {}) => {
    const response = await fetch(`${base}/api/v1/anexos?${query}`, {
      method,
      headers: {
        ...(type ? { "Content-Type": type } : {}),
        ...(name ? { "X-File-Name": encodeURIComponent(name) } : {}),
        ...(size ? { "X-File-Size": String(size) } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body,
    });
    return { status: response.status, body: await response.json().catch(() => null), cache: response.headers.get("cache-control") };
  };
  const forTicket = `para=chamado&empresa=${companies.own}`;
  const refused = (r, message) => r.status === 400 && r.body?.message === message;
  const ticketIds = [];

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API tickets ${key} ${marker}`,
        companies[key].replaceAll("-", "").slice(0, 14),
        address(`billing-${key}`),
      ]);
    await db.query(
      "insert into console_engagements(id,company_id,name,kind) values($1,$2,'Projeto escolhido','project'),($3,$2,'Projeto de fora','project'),($4,$5,'Outro projeto','project')",
      [engagements.chosen, companies.own, engagements.hidden, engagements.other, companies.other],
    );
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("elsewhere", companies.other, "manager");
    // The Membro sees only the chosen project.
    await db.query("update console_memberships set engagement_access='selected' where id=$1", [people.membro.membership]);
    await db.query("insert into console_membership_engagements(membership_id,engagement_id) values($1,$2)", [people.membro.membership, engagements.chosen]);
    const admin = (await emailSignIn(people.admin.email)).cookie;
    const membro = (await emailSignIn(people.membro.email)).cookie;
    const elsewhere = (await emailSignIn(people.elsewhere.email)).cookie;

    // Sending files: who, where, what.
    let r = await upload(undefined, forTicket, tinyPng);
    ok(r.status === 401 && r.cache?.includes("no-store"), "Sending a file needs the app's session");
    r = await upload(membro, forTicket, tinyPng, { headers: { "Sec-Fetch-Site": "cross-site" } });
    ok(r.status === 403, "A browser on another site cannot send files with the session");
    r = await upload(membro, `para=chamado&empresa=${companies.other}`, tinyPng);
    ok(r.status === 404, "Nobody sends a file for another company's ticket");
    r = await upload(membro, `para=tarefa&projeto=${engagements.hidden}`, tinyPng);
    ok(r.status === 404, "A Membro cannot send a file to a project outside their selection");
    r = await upload(elsewhere, `para=tarefa&projeto=${engagements.chosen}`, tinyPng);
    ok(r.status === 404, "Nobody sends a file to another company's project");
    r = await upload(membro, "para=nada", tinyPng);
    ok(r.status === 404, "A file must say where it goes");
    r = await upload(membro, forTicket, tinyPng, { name: "" });
    ok(r.status === 400, "A file without a name is refused");
    r = await upload(membro, forTicket, Buffer.from("hello"), { type: "text/plain", name: "nota.txt" });
    ok(r.status === 415 && r.body?.error === "Envie um PDF ou uma imagem PNG, JPEG ou WebP válida.", "Only PDF, PNG, JPEG or WebP, in the web's words");
    r = await upload(membro, forTicket, Buffer.from("not really a picture"), { type: "image/png" });
    ok(r.status === 400 && r.body?.error === "Envie um PDF ou uma imagem PNG, JPEG ou WebP válida.", "A file is checked by its bytes, not its type");
    r = await upload(membro, forTicket, tinyPng, { size: 21 * 1024 * 1024 });
    ok(r.status === 413 && r.body?.error === "Escolha um arquivo de até 20 MB.", "Files over 20 MB are refused");
    r = await upload(membro, forTicket, tinyPng);
    ok(
      r.status === 200 && r.body?.uploadId && r.body.mime === "image/webp" && r.body.name === "Captura de tela.webp" && r.body.size > 0,
      "A Membro sends a picture for a ticket; it is stored as WebP",
    );
    const picture = r.body.uploadId;
    r = await upload(membro, `para=tarefa&projeto=${engagements.chosen}`, tinyPng, { name: "tarefa.png" });
    ok(r.status === 200 && r.body?.uploadId, "A Membro sends a file to a task of a project they see");
    const taskFile = r.body.uploadId;
    r = await upload(admin, `para=tarefa&projeto=${engagements.hidden}`, tinyPng, { name: "admin.png" });
    ok(r.status === 200 && r.body?.uploadId, "An Administrador sends a file to any project of the company");
    await fetch(`${base}/api/v1/anexos?id=${r.body.uploadId}`, { method: "DELETE", headers: { Cookie: admin } });
    ok(
      (await db.query("select 1 from console_ticket_uploads where id=$1", [r.body.uploadId])).rowCount === 0,
      "A file removed before sending is dropped",
    );
    await fetch(`${base}/api/v1/anexos?id=${taskFile}`, { method: "DELETE", headers: { Cookie: elsewhere } });
    ok((await db.query("select 1 from console_ticket_uploads where id=$1", [taskFile])).rowCount === 1, "Nobody drops another person's file");

    // A PDF larger than one request, in two parts.
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024 - 9, 32)]);
    const first = pdf.subarray(0, 4 * 1024 * 1024);
    r = await upload(membro, forTicket, first, { type: "application/pdf", name: "Relatório.pdf", size: pdf.length });
    ok(r.status === 200 && r.body?.uploadId && r.body.received === first.length && !r.body.mime, "A big file starts with its first part");
    const big = r.body.uploadId;
    r = await upload(elsewhere, `id=${big}&offset=${first.length}`, pdf.subarray(first.length), { method: "PATCH", type: "application/octet-stream", name: "" });
    ok(r.status === 400 && r.body?.error === "Envio expirado ou incompleto. Tente novamente.", "Nobody continues another person's file");
    r = await upload(membro, `id=${big}&offset=10`, pdf.subarray(first.length), { method: "PATCH", type: "application/octet-stream", name: "" });
    ok(r.status === 400, "A part out of order is refused");
    r = await upload(membro, `id=${big}&offset=${first.length}`, pdf.subarray(first.length), { method: "PATCH", type: "application/octet-stream", name: "" });
    ok(
      r.status === 200 && r.body?.uploadId === big && r.body.mime === "application/pdf" && r.body.size === pdf.length && r.body.name === "Relatório.pdf",
      "The last part completes the file",
    );

    // Opening a ticket with files.
    r = await rpc(
      "tickets.create",
      { companyId: companies.own, kind: "question", subject: `Com anexo ${marker}`, body: "Segue o print.", uploadIds: [picture] },
      membro,
    );
    ok(r.status === 200 && r.body?.id, "A ticket opens with a file from the app");
    const ticketId = r.body.id;
    ticketIds.push(ticketId);
    ok(
      (await db.query("select name, mime from console_attachments where ticket_id=$1", [ticketId])).rows[0]?.mime === "image/webp" &&
        (await db.query("select 1 from console_ticket_uploads where id=$1", [picture])).rowCount === 0,
      "The file joins the ticket and leaves the staging table",
    );
    r = await rpc("tickets.create", { companyId: companies.own, kind: "question", subject: "x", body: "y", uploadIds: [picture] }, membro);
    ok(refused(r, "Os anexos expiraram. Selecione os arquivos novamente."), "A file already used cannot be used again");
    r = await rpc("tickets.create", { companyId: companies.own, kind: "question", subject: "x", body: "y", uploadIds: [taskFile] }, admin);
    ok(r.status === 400 && (await db.query("select 1 from console_ticket_uploads where id=$1", [taskFile])).rowCount === 1, "Nobody uses another person's file");

    // Replies with files, or only files.
    r = await rpc("tickets.reply", { id: ticketId }, membro);
    ok(refused(r, "Escreva uma resposta ou anexe um arquivo."), "A reply needs words or a file, in the web's words");
    r = await rpc("tickets.reply", { id: ticketId, uploadIds: [big] }, elsewhere);
    ok(r.status === 404, "Nobody replies with files on another company's ticket");
    r = await rpc("tickets.reply", { id: ticketId, uploadIds: [big] }, membro);
    ok(
      r.status === 200 &&
        r.body.message === "Anexo enviado." &&
        Number((await db.query("select count(*) from console_attachments where ticket_id=$1", [ticketId])).rows[0].count) === 2 &&
        (await db.query("select 1 from console_audit_events where entity_id=$1 and action='ticket.attachment_added'", [ticketId])).rowCount === 1,
      "A reply can be only a file",
    );
    r = await upload(membro, forTicket, tinyPng, { name: "outro.png" });
    r = await rpc("tickets.reply", { id: ticketId, body: "E mais um.", uploadIds: [r.body.uploadId] }, membro);
    ok(r.status === 200 && r.body.message === "Resposta enviada.", "A reply carries words and a file");
    r = await rpc("tickets.get", { id: ticketId }, membro);
    ok(r.status === 200 && r.body.entries.filter((e) => e.kind === "file").length === 3, "The files show in the conversation");

    // The ticket's details.
    ok(
      r.body.priority === "normal" &&
        r.body.priorityLabel === "Normal" &&
        r.body.companyId === companies.own &&
        r.body.authorEmail === people.membro.email &&
        r.body.impactLabel === null &&
        !!r.body.updatedAt &&
        r.body.clock === null &&
        r.body.estimate === null,
      "The details say priority, who opened it and when it moved; no Prazos or estimate without them",
    );
    await db.query("update console_tickets set priority='high' where id=$1", [ticketId]);
    r = await rpc("tickets.list", { status: "all" }, membro);
    ok(r.body?.rows?.find((row) => row.id === ticketId)?.priority === "high", "The list marks a high priority");
    // Prazos: published conditions show; conditions published later stay hidden from the client.
    const snapshot = (publishAt) => ({
      termsId,
      version: 1,
      label: `Suporte ${marker}`,
      preset: "support",
      policy: {
        levels: false,
        response: { normal: { firstResponseMinutes: 540, goalMinutes: 2700 } },
        pausesWhileWaiting: true,
        tacitAcceptance: false,
        outOfHours: "unspecified",
        includesDevelopment: false,
        clauses: {},
      },
      publishAt,
      personClient: false,
    });
    await db.query(
      "update console_tickets set terms=$2::jsonb, response_due_at=now()+interval '1 day', resolution_due_at=now()+interval '5 days', status='waiting_customer', waiting_since=now() where id=$1",
      [ticketId, JSON.stringify(snapshot(null))],
    );
    r = await rpc("tickets.get", { id: ticketId }, membro);
    ok(
      r.body?.clock?.label === `Suporte ${marker}` &&
        r.body.clock.firstResponse.startsWith("Até ") &&
        r.body.clock.resolution?.startsWith("Até ") &&
        r.body.clock.paused?.startsWith("Prazo pausado desde ") &&
        r.body.priorityLabel === "Alta",
      "Published conditions show the Prazos card, paused while it waits for the client",
    );
    await db.query("update console_tickets set terms=$2::jsonb where id=$1", [ticketId, JSON.stringify(snapshot(new Date(Date.now() + 7 * 86400000).toISOString()))]);
    r = await rpc("tickets.get", { id: ticketId }, membro);
    ok(r.body?.clock === null, "Conditions not yet published stay hidden from the client");
    r = await rpc("tickets.get", { id: ticketId }, staff);
    ok(r.body?.clock?.label === `Suporte ${marker}`, "The team sees them a week earlier, as on the web");

    // The improvement's estimate: an Administrador decides, for the estimate they saw.
    await db.query("update console_tickets set estimate_minutes=90, estimate_status='proposed' where id=$1", [ticketId]);
    r = await rpc("tickets.get", { id: ticketId }, membro);
    ok(
      r.body?.estimate?.amount === "1,5 h" && r.body.estimate.status === "proposed" && r.body.estimate.canApprove === false,
      "A Membro sees the estimate and that an Administrador decides",
    );
    r = await rpc("tickets.get", { id: ticketId }, admin);
    ok(r.body?.estimate?.canApprove === true, "The Administrador can approve it");
    const decide = (cookie, input) => rpc("tickets.decideEstimate", { id: ticketId, decision: "approve", minutes: 90, ...input }, cookie);
    ok(refused(await decide(membro), "Só um Administrador da empresa aprova estimativas."), "A Membro cannot approve, in the web's words");
    ok(refused(await decide(staff), "Só um Administrador da empresa aprova estimativas."), "The team never approves for the client");
    ok((await decide(elsewhere)).status === 404, "Another company's ticket answers 404");
    ok((await rpc("tickets.decideEstimate", { id: randomUUID(), decision: "approve", minutes: 90 }, admin)).status === 404, "An unknown ticket answers 404");
    ok(
      refused(await decide(admin, { minutes: 60 }), "A estimativa mudou ou já foi respondida. Recarregue o chamado."),
      "An answer to an older estimate is refused",
    );
    r = await decide(admin);
    const [decided] = (await db.query("select estimate_status, estimate_decided_by from console_tickets where id=$1", [ticketId])).rows;
    ok(
      r.status === 200 &&
        r.body.message === "Estimativa aprovada. A equipe pode começar." &&
        r.body.status === "approved" &&
        decided.estimate_status === "approved" &&
        decided.estimate_decided_by === people.admin.id &&
        (await db.query("select 1 from console_audit_events where entity_id=$1 and action='ticket.estimate_approved' and actor_id=$2", [ticketId, people.admin.id])).rowCount === 1,
      "The Administrador approves the estimate, with the audit record",
    );
    ok(refused(await decide(admin, { decision: "decline" }), "A estimativa mudou ou já foi respondida. Recarregue o chamado."), "An answered estimate is not answered again");

    // The form's preview: "O que esperar", the change guidance, the conditions in force.
    r = await rpc("tickets.preview", { companyId: companies.own, kind: "question" }, membro);
    ok(r.status === 200 && r.body.expect.dated === false && r.body.changeGuidance === null, "Without conditions the form says when the team works");
    await db.query(
      "insert into console_service_terms(id,company_id,basis,preset,label,policy,verified_at) values($1,$2,'external_contract','support',$3,$4::jsonb,now())",
      [termsId, companies.own, `Suporte ${marker}`, JSON.stringify(snapshot(null).policy)],
    );
    r = await rpc("tickets.preview", { companyId: companies.own, kind: "question" }, membro);
    ok(
      r.status === 200 && r.body.expect.dated && r.body.expect.lines[0].startsWith("Primeira resposta em até 1 dia útil: até "),
      "Published conditions give the first response date",
    );
    r = await rpc("tickets.preview", { companyId: companies.own, kind: "change" }, membro);
    ok(
      r.body?.changeGuidance === "O seu contrato não inclui desenvolvimento. A equipe avalia o pedido e, se fizer sentido, envia um orçamento.",
      "A change gets the contract's guidance",
    );
    r = await rpc("tickets.preview", { companyId: companies.own, kind: "new_project" }, membro);
    ok(r.body?.outOfHours === null && !r.body.expect.dated, "A new project gets a conversation, not a deadline");
    await db.query("update console_service_terms set publish_at=now()+interval '7 days' where id=$1", [termsId]);
    r = await rpc("tickets.preview", { companyId: companies.own, kind: "question" }, membro);
    ok(r.body?.expect?.dated === false, "Conditions not yet published do not promise a date");
    ok((await rpc("tickets.preview", { companyId: companies.other, kind: "question" }, membro)).status === 404, "Another company's preview answers 404");

    // The kinds come with the description hint the web shows.
    r = await rpc("tickets.choices", {}, membro);
    ok(r.body?.kinds?.every((k) => k.placeholder), "Each kind has the description's hint");

    // Help suggestions.
    ok((await rpc("help.search", { q: "boleto" })).status === 401, "The help search needs a session");
    r = await rpc("help.search", { q: "pagar boleto" }, membro);
    ok(r.status === 200 && r.body.length > 0 && r.body.every((a) => a.slug && a.title && a.summary), "The Ajuda's search finds articles");
    r = await rpc("help.search", { q: "bol", for: "ticket" }, membro);
    ok(r.status === 200 && r.body.length === 0, "The form waits for a few letters");
    r = await rpc("help.search", { q: "como convidar um membro para a empresa", for: "question" }, membro);
    ok(r.status === 200 && r.body.length <= 3, "A question gets at most three suggestions");
  } finally {
    const ids = Object.values(companies);
    for (const [statement, values] of [
      ["delete from console_ticket_uploads where author_id=any($1::text[])", [userIds]],
      ["delete from console_push_notices where company_id=any($1::text[])", [ids]],
      ["delete from console_ticket_notices where ticket_id=any($1::text[])", [ticketIds]],
      ["delete from console_attachments where ticket_id=any($1::text[])", [ticketIds]],
      ["delete from console_messages where ticket_id=any($1::text[])", [ticketIds]],
      ["delete from console_tickets where company_id=any($1::text[])", [ids]],
      ["delete from console_service_terms where company_id=any($1::text[])", [ids]],
      ["delete from console_automation_events where company_id=any($1::text[])", [ids]],
      ["delete from console_automation_events where kind='ops-mail' and details->>'subject' like $1", [`%${marker}%`]],
      ["delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [ids, userIds]],
      ["delete from console_membership_engagements where engagement_id=any($1::text[])", [Object.values(engagements)]],
      ["delete from console_memberships where company_id=any($1::text[])", [ids]],
      ["delete from console_engagements where company_id=any($1::text[])", [ids]],
      ["delete from console_session where user_id=any($1::text[])", [userIds]],
      ["delete from console_account where user_id=any($1::text[])", [userIds]],
      ["delete from console_user where id=any($1::text[])", [userIds]],
      ["delete from console_companies where id=any($1::text[])", [ids]],
    ])
      await db.query(statement, values).catch((error) => console.error(`  cleanup: ${statement.slice(0, 60)}… ${error.message}`));
  }
}
