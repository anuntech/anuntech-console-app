import { randomUUID } from "node:crypto";

/**
 * Automation batch 2: an accepted proposal becomes a contract, a project
 * and its charges; a signed contract prepares its recurrence, its
 * conditions and its extension; nobody is left without an Administrador.
 */
export async function runHandoffTests({ database: db, ids, people, request, submitForm, sentNotices, ok, marker }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const content = {
    summary: "Controle de ordens de serviço",
    stack: ["Next.js", "Postgres"],
    phases: [
      { name: "Descoberta", description: "Entender o fluxo", hoursMin: 8, hoursMax: 10, weeks: 1, tasks: [{ title: "Entrevistas", description: "" }] },
      { name: "Construção", description: "", hoursMin: 30, hoursMax: 40, weeks: 3, tasks: [{ title: "Cadastro de OS", description: "" }, { title: "Relatórios", description: "" }] },
    ],
    hourlyRateCents: 10000,
    discountCents: 0,
    upfrontPercent: 50,
    notes: "",
  };

  // The client's request: the proposal starts from the ticket and stays linked to it.
  const fromTicket = await request(`/orcamentos/novo?companyId=${ids.a}&chamado=${ids.ticketA}`, "admin");
  ok(fromTicket.text.includes("Pedido do chamado") && fromTicket.text.includes(`name="ticketId"`), "Orçamento aberto do chamado leva o pedido junto");
  const title = `Handoff quote ${marker}`;
  await submitForm("/orcamentos/novo", "admin", "admin", { action: "createQuote" }, {
    companyId: ids.a,
    title: `${title} B`,
    validUntil: "",
    content: JSON.stringify(content),
    ticketId: ids.ticketB,
  });
  ok(!(await one("select 1 as ok from console_quotes where title=$1", [`${title} B`])), "Orçamento não se liga a chamado de outra empresa");
  await submitForm("/orcamentos/novo", "admin", "admin", { action: "createQuote" }, {
    companyId: ids.a,
    title,
    validUntil: "",
    content: JSON.stringify(content),
    ticketId: ids.ticketA,
  });
  let quote = await one("select * from console_quotes where title=$1", [title]);
  ok(quote?.ticket_id === ids.ticketA, "Orçamento guarda o chamado de origem");
  const quotePath = `/orcamentos/${quote.id}`;
  await submitForm(quotePath, "admin", "admin", { action: "sendQuote" }, { id: quote.id });
  await submitForm(quotePath, "assisted", "assisted", { action: "answerQuote" }, { id: quote.id, decision: "accept", consent: "on" });
  ok((await one("select status from console_quotes where id=$1", [quote.id])).status === "sent", "Equipe no acesso assistido não aceita o orçamento pelo cliente");
  await submitForm(quotePath, "admin", "finance", { action: "answerQuote" }, { id: quote.id, decision: "accept", consent: "on" });
  quote = await one("select * from console_quotes where id=$1", [quote.id]);
  ok(quote.status === "accepted", "Cliente aceita o orçamento");
  let page = await request(quotePath, "admin");
  ok(
    page.text.includes(`/contratos/novo?orcamento=${quote.id}`) &&
      page.text.includes(`/financeiro/nova?orcamento=${quote.id}&amp;parte=entrada`) &&
      page.text.includes("Criar projeto com o quadro das fases") &&
      page.text.includes(`/chamados/${ids.ticketA}?resposta=`),
    "Orçamento aceito mostra contrato, projeto, cobranças e a resposta no chamado prontos",
  );
  const clientPage = await request(quotePath, "finance");
  ok(!clientPage.text.includes("Criar projeto com o quadro das fases"), "Cliente não vê os passos da equipe");
  const reply = await request(`/chamados/${ids.ticketA}?resposta=${encodeURIComponent(`Resposta pronta ${marker}`)}`, "admin");
  const replyClient = await request(`/chamados/${ids.ticketA}?resposta=${encodeURIComponent(`Resposta pronta ${marker}`)}`, "manager");
  // The URL itself travels in the page data; what matters is the reply box.
  const inBox = (html) => html.includes(`>Resposta pronta ${marker}</textarea>`);
  ok(inBox(reply.text) && !inBox(replyClient.text), "A resposta pronta só aparece para a equipe, como rascunho");

  // Contract from the proposal: scope, stack and timeline fill the template's fields, once.
  const devTemplate = randomUUID();
  await db.query("insert into console_contract_templates(id,name,body,active) values($1,$2,$3,true)", [
    devTemplate,
    `Desenvolvimento QA ${marker}`,
    "CONTRATO DE DESENVOLVIMENTO\n\nCLÁUSULA 1 — OBJETO\n1.1. Proposta {{numero_proposta}}.\n1.2. Escopo: {{escopo_funcional}}\n1.3. Tecnologias: {{tecnologias}}.\n1.4. Prazo: {{prazo_de_entrega}}.",
  ]);
  const form = await request(`/contratos/novo?orcamento=${quote.id}`, "admin");
  ok(form.text.includes("A partir do orçamento aceito") && form.text.includes(`name="quoteId"`), "Novo contrato parte do orçamento aceito");
  const fromQuote = { companyId: ids.a, quoteId: quote.id, templateId: devTemplate, engagementId: "", title: "", startsAt: "", endsAt: "" };
  await submitForm("/contratos/novo", "admin", "admin", { action: "createContract" }, fromQuote);
  await submitForm("/contratos/novo", "admin", "admin", { action: "createContract" }, fromQuote);
  const linked = (await db.query("select * from console_contracts where quote_id=$1", [quote.id])).rows;
  ok(
    linked.length === 1 &&
      linked[0].body.includes("P1-01 Entrevistas") &&
      linked[0].body.includes("Next.js, Postgres") &&
      linked[0].body.includes("4 semanas") &&
      !linked[0].body.includes("{{"),
    "Contrato sai preenchido com o escopo, a stack e o prazo do orçamento, uma vez só",
  );
  const contract = linked[0];
  // An accepted proposal that a contract came from keeps its version: edits go to a copy.
  await submitForm(quotePath, "admin", "admin", { action: "revertQuote" }, { id: quote.id });
  ok((await one("select status from console_quotes where id=$1", [quote.id])).status === "accepted", "Orçamento aceito com contrato não volta para rascunho");

  // Entrada prepared from the proposal, once; cancelling the draft lets it be prepared again.
  const upfrontForm = await request(`/financeiro/nova?orcamento=${quote.id}&parte=entrada`, "admin");
  ok(upfrontForm.text.includes("Entrada do orçamento") && upfrontForm.text.includes('value="quote_upfront"'), "Cobrança da entrada sai preenchida");
  const upfront = {
    companyId: ids.a,
    engagementId: "",
    description: `Entrada handoff ${marker}`,
    amount: "2500.00",
    dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    billingType: "one_time",
    sourceKind: "quote_upfront",
    sourceId: quote.id,
  };
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", upfront);
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", { ...upfront, description: `${upfront.description} 2` });
  let charges = (await db.query("select id, quote_id from console_invoices where description like $1", [`Entrada handoff ${marker}%`])).rows;
  ok(charges.length === 1 && charges[0].quote_id === quote.id, "A entrada fica ligada ao orçamento e é preparada uma vez só");
  await submitForm(`/financeiro/${charges[0].id}`, "admin", "admin", { action: "cancelDraft" }, { id: charges[0].id });
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", { ...upfront, description: `${upfront.description} 3` });
  charges = (await db.query("select id from console_invoices where description=$1", [`${upfront.description} 3`])).rows;
  ok(charges.length === 1, "Cancelar o rascunho da entrada deixa preparar de novo");
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", { ...upfront, description: `Entrada alheia ${marker}`, companyId: ids.b, sourceId: quote.id });
  ok(!(await one("select 1 as ok from console_invoices where description=$1", [`Entrada alheia ${marker}`])), "Orçamento de outra empresa não vira cobrança");

  // The project with the board of the phases, once.
  await submitForm(quotePath, "admin", "manager", { action: "createProjectFromQuote" }, { id: quote.id });
  ok(!(await one("select 1 as ok from console_engagements where quote_id=$1", [quote.id])), "Cliente não cria projeto a partir do orçamento");
  await submitForm(quotePath, "admin", "admin", { action: "createProjectFromQuote" }, { id: quote.id });
  await submitForm(quotePath, "admin", "admin", { action: "createProjectFromQuote" }, { id: quote.id });
  const projects = (await db.query("select id from console_engagements where quote_id=$1", [quote.id])).rows;
  const cards = projects.length ? (await db.query("select title, labels, status from console_tasks where engagement_id=$1 order by position", [projects[0].id])).rows : [];
  ok(
    projects.length === 1 &&
      cards.length === 5 &&
      cards[0].title === "Acessos" &&
      cards[2].title === "P1-01 Entrevistas" &&
      cards[3].labels[0] === "Construção" &&
      cards.every((c) => c.status === "todo"),
    "Projeto nasce com o quadro das fases, uma vez só",
  );

  // Signed by the client first: the team hears it, and the morning digest lists it.
  await submitForm(`/contratos/${contract.id}`, "admin", "admin", { action: "sendContract" }, { id: contract.id });
  await submitForm(`/contratos/${contract.id}`, "assisted", "assisted", { action: "signContract" }, { id: contract.id, consent: "on" });
  ok(
    (await db.query("select id from console_contract_signatures where contract_id=$1", [contract.id])).rowCount === 0,
    "Equipe no acesso assistido não assina o contrato pelo cliente",
  );
  const before = sentNotices().length;
  await submitForm(`/contratos/${contract.id}`, "admin", "finance", { action: "signContract" }, { id: contract.id, consent: "on" });
  const signedMail = sentNotices().slice(before).find((n) => String(n.payload?.subject ?? "").includes("falta a Anuntech"));
  ok(!!signedMail && String(signedMail.payload.text).includes(`/contratos/${contract.id}`), "Assinatura do cliente avisa a equipe que falta a Anuntech");
  const digestBefore = sentNotices().length;
  await request("/api/cron/ops-digest", undefined, { headers: { Authorization: "Bearer test-cron-secret" } });
  const digest = sentNotices().slice(digestBefore).find((n) => String(n.payload?.subject ?? "").startsWith("[Console]"));
  ok(String(digest?.payload.text ?? "").includes("Assinados pelo cliente, falta a Anuntech") && String(digest?.payload.text ?? "").includes(contract.title), "O resumo da manhã lista o contrato que espera a Anuntech");
  const painel = await request("/painel", "admin");
  ok(painel.text.includes("Falta a assinatura da Anuntech"), "O painel da equipe mostra o contrato que espera a Anuntech");

  // A signed licence: recurrence, conditions and extension come prepared.
  const licenceTemplate = randomUUID(), licenceItem = randomUUID(), licence = randomUUID();
  await db.query("insert into console_contract_templates(id,name,body,active) values($1,$2,'CONTRATO',true)", [licenceTemplate, `Licença de uso do Synova QA ${marker}`]);
  await db.query("insert into console_engagements(id,company_id,name,kind,amount_cents) values($1,$2,$3,'product',9900)", [licenceItem, ids.a, `Synova QA ${marker}`]);
  const ends = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  await db.query(
    "insert into console_contracts(id,company_id,title,body,author_id,template_id,engagement_id,status,kind,starts_at,ends_at,signed_at,document_hash) values($1,$2,$3,'CONTRATO',$4,$5,$6,'signed','contract',$7,$8,now(),'x')",
    [licence, ids.a, `Licença QA ${marker}`, people.admin.id, licenceTemplate, licenceItem, new Date(Date.now() - 345 * 864e5).toISOString().slice(0, 10), ends],
  );
  page = await request(`/contratos/${licence}`, "admin");
  ok(
    page.text.includes(`/financeiro/nova?contrato=${licence}`) &&
      page.text.includes("Preparar condições de atendimento") &&
      page.text.includes(`/contratos/novo?parentId=${licence}&amp;prorrogar=1`),
    "Contrato assinado oferece recorrência, condições e prorrogação prontas",
  );
  const recurrenceForm = await request(`/financeiro/nova?contrato=${licence}`, "admin");
  ok(recurrenceForm.text.includes('value="contract"') && recurrenceForm.text.includes("99.00"), "Recorrência sai preenchida com o valor do item");
  await submitForm(`/contratos/${licence}`, "admin", "admin", { action: "prepareServiceTerms" }, { contractId: licence });
  await submitForm(`/contratos/${licence}`, "admin", "admin", { action: "prepareServiceTerms" }, { contractId: licence });
  const terms = (await db.query("select preset, verified_at, contract_id from console_service_terms where contract_id=$1", [licence])).rows;
  ok(terms.length === 1 && terms[0].preset === "synova" && !terms[0].verified_at, "Condições nascem em rascunho com a ficha do modelo, uma vez só");
  const renewal = await request(`/contratos/novo?parentId=${licence}&prorrogar=1`, "admin");
  ok(renewal.text.includes('name="renewal"') && renewal.text.includes("A prorrogação começa no dia seguinte"), "Prorrogação abre com a nova vigência");

  // Nobody to sign at company B: the send dialog's e-mail becomes its Administrador first.
  const lonely = `Lonely quote ${marker}`;
  await submitForm("/orcamentos/novo", "admin", "admin", { action: "createQuote" }, { companyId: ids.b, title: lonely, validUntil: "", content: JSON.stringify(content) });
  const lonelyQuote = await one("select id from console_quotes where title=$1", [lonely]);
  const draftPage = await request(`/orcamentos/${lonelyQuote.id}`, "admin");
  // The dialog renders when opened; the page carries who to suggest.
  ok(/suggestion\\?":\\?"qa-B@example\.invalid/.test(draftPage.text), "Envio para empresa sem Administrador pede quem convidar");
  const invited = `qa-invited-${marker}@example.invalid`;
  await submitForm(`/orcamentos/${lonelyQuote.id}`, "admin", "admin", { action: "sendQuote" }, { id: lonelyQuote.id, inviteEmail: invited });
  ok(
    (await one("select role from console_memberships where company_id=$1 and email=$2 and active", [ids.b, invited]))?.role === "manager" &&
      (await one("select status from console_quotes where id=$1", [lonelyQuote.id]))?.status === "sent",
    "A pessoa indicada vira Administrador e o orçamento sai",
  );

  // A new version, like a contract before signature: a declined or an accepted proposal with nothing made
  // from it reopens with the same number; the answer goes to the history and the next send asks again.
  for (const decision of ["decline", "accept"]) {
    const versionTitle = `Versão ${decision} ${marker}`;
    await submitForm("/orcamentos/novo", "admin", "admin", { action: "createQuote" }, {
      companyId: ids.a,
      title: versionTitle,
      validUntil: "",
      content: JSON.stringify(content),
    });
    const draft = await one("select * from console_quotes where title=$1", [versionTitle]);
    const path = `/orcamentos/${draft.id}`;
    await submitForm(path, "admin", "admin", { action: "sendQuote" }, { id: draft.id });
    await submitForm(path, "admin", "finance", { action: "answerQuote" }, { id: draft.id, decision, consent: "on", note: "Primeira resposta" });
    const answered = await one("select * from console_quotes where id=$1", [draft.id]);
    await submitForm(path, "admin", "admin", { action: "revertQuote" }, { id: draft.id });
    const reopened = await one("select * from console_quotes where id=$1", [draft.id]);
    const history = await one("select details from console_audit_events where entity_id=$1 and action='quote.reverted' order by created_at desc limit 1", [draft.id]);
    ok(
      answered.status === (decision === "accept" ? "accepted" : "declined") &&
        reopened.status === "draft" &&
        reopened.seq === answered.seq &&
        reopened.decided_at === null &&
        history?.details?.answer?.status === answered.status &&
        history.details.answer.note === "Primeira resposta" &&
        history.details.answer.hash === answered.document_hash,
      `Orçamento ${decision === "accept" ? "aceito sem contrato" : "recusado"} ganha nova versão e guarda a resposta no histórico`,
    );
    await submitForm(path, "admin", "admin", { action: "sendQuote" }, { id: draft.id });
    const resent = await one("select status, published_version from console_quotes where id=$1", [draft.id]);
    ok(resent.status === "sent" && resent.published_version === answered.published_version + 1, "O novo envio vira a versão seguinte e espera nova resposta");
  }

  // Clean what the global cleanup cannot reach: templates and conditions tied to contracts.
  await db.query("delete from console_service_terms where contract_id = any($1)", [[licence, contract.id]]);
  await db.query("update console_contracts set template_id=null where template_id = any($1)", [[devTemplate, licenceTemplate]]);
  await db.query("delete from console_contract_templates where id = any($1)", [[devTemplate, licenceTemplate]]);
}
