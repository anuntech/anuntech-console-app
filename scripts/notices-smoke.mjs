import { randomUUID } from "node:crypto";

/**
 * Automation batch 4: client notices that go on their own, each behind a
 * switch in Configurações → Automações, each once.
 */
export async function runNoticesTests({ database: db, ids, people, request, submitForm, sentNotices, ok, marker }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const cron = (path) => request(path, undefined, { headers: { Authorization: "Bearer test-cron-secret" } });
  const mailsTo = (before, pattern) => sentNotices().slice(before).filter((n) => n.channel === "email" && pattern.test(String(n.payload?.subject ?? "")));
  const hadProfile = !!(await one("select 1 as ok from console_environment_profile where id='console'"));
  if (!hadProfile)
    await db.query(
      "insert into console_environment_profile(id,name,document,billing_email,updated_at,holidays,automations) values('console','Anuntech QA','11222333000181','qa@example.invalid',now(),'{}','{}')",
    );

  // The switches: staff only, and off means the routine skips it.
  const page = await request("/configuracoes/automacoes", "admin");
  ok(page.status === 200 && page.text.includes("Lembrete de orçamento perto de vencer") && page.text.includes("Triagem do Jev"), "Equipe vê as automações com um interruptor cada");
  const clientPage = await request("/configuracoes/automacoes", "manager");
  ok(clientPage.status !== 200 || !clientPage.text.includes("Lembrete de orçamento perto de vencer"), "Cliente não vê as automações");
  const allOn = Object.fromEntries(["hoursAlert", "hoursReport", "quoteReminder", "contractReminder", "contractSigned", "reviewNotice", "waitingReminder", "weeklySummary", "ticketTriage"].map((k) => [k, "on"]));
  await submitForm("/configuracoes/automacoes", "admin", "manager", { action: "saveAutomations" }, { ...allOn, quoteReminder: "" });
  ok(!Object.keys((await one("select automations from console_environment_profile where id='console'")).automations).length, "Cliente não muda as automações por POST direto");
  const { quoteReminder: _off, ...withoutQuote } = allOn;
  void _off;
  await submitForm("/configuracoes/automacoes", "admin", "admin", { action: "saveAutomations" }, withoutQuote);
  ok((await one("select automations from console_environment_profile where id='console'")).automations.quoteReminder === false, "Desligar uma automação fica salvo");

  // A proposal 2 days from its validity: no reminder while switched off; one, once, when on.
  const quote = randomUUID();
  const validUntil = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 2 * 864e5));
  await db.query(
    `insert into console_quotes(id,company_id,year,seq,title,content,author_id,status,published_version,valid_until,published_at,publication,document_hash)
     values($1,$2,2098,$3,$4,$5,$6,'sent',1,$7,now(),$8,'x')`,
    [
      quote,
      ids.a,
      Math.floor(Math.random() * 1e6),
      `Reminder quote ${marker}`,
      JSON.stringify({ summary: "", stack: [], phases: [], hourlyRateCents: 0, discountCents: 0, upfrontPercent: 50, notes: "" }),
      people.admin.id,
      validUntil,
      JSON.stringify({ summary: "", stack: [], phases: [], hourlyRateCents: 0, discountCents: 0, upfrontPercent: 50, notes: "", title: `Reminder quote ${marker}`, number: "2098-001", companyName: "QA", companyDocument: "", validUntil, version: 1 }),
    ],
  );
  let before = sentNotices().length;
  await cron("/api/cron/client-notices");
  ok(!mailsTo(before, /^Orçamento .* vale até/).length, "Desligado, o lembrete do orçamento não sai");
  await submitForm("/configuracoes/automacoes", "admin", "admin", { action: "saveAutomations" }, allOn);
  before = sentNotices().length;
  await cron("/api/cron/client-notices");
  await cron("/api/cron/client-notices");
  const reminders = mailsTo(before, /^Orçamento .* vale até/);
  ok(reminders.length > 0 && reminders.every((n) => String(n.payload.text).includes(`/orcamentos/${quote}`)) && new Set(reminders.map((n) => n.payload.to[0])).size === reminders.length, "Ligado, o lembrete do orçamento sai uma vez para cada Administrador");

  // A contract sent 8 days ago without the client's signature: one reminder.
  const contract = randomUUID();
  await db.query(
    "insert into console_contracts(id,company_id,title,body,author_id,status,kind,published_version,published_at,document_hash) values($1,$2,$3,'Texto',$4,'sent','contract',1,now() - interval '8 days','hash-qa')",
    [contract, ids.a, `Stalled contract ${marker}`, people.admin.id],
  );
  before = sentNotices().length;
  await cron("/api/cron/client-notices");
  await cron("/api/cron/client-notices");
  const stalled = mailsTo(before, /esperando sua assinatura/);
  ok(stalled.length > 0 && stalled.every((n) => String(n.payload.subject).includes(`Stalled contract ${marker}`)) && new Set(stalled.map((n) => n.payload.to[0])).size === stalled.length, "Contrato parado há 7 dias recebe um lembrete, uma vez");

  // Signed by both sides: the final PDF's link and the next steps, once (the 5-minute routine catches what the action missed).
  await db.query("update console_contracts set status='signed', signed_at=now() where id=$1", [contract]);
  before = sentNotices().length;
  await cron("/api/cron/ticket-notifications");
  await cron("/api/cron/ticket-notifications");
  const signed = mailsTo(before, /^Contrato assinado:/);
  ok(signed.length > 0 && String(signed[0].payload.text).includes(`/contratos/${contract}`) && new Set(signed.map((n) => n.payload.to[0])).size === signed.length, "Contrato assinado pelas duas partes avisa o cliente uma vez");

  // A delivery entered Revisão: one notice listing it.
  const project = randomUUID(), task = randomUUID();
  await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'project')", [project, ids.a, `Review project ${marker}`]);
  await db.query(
    "insert into console_tasks(id,engagement_id,company_id,title,status,created_by,review_since) values($1,$2,$3,$4,'review',$5,now() - interval '1 hour')",
    [task, project, ids.a, `Review card ${marker}`, people.admin.id],
  );
  before = sentNotices().length;
  await cron("/api/cron/client-notices");
  await cron("/api/cron/client-notices");
  const review = mailsTo(before, /para revisar$/);
  ok(review.length > 0 && String(review[0].payload.text).includes(`Review card ${marker}`) && new Set(review.map((n) => n.payload.to[0])).size === review.length, "Entrega em Revisão avisa quem aprova, uma vez");
  const overview = await request("/painel", "finance");
  ok(overview.text.includes("Entregas para você revisar"), "A Visão geral do cliente mostra as entregas para revisar");

  // A ticket waiting on the client for 4 business days: the request goes again through the ticket notices, once.
  const waiting = randomUUID();
  await db.query(
    "insert into console_tickets(id,company_id,subject,author_id,status,waiting_for,waiting_since) values($1,$2,$3,$4,'waiting_customer','A senha do servidor',now() - interval '10 days')",
    [waiting, ids.a, `Waiting auto ${marker}`, people.admin.id],
  );
  await cron("/api/cron/client-notices");
  await cron("/api/cron/client-notices");
  ok(
    (await db.query("select id from console_audit_events where entity_id=$1 and action='ticket.client_reminded'", [waiting])).rowCount === 1,
    "Chamado esperando o cliente recebe um lembrete automático, uma vez",
  );

  await db.query("delete from console_automation_events where entity_id like $1 or entity_id like $2 or entity_id like $3", [`${quote}%`, `${contract}%`, `${task}%`]);
  if (!hadProfile) await db.query("delete from console_environment_profile where id='console'");
}
