import { randomUUID } from "node:crypto";

/**
 * Suspending a product: scheduled with a notice, confirmed by the team on the
 * day, blocked step by step, settled by the payment and reactivated by the
 * team. Runs on its own company, so the other suites' invoices do not count
 * as its debt.
 */
export async function runSuspensionTests({ database: db, people, request, submitForm, sentNotices, ok, marker, companyIds }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const offset = (days) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const cron = (path) => request(path, undefined, { headers: { Authorization: "Bearer test-cron-secret" } });
  const mails = (before, pattern) => sentNotices().slice(before).filter((n) => n.channel === "email" && pattern.test(String(n.payload?.subject ?? "")));
  const open = (engagementId) => one("select *, scheduled_for::text as due from console_engagement_suspensions where engagement_id=$1 and lifted_at is null", [engagementId]);
  const status = async (engagementId) => (await one("select status from console_engagements where id=$1", [engagementId]))?.status;

  const company = randomUUID();
  await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
    company,
    `QA Suspensão ${marker}`,
    BigInt(`0x${company.replaceAll("-", "").slice(0, 11)}`).toString().padStart(14, "0"),
    `qa-suspensao-${marker}@example.invalid`,
  ]);
  // Cleaned up with the run's other companies.
  companyIds.push(company);
  await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,'manager')", [randomUUID(), company, people.manager.email]);
  const item = randomUUID();
  await db.query("insert into console_catalog_items(id,kind,name,suspension_kind) values($1,'product',$2,'vm')", [item, `VM QA ${marker}`]);
  const vm = randomUUID(),
    site = randomUUID();
  await db.query("insert into console_engagements(id,company_id,name,kind,catalog_item_id) values($1,$2,$3,'product',$4)", [vm, company, `VM QA ${marker}`, item]);
  await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'product')", [site, company, `Site QA ${marker}`]);
  // The VM's own conditions: suspension after 15 days late, with a notice first.
  await db.query(
    `insert into console_service_terms(id,company_id,engagement_id,basis,preset,label,policy,verified_by,verified_at,publish_at)
     values($1,$2,$3,'external_contract','infra','Infra QA',$4,$5,now(),now() - interval '1 day')`,
    [
      randomUUID(),
      company,
      vm,
      JSON.stringify({ levels: false, response: { normal: { firstResponseMinutes: 540 } }, pausesWhileWaiting: false, tacitAcceptance: false, outOfHours: "unspecified", includesDevelopment: false, suspensionDays: 15, suspensionNotice: true, clauses: { response: "QA 1", suspension: "QA 5.4" } }),
      people.admin.id,
    ],
  );
  const late = randomUUID();
  await db.query("insert into console_invoices(id,company_id,description,amount_cents,due_date,status,public_id) values($1,$2,$3,25000,$4,'issued',$5)", [
    late,
    company,
    `Suspension debt ${marker}`,
    offset(-20),
    randomUUID().replaceAll("-", ""),
  ]);

  // Only the team suspends; a client or a stranger gets nothing done.
  const form = { engagementId: vm, reason: "overdue", date: offset(3), note: "", notify: "yes" };
  await submitForm("/produtos", "admin", "manager", { action: "prepareSuspension" }, form);
  await submitForm("/produtos", "admin", "outsider", { action: "prepareSuspension" }, form);
  ok(!(await open(vm)), "Cliente e pessoa de fora não suspendem produto");

  // With notice in the clause, never on the same day.
  await submitForm("/produtos", "admin", "admin", { action: "prepareSuspension" }, { ...form, date: today });
  ok(!(await open(vm)) && (await status(vm)) === "active", "Com aviso nas condições, não suspende no mesmo dia");

  let before = sentNotices().length;
  await submitForm("/produtos", "admin", "admin", { action: "prepareSuspension" }, form);
  let row = await open(vm);
  const notice = mails(before, /^Aviso de suspensão/);
  ok(row?.due === offset(3), "A suspensão fica agendada para a data");
  ok(!!row?.notice_sent_at && notice.length > 0 && String(notice[0].payload?.text ?? "").includes("QA 5.4") && String(notice[0].payload?.text ?? "").includes(`Suspension debt ${marker}`), "O aviso sai por e-mail com a cláusula e a fatura vencida");
  ok((await status(vm)) === "active", "Agendada, o produto continua ativo");
  await submitForm("/produtos", "admin", "admin", { action: "prepareSuspension" }, form);
  ok((await db.query("select id from console_engagement_suspensions where engagement_id=$1", [vm])).rowCount === 1, "Só uma suspensão aberta por produto");

  // Before the date it cannot be confirmed; on the day it is, by the team only.
  await submitForm("/produtos", "admin", "admin", { action: "confirmSuspension" }, { id: row.id, notify: "yes" });
  ok((await status(vm)) === "active", "Antes da data, não confirma");
  await db.query("update console_engagement_suspensions set scheduled_for=$2, notice_sent_at=now() - interval '3 days' where id=$1", [row.id, today]);
  let page = await request("/painel", "admin");
  ok(page.text.includes("Suspensões para confirmar hoje"), "No dia, a suspensão aparece no painel da equipe");
  await submitForm("/produtos", "admin", "manager", { action: "confirmSuspension" }, { id: row.id });
  ok((await status(vm)) === "active", "Cliente não confirma suspensão");
  before = sentNotices().length;
  await submitForm("/produtos", "admin", "admin", { action: "confirmSuspension" }, { id: row.id, notify: "yes" });
  ok((await status(vm)) === "suspended" && !!(await open(vm))?.suspended_at && mails(before, /^Serviço suspenso/).length > 0, "Confirmada, o produto fica suspenso e o cliente recebe o aviso");
  ok(!!(await one("select 1 as ok from console_audit_events where entity_id=$1 and action='suspension.suspended'", [vm])), "A suspensão vai para a auditoria");

  // The client sees it and the ways out; pausing or finishing does not get around it.
  page = await request("/produtos", "manager");
  ok(page.text.includes("está suspenso") && page.text.includes("Pagar agora") && page.text.includes("Falar com a equipe"), "O cliente vê o produto suspenso com Pagar agora e Falar com a equipe");
  ok(!page.text.includes("Justificativa"), "O cliente não recebe a visão da equipe");
  ok((await request("/painel", "manager")).text.includes("está suspenso"), "A Visão geral do cliente avisa a suspensão");
  await submitForm("/produtos", "admin", "admin", { action: "updateEngagement" }, { id: vm, status: "completed" });
  ok((await status(vm)) === "suspended", "Um produto suspenso não muda de situação por fora da suspensão");

  // The checklist records who did each step.
  row = await open(vm);
  await submitForm("/produtos", "admin", "manager", { action: "setSuspensionStep" }, { id: row.id, step: "vm-snapshot", done: "yes" });
  await submitForm("/produtos", "admin", "admin", { action: "setSuspensionStep" }, { id: row.id, step: "invented", done: "yes" });
  await submitForm("/produtos", "admin", "admin", { action: "setSuspensionStep" }, { id: row.id, step: "vm-snapshot", done: "yes" });
  row = await open(vm);
  ok(Object.keys(row.steps).join() === "vm-snapshot" && row.steps["vm-snapshot"].by === "QA admin", "Só a equipe marca passos, e só os do tipo do produto");

  // Another product of the same client scheduled without a clause: the team writes why.
  await submitForm("/produtos", "admin", "admin", { action: "prepareSuspension" }, { engagementId: site, reason: "overdue", date: offset(2), note: "" });
  ok(!(await open(site)), "Sem cláusula publicada, pede justificativa");
  await submitForm("/produtos", "admin", "admin", { action: "prepareSuspension" }, { engagementId: site, reason: "overdue", date: offset(2), note: "Sem resposta há três semanas." });
  ok(!!(await open(site)), "Com justificativa, agenda");

  // Still owing: the routine leaves both alone. Paid: the schedule is called off and the suspended one waits for the team.
  await cron("/api/cron/billing-sync");
  ok(!(await open(vm)).settled_at && !!(await open(site)), "Com fatura vencida, nada muda");
  await db.query("update console_invoices set status='paid' where id=$1", [late]);
  await cron("/api/cron/billing-sync");
  const settled = await open(vm);
  ok(!!settled?.settled_at && (await status(vm)) === "suspended", "Pago, a suspensa entra em Pago: reativar e espera a equipe");
  ok(!(await open(site)) && (await one("select lift_reason from console_engagement_suspensions where engagement_id=$1", [site]))?.lift_reason === "cancelled", "Pago antes da data, o agendamento é cancelado");
  ok((await request("/painel", "admin")).text.includes("Clientes que pagaram com produto suspenso"), "O painel da equipe pede a reativação");

  // Reactivating: only the team, with the unblocking steps recorded.
  await submitForm("/produtos", "admin", "manager", { action: "liftSuspension" }, { id: settled.id, notify: "yes" });
  ok((await status(vm)) === "suspended", "Cliente não reativa");
  before = sentNotices().length;
  await submitForm("/produtos", "admin", "admin", { action: "liftSuspension" }, { id: settled.id, notify: "yes", liftStep: ["vm-on", "invented"] });
  const lifted = await one("select * from console_engagement_suspensions where id=$1", [settled.id]);
  ok((await status(vm)) === "active" && lifted.lift_reason === "paid" && !!lifted.steps["vm-on"] && !lifted.steps.invented, "Reativado, com o passo de volta registrado");
  ok(mails(before, /^Serviço reativado/).length > 0, "O cliente recebe o aviso de reativação");

  // A breach of the terms: suspended now with the reason written, reactivated only with what was resolved.
  await submitForm("/produtos", "admin", "admin", { action: "prepareSuspension" }, { engagementId: site, reason: "terms", date: today, note: "Disparo de spam pela caixa comercial." });
  const breach = await open(site);
  ok((await status(site)) === "suspended" && breach?.reason === "terms", "Por descumprimento, suspende na hora com a justificativa");
  await submitForm("/produtos", "admin", "admin", { action: "liftSuspension" }, { id: breach.id, note: "" });
  ok((await status(site)) === "suspended", "Sem dizer o que foi resolvido, não reativa");
  await submitForm("/produtos", "admin", "admin", { action: "liftSuspension" }, { id: breach.id, note: "Cliente trocou a senha e parou os envios." });
  ok((await status(site)) === "active", "Com o que foi resolvido, reativa");

  // The next suites expect the manager in company A only (Membros opens the first company).
  await db.query("delete from console_memberships where company_id=$1", [company]);
}
