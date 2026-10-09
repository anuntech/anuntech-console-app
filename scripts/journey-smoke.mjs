import { randomUUID } from "node:crypto";

/**
 * Jornada do projeto (staff only): who sees it, a journey from a lead to a
 * company, the steps the team marks (and the ones only the Console can
 * tick), the briefing, the AI helpers, the proposal drafted from the
 * briefing, extra steps, status and deletion.
 */
export async function runJourneyTests({ database: db, ids, people, request, submitForm, ok, marker, base, notFoundPage }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const ai = (journeyId, who, body, origin = base) =>
    request(`/api/jornadas/${journeyId}/sugestao`, who, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // Only the team sees the journeys.
  const list = await request("/jornadas", "admin");
  ok(list.status === 200 && list.text.includes("Lista de jornadas"), "A equipe abre a lista de jornadas");
  for (const who of ["manager", "support", "finance", "outsider"])
    ok(notFoundPage(await request("/jornadas", who)), `${who} não vê as jornadas`);
  const anonymous = await request("/jornadas");
  ok(anonymous.status >= 300 && anonymous.status < 400, "Sem sessão, a lista de jornadas pede login");

  // A journey for someone who is not a client yet; the client side cannot start one.
  const leadTitle = `Jornada lead ${marker}`;
  await submitForm("/jornadas/nova", "admin", "manager", { action: "startJourney" }, { title: leadTitle, companyId: "", leadName: `Lead ${marker}` });
  ok(!(await one("select id from console_journeys where title=$1", [leadTitle])), "Cliente não começa jornada");
  await submitForm("/jornadas/nova", "admin", "admin", { action: "startJourney" }, { title: leadTitle, companyId: "", leadName: "" });
  ok(!(await one("select id from console_journeys where title=$1", [leadTitle])), "Sem empresa nem contato, a jornada não começa");
  await submitForm("/jornadas/nova", "admin", "admin", { action: "startJourney" }, { title: leadTitle, companyId: "", leadName: `Lead ${marker}`, leadEmail: `lead-${marker}@example.invalid` });
  const lead = await one("select id, company_id, lead, owner_id from console_journeys where title=$1", [leadTitle]);
  ok(!!lead && lead.company_id === null && lead.lead.name === `Lead ${marker}` && lead.owner_id === people.admin.id, "A jornada de um contato começa sem empresa, com quem abriu como responsável");
  let page = await request(`/jornadas/${lead.id}`, "admin");
  ok(page.status === 200 && page.text.includes(`/empresas/nova?jornada=${lead.id}`), "O primeiro passo leva ao cadastro da empresa, de volta para a jornada");
  const denied = await request(`/jornadas/${lead.id}`, "manager");
  ok(notFoundPage(denied) && !denied.text.includes(leadTitle), "Cliente não abre uma jornada nem vê o nome dela");

  // The company registered from the journey is linked to it.
  const document = BigInt(`0x${randomUUID().replaceAll("-", "").slice(0, 11)}`).toString().padStart(14, "0");
  const created = await submitForm("/empresas/nova", "admin", "admin", { action: "createCompany" }, {
    name: `Empresa jornada ${marker}`,
    document,
    billingEmail: `jornada-${marker}@example.invalid`,
    phone: "11987654321",
    journeyId: lead.id,
  });
  const company = await one("select id from console_companies where document=$1", [document]);
  ok(
    created.status === 200 && !!company && (await one("select company_id from console_journeys where id=$1", [lead.id]))?.company_id === company.id,
    "Cadastrar a empresa pela jornada já vincula as duas",
  );

  // A request starts one journey at most.
  const request1 = randomUUID();
  await db.query("insert into console_tickets(id,company_id,subject,author_id,status,kind) values($1,$2,$3,$4,'open','new_project')", [request1, ids.a, `Pedido jornada ${marker}`, people.manager.id]);
  await submitForm("/jornadas/nova", "admin", "admin", { action: "startJourney" }, { title: `Jornada pedido ${marker}`, ticketId: request1 });
  await submitForm("/jornadas/nova", "admin", "admin", { action: "startJourney" }, { title: `Jornada pedido ${marker} 2`, ticketId: request1 });
  ok((await db.query("select id from console_journeys where ticket_id=$1", [request1])).rowCount === 1, "Um pedido começa uma jornada só");
  await db.query("delete from console_journeys where ticket_id=$1", [request1]);
  await db.query("delete from console_audit_events where entity_id=$1", [request1]);
  await db.query("delete from console_tickets where id=$1", [request1]);

  // A journey for an existing company.
  const title = `Jornada QA ${marker}`;
  await submitForm("/jornadas/nova", "admin", "admin", { action: "startJourney" }, { title, companyId: ids.a, ownerId: people.admin.id });
  const journey = await one("select id from console_journeys where title=$1", [title]);
  ok(!!journey, "A equipe começa a jornada de um cliente");
  page = await request(`/jornadas/${journey.id}`, "admin");
  ok(page.text.includes("Contato e descoberta") && page.text.includes("Setup técnico") && page.text.includes("Entrega e pós-entrega"), "A jornada mostra as seis etapas");

  // Steps the team marks: link, note, "não se aplica"; the Console's own steps only take the skip.
  const step = (who, values) => submitForm(`/jornadas/${journey.id}`, "admin", who, { action: "saveJourneyStep" }, { journeyId: journey.id, ...values });
  await step("manager", { key: "repositorio", status: "done", url: "https://github.com/anuntech/qa" });
  ok(!(await one("select id from console_journey_steps where journey_id=$1 and key='repositorio'", [journey.id])), "Cliente não marca passo da jornada");
  await step("admin", { key: "repositorio", status: "done", url: "https://github.com/anuntech/qa", note: "Privado" });
  const repo = await one("select status, url, done_by from console_journey_steps where journey_id=$1 and key='repositorio'", [journey.id]);
  ok(repo?.status === "done" && repo.url === "https://github.com/anuntech/qa" && repo.done_by === people.admin.id, "O passo marcado guarda o link e quem fez");
  await step("admin", { key: "neon", status: "done", note: "postgresql://user:senha@host/db" });
  ok(!(await one("select id from console_journey_steps where journey_id=$1 and key='neon'", [journey.id])), "Senha ou endereço de banco não ficam na jornada");
  await step("admin", { key: "vercel", status: "done", url: "http://vercel.com/anuntech/qa" });
  ok(!(await one("select id from console_journey_steps where journey_id=$1 and key='vercel'", [journey.id])), "Só link https é aceito");
  await step("admin", { key: "orcamento-aceito", status: "done" });
  ok(!(await one("select id from console_journey_steps where journey_id=$1 and key='orcamento-aceito'", [journey.id])), "Passo do Console não é marcado à mão");
  await step("admin", { key: "nda", status: "skipped", note: "" });
  ok(!(await one("select id from console_journey_steps where journey_id=$1 and key='nda'", [journey.id])), "Não se aplica pede o motivo");
  await step("admin", { key: "nda", status: "skipped", note: "Sem pedido de sigilo" });
  ok((await one("select status from console_journey_steps where journey_id=$1 and key='nda'", [journey.id]))?.status === "skipped", "Com o motivo, o passo fica como não se aplica");
  ok(!!(await one("select 1 as ok from console_audit_events where entity_id=$1 and action='journey.step_done'", [journey.id])), "Concluir um passo fica no histórico");

  // The AI helpers: staff only, same origin, drafts only.
  let answer = await ai(journey.id, "admin", { tipo: "briefing", notas: "Cliente quer um app para registrar visitas de vendedores com GPS e fotos." });
  const drafted = JSON.parse(answer.text);
  ok(answer.status === 200 && drafted.briefing?.objetivo && drafted.briefing.funcionalidades.length >= 2, "A IA organiza as notas da reunião em briefing");
  ok((await ai(journey.id, "manager", { tipo: "briefing", notas: "teste" })).status === 403, "Cliente não usa a IA da jornada");
  ok((await ai(journey.id, "admin", { tipo: "briefing", notas: "teste" }, "https://outro.example")).status === 403, "Pedido de outra origem é recusado");
  ok((await ai(journey.id, "admin", { tipo: "briefing", notas: "" })).status === 400, "Sem notas, a IA não organiza");
  answer = await ai(journey.id, "admin", { tipo: "prompt" });
  ok(answer.status === 200 && JSON.parse(answer.text).text.startsWith("# Prompt de início do projeto"), "A IA escreve o prompt de início do projeto");
  answer = await ai(journey.id, "admin", { tipo: "design" });
  ok(answer.status === 200 && JSON.parse(answer.text).design.paleta.length >= 3, "A IA propõe a direção visual");
  answer = await ai(journey.id, "admin", { tipo: "pauta", reuniao: "entrega" });
  ok(answer.status === 200 && JSON.parse(answer.text).text.length > 0, "A IA prepara a pauta da reunião");
  answer = await ai(journey.id, "admin", { tipo: "passo", passo: "cloudflare" });
  ok(answer.status === 200 && JSON.parse(answer.text).text.length > 0, "A IA orienta um passo do setup");
  answer = await ai(journey.id, "admin", { tipo: "lacunas" });
  ok(answer.status === 200 && Array.isArray(JSON.parse(answer.text).passos), "A IA aponta o que pode faltar na jornada");
  ok((await ai(randomUUID(), "admin", { tipo: "prompt" })).status === 404, "Jornada que não existe responde 404");

  // The briefing, as the team saved it; a proposal drafted from it, linked to the journey.
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "saveJourneyBriefing" }, { id: journey.id, briefing: JSON.stringify(drafted.briefing) });
  ok(!!(await one("select briefing->>'objetivo' as o from console_journeys where id=$1", [journey.id]))?.o, "O briefing conferido fica na jornada");
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "saveJourneyAiDraft" }, { journeyId: journey.id, key: "prompt-projeto", kind: "prompt", text: "# Prompt guardado" });
  ok((await one("select ai_draft->>'text' as t from console_journey_steps where journey_id=$1 and key='prompt-projeto'", [journey.id]))?.t === "# Prompt guardado", "O texto da IA fica na jornada só quando a equipe guarda");
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "createJourneyQuote" }, { journeyId: journey.id });
  const linked = await one("select q.id, q.status, q.content->>'summary' as summary from console_journeys j join console_quotes q on q.id = j.quote_id where j.id=$1", [journey.id]);
  ok(!!linked && linked.status === "draft" && linked.summary.startsWith("Objetivo:"), "O orçamento sai em rascunho com o briefing como resumo, vinculado à jornada");
  ok(/journey\\?":\{\\?"id\\?":\\?"/.test((await request(`/orcamentos/${linked.id}`, "admin")).text), "O orçamento sabe a jornada dele");

  // Accepted: the next steps tick themselves and point at the prepared forms.
  const content = { summary: linked.summary, stack: [], phases: [{ name: "Fase 1", description: "", hoursMin: 10, hoursMax: 20, tasks: [{ title: "Tela de login", description: "" }] }], hourlyRateCents: 10000, discountCents: 0, upfrontPercent: 50, notes: "" };
  await db.query("update console_quotes set status='accepted', decided_at=now(), published_at=now(), content=$2, publication=$2 where id=$1", [linked.id, JSON.stringify(content)]);
  page = await request(`/jornadas/${journey.id}`, "admin");
  ok(page.text.includes(`/contratos/novo?orcamento=${linked.id}`) && page.text.includes(`/financeiro/nova?orcamento=${linked.id}&amp;parte=entrada`), "Com o aceite, a jornada oferece o contrato e a entrada preenchidos");

  // Extra steps, the lost status and the Painel.
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "addJourneyStep" }, { journeyId: journey.id, title: "Integração com o ERP", stage: "setup", note: "" });
  const extra = await one("select key from console_journey_steps where journey_id=$1 and key like 'extra:%'", [journey.id]);
  ok(!!extra, "A equipe acrescenta um passo que o padrão não tem");
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "removeJourneyStep" }, { journeyId: journey.id, key: "repositorio" });
  ok(!!(await one("select id from console_journey_steps where journey_id=$1 and key='repositorio'", [journey.id])), "Passo do padrão não é tirado");
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "removeJourneyStep" }, { journeyId: journey.id, key: extra.key });
  ok(!(await one("select id from console_journey_steps where journey_id=$1 and key=$2", [journey.id, extra.key])), "O passo acrescentado pode sair");
  // Stalled counts the proposal too: a quote changed this week keeps the journey moving.
  await db.query("update console_journeys set updated_at = now() - interval '10 days' where id=$1", [journey.id]);
  ok(!(await request("/painel", "admin")).text.includes("Jornadas paradas"), "Orçamento mexido na semana conta como movimento da jornada");
  await db.query("update console_quotes set updated_at = now() - interval '10 days' where id=$1", [linked.id]);
  ok((await request("/painel", "admin")).text.includes("Jornadas paradas"), "O painel lista as jornadas paradas");
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "setJourneyStatus" }, { id: journey.id, status: "lost", reason: "" });
  ok((await one("select status from console_journeys where id=$1", [journey.id]))?.status === "active", "Perdida pede o motivo");
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "setJourneyStatus" }, { id: journey.id, status: "lost", reason: "Cliente desistiu" });
  ok((await one("select status from console_journeys where id=$1", [journey.id]))?.status === "lost", "A jornada fica perdida com o motivo no histórico");
  const activeList = (await request("/jornadas", "admin")).text;
  ok(activeList.includes("Lista de jornadas") && activeList.includes(leadTitle), "A lista em andamento mostra as jornadas ativas");
  ok(!activeList.includes(title), "Perdida sai da lista em andamento");
  ok((await request("/jornadas?situacao=lost", "admin")).text.includes(title), "Perdida aparece no filtro de perdidas");

  // Deleting a journey keeps the proposal; deleting the company takes its journeys.
  await submitForm(`/jornadas/${journey.id}`, "admin", "manager", { action: "deleteJourney" }, { id: journey.id });
  ok(!!(await one("select id from console_journeys where id=$1", [journey.id])), "Cliente não exclui jornada");
  await submitForm(`/jornadas/${journey.id}`, "admin", "admin", { action: "deleteJourney" }, { id: journey.id });
  ok(
    !(await one("select id from console_journeys where id=$1", [journey.id])) &&
      !(await one("select id from console_journey_steps where journey_id=$1", [journey.id])) &&
      !!(await one("select id from console_quotes where id=$1", [linked.id])),
    "Excluir a jornada leva os passos e mantém o orçamento",
  );
  await submitForm(`/empresas/${company.id}`, "admin", "admin", { action: "deleteCompany" }, { id: company.id, confirm: `Empresa jornada ${marker}` });
  if (!(await one("select id from console_companies where id=$1", [company.id])))
    ok(!(await one("select id from console_journeys where id=$1", [lead.id])), "Excluir a empresa leva as jornadas dela");
  else {
    await db.query("delete from console_journey_steps where journey_id=$1", [lead.id]);
    await db.query("delete from console_journeys where id=$1", [lead.id]);
    await db.query("delete from console_audit_events where company_id=$1", [company.id]);
    await db.query("delete from console_companies where id=$1", [company.id]);
  }
  await db.query("delete from console_quote_versions where quote_id=$1", [linked.id]);
  await db.query("delete from console_audit_events where entity_id=$1", [linked.id]);
  await db.query("delete from console_quotes where id=$1", [linked.id]);
}
