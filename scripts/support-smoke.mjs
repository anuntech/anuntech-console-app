import { randomUUID } from "node:crypto";

/**
 * Automation batch 3: tickets get an owner and a reminder before the first
 * response is late; the team follows up what waits on the client; the hours
 * bank's alert goes once a month and the overage comes ready to bill; Jev
 * and the model only suggest.
 */
export async function runSupportTests({ database: db, ids, people, request, submitForm, sentNotices, ok, marker, base }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const cron = (path) => request(path, undefined, { headers: { Authorization: "Bearer test-cron-secret" } });

  // Every ticket starts with an owner.
  await submitForm("/chamados/novo", "admin", "admin", { action: "createTicket" }, { companyId: ids.a, subject: `Owner by team ${marker}`, body: "Registro feito pela equipe.", kind: "question" });
  ok((await one("select assigned_to from console_tickets where subject=$1", [`Owner by team ${marker}`]))?.assigned_to === people.admin.email.toLowerCase(), "Chamado aberto pela equipe já nasce com ela como responsável");
  await submitForm("/chamados/novo", "admin", "manager", { action: "createTicket" }, { companyId: ids.a, subject: `Owner by client ${marker}`, body: "O sistema parou e não abre para ninguém.", kind: "question" });
  const clientTicket = await one("select id, assigned_to, priority from console_tickets where subject=$1", [`Owner by client ${marker}`]);
  ok(clientTicket?.assigned_to === people.admin.email.toLowerCase(), "Chamado do cliente vai para quem atendeu o último da empresa");

  // Jev reads the text after the answer: a "Dúvida" that says it stopped gets a suggested priority, for the team only.
  let triage = null;
  for (let i = 0; i < 20 && !triage; i++) {
    triage = await one("select details from console_automation_events where kind='ticket.triage' and entity_id=$1", [clientTicket.id]);
    if (!triage) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  ok(triage?.details?.impact === "down" && clientTicket.priority === "normal", "O Jev sugere uma prioridade maior sem mudar a do chamado");
  const asTeam = await request(`/chamados/${clientTicket.id}`, "admin");
  const asClient = await request(`/chamados/${clientTicket.id}`, "manager");
  ok(asTeam.text.includes("Sugestão do Jev") && !asClient.text.includes("Sugestão do Jev"), "Só a equipe vê a sugestão do Jev");

  // The first response: a reminder before the deadline and one when it is late, once each.
  const due = randomUUID();
  await db.query(
    "insert into console_tickets(id,company_id,subject,author_id,assigned_to,status,response_due_at) values($1,$2,$3,$4,$5,'open',now() + interval '30 minutes')",
    [due, ids.a, `Due soon ${marker}`, people.admin.id, people.admin.email],
  );
  let before = sentNotices().length;
  await cron("/api/cron/ticket-notifications");
  await cron("/api/cron/ticket-notifications");
  let reminders = sentNotices().slice(before).filter((n) => String(n.payload?.subject ?? "").includes(`Due soon ${marker}`));
  ok(reminders.length === 1 && String(reminders[0].payload.subject).includes("vence em breve") && reminders[0].payload.to?.[0] === people.admin.email.toLowerCase(), "Lembrete da primeira resposta vai ao responsável, uma vez");
  await db.query("update console_tickets set response_due_at = now() - interval '5 minutes' where id=$1", [due]);
  before = sentNotices().length;
  await cron("/api/cron/ticket-notifications");
  reminders = sentNotices().slice(before).filter((n) => String(n.payload?.subject ?? "").includes(`Due soon ${marker}`));
  ok(reminders.length === 1 && String(reminders[0].payload.subject).includes("atrasada"), "Primeira resposta atrasada avisa de novo, uma vez");

  // Waiting on the client: remind (once a day) or resolve for no reply.
  const waiting = randomUUID();
  await db.query(
    "insert into console_tickets(id,company_id,subject,author_id,status,waiting_for,waiting_since) values($1,$2,$3,$4,'waiting_customer','O print do erro',now() - interval '20 days')",
    [waiting, ids.a, `Waiting ${marker}`, people.admin.id],
  );
  const waitingPage = await request(`/chamados/${waiting}`, "admin");
  ok(waitingPage.text.includes("Lembrar o cliente") && waitingPage.text.includes("Resolver por falta de resposta"), "Chamado parado no cliente oferece lembrar ou resolver");
  await submitForm(`/chamados/${waiting}`, "admin", "manager", { action: "remindClient" }, { ticketId: waiting });
  ok(!(await one("select 1 as ok from console_automation_events where kind='ticket.client_reminder' and entity_id like $1", [`${waiting}:%`])), "Cliente não dispara o lembrete da equipe");
  await submitForm(`/chamados/${waiting}`, "admin", "admin", { action: "remindClient" }, { ticketId: waiting });
  await submitForm(`/chamados/${waiting}`, "admin", "admin", { action: "remindClient" }, { ticketId: waiting });
  ok(
    (await db.query("select id from console_automation_events where kind='ticket.client_reminder' and entity_id like $1", [`${waiting}:%`])).rowCount === 1 &&
      (await db.query("select id from console_audit_events where entity_id=$1 and action='ticket.client_reminded'", [waiting])).rowCount === 1,
    "Lembrar o cliente vale uma vez por dia",
  );
  const painel = await request("/painel", "admin");
  ok(painel.text.includes("Chamados parados no cliente"), "O painel mostra o chamado parado no cliente");
  await submitForm(`/chamados/${waiting}`, "admin", "admin", { action: "closeForNoReply" }, { ticketId: waiting });
  ok(
    (await one("select status from console_tickets where id=$1", [waiting]))?.status === "resolved" &&
      !!(await one("select 1 as ok from console_messages where ticket_id=$1 and body like 'Como não tivemos retorno%'", [waiting])),
    "Resolver por falta de resposta deixa a mensagem padrão e o chamado reabrível",
  );

  // Hours bank: the alert goes once a month; a finished ticket with no hours is listed until someone says so.
  const terms = randomUUID();
  await db.query(
    `insert into console_service_terms(id,company_id,basis,preset,label,policy,verified_by,verified_at,publish_at)
     values($1,$2,'external_contract','support','Suporte QA',$3,$4,now(),now() - interval '1 day')`,
    [
      terms,
      ids.a,
      JSON.stringify({ levels: false, response: { normal: { firstResponseMinutes: 540 } }, pausesWhileWaiting: false, tacitAcceptance: false, outOfHours: "unspecified", includesDevelopment: true, hoursBank: { monthlyMinutes: 600, alertPercent: 80, overageCents: 15000, reportContestDays: null }, clauses: { response: "QA 1" } }),
      people.admin.id,
    ],
  );
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  await db.query("insert into console_time_entries(id,company_id,author_id,minutes,note,worked_on,kind) values($1,$2,$3,540,'Bastante trabalho',$4,'bank')", [randomUUID(), ids.a, people.admin.id, today]);
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "sendBankAlert" }, { companyId: ids.a });
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "sendBankAlert" }, { companyId: ids.a });
  ok(
    (await db.query("select id from console_automation_events where kind='hours.alert' and company_id=$1", [ids.a])).rowCount === 1 &&
      (await db.query("select id from console_audit_events where company_id=$1 and action='hours.alert_sent'", [ids.a])).rowCount === 1,
    "O aviso dos 80% sai uma vez por mês",
  );
  ok((await request(`/empresas/${ids.a}`, "admin")).text.includes("Aviso dos 80% enviado"), "O card do banco diz quando o aviso saiu");
  await db.query("update console_tickets set status='resolved', updated_at=now() where id=$1", [due]);
  let resolvedPage = await request(`/chamados/${due}`, "admin");
  ok(resolvedPage.text.includes("Não houve horas neste chamado"), "Chamado terminado sem horas, com banco, pede o registro");
  await submitForm(`/chamados/${due}`, "admin", "admin", { action: "markNoHours" }, { ticketId: due });
  resolvedPage = await request(`/chamados/${due}`, "admin");
  ok(!resolvedPage.text.includes("Não houve horas neste chamado"), "Marcar sem horas tira o chamado da lista");

  // Last month's overage, past the contest window: ready to bill, once.
  const last = (() => {
    const [y, m] = today.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  })();
  await db.query("insert into console_time_entries(id,company_id,author_id,minutes,note,worked_on,kind) values($1,$2,$3,690,'Mês cheio',$4,'bank')", [randomUUID(), ids.a, people.admin.id, `${last}-10`]);
  await db.query("insert into console_hours_months(id,company_id,month,report_sent_at,report_sent_by) values($1,$2,$3,now() - interval '10 days',$4)", [randomUUID(), ids.a, last, people.admin.id]);
  const card = await request(`/empresas/${ids.a}`, "admin");
  ok(card.text.includes("Excedente do mês passado") && card.text.includes(`/financeiro/nova?excedente=${ids.a}&amp;mes=${last}`), "O card do banco mostra o excedente pronto para cobrar");
  const overageForm = await request(`/financeiro/nova?excedente=${ids.a}&mes=${last}`, "admin");
  ok(overageForm.text.includes('value="overage"') && overageForm.text.includes("225.00"), "A cobrança do excedente sai com 1,5 h × R$ 150,00");
  const overage = {
    companyId: ids.a,
    engagementId: "",
    description: `Excedente QA ${marker}`,
    amount: "225.00",
    dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    billingType: "one_time",
    sourceKind: "overage",
    sourceId: `${ids.a}:${last}`,
  };
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", overage);
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", { ...overage, description: `${overage.description} 2` });
  ok((await db.query("select id from console_invoices where description like $1", [`Excedente QA ${marker}%`])).rowCount === 1, "O excedente do mês é preparado uma vez só");

  // The model drafts; the person sends. Staff only.
  const draft = (who) => request(`/api/chamados/${clientTicket.id}/sugestao`, who, { method: "POST", headers: { Origin: base } });
  let reply = await draft("admin");
  ok(reply.status === 200 && JSON.parse(reply.text).text.startsWith("Rascunho de teste"), "Sugerir resposta devolve um rascunho para a equipe");
  reply = await draft("manager");
  ok(reply.status === 403, "Cliente não pede sugestão de resposta");
  const quoteDraft = randomUUID();
  await db.query(
    "insert into console_quotes(id,company_id,year,seq,title,content,author_id) values($1,$2,2099,$3,$4,$5,$6)",
    [quoteDraft, ids.a, Math.floor(Math.random() * 1e6), `Phases ${marker}`, JSON.stringify({ summary: "Um sistema para controlar ordens de serviço da oficina.", stack: [], phases: [], hourlyRateCents: 0, discountCents: 0, upfrontPercent: 50, notes: "" }), people.admin.id],
  );
  const phases = await request(`/api/orcamentos/${quoteDraft}/fases`, "admin", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ title: `Phases ${marker}`, summary: "Um sistema para controlar ordens de serviço da oficina." }),
  });
  const suggested = JSON.parse(phases.text);
  ok(phases.status === 200 && suggested.phases.length === 2 && suggested.phases[1].hoursMax === 60, "Sugerir fases devolve fases, horas e tarefas para o editor");

  await db.query("delete from console_service_terms where id=$1", [terms]);
}
