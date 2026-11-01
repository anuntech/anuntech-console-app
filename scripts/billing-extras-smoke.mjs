import { randomUUID } from "node:crypto";
// The server's own business calendar (no imports, so Node loads it as it is).
import { calendar } from "../src/lib/service-terms/business-calendar.ts";

/**
 * Automation batch 6 (billing): the overdue queue with the contact log,
 * payments Inter shows as marked received, an issue with no answer found at
 * the bank, the guided resume of a late recurrence, the month close and the
 * IPCA readjust prepared.
 */
export async function runBillingExtrasTests({ database: db, ids, people, request, submitForm, sentNotices, flags, ok, marker }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const offset = (days) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const cron = (path) => request(path, undefined, { headers: { Authorization: "Bearer test-cron-secret" } });

  // Overdue for 30 days: the queue shows it with a text to send; a promise takes it off until the date.
  const late = randomUUID();
  await db.query(
    "insert into console_invoices(id,company_id,description,amount_cents,due_date,status,provider_id,bank_base,public_id) values($1,$2,$3,15000,$4,'issued',$5,'https://cdpj.partners.bancointer.com.br',$6)",
    [late, ids.a, `Late QA ${marker}`, offset(-30), randomUUID(), randomUUID().replaceAll("-", "")],
  );
  let page = await request("/financeiro/atrasos", "admin");
  ok(page.text.includes(`Late QA ${marker}`) && page.text.includes("Copiar texto") && page.text.includes("Lembretes automáticos encerrados"), "A fila de atrasos mostra o cliente com o texto pronto");
  const clientPage = await request("/financeiro/atrasos", "manager");
  ok(!clientPage.text.includes(`Late QA ${marker}`), "Cliente não vê a fila de atrasos");
  await submitForm("/financeiro/atrasos", "admin", "manager", { action: "registerCollectionContact" }, { companyId: ids.a, note: "Paga na sexta", promiseDate: offset(3) });
  ok(!(await one("select 1 as ok from console_audit_events where action='collection.contact' and company_id=$1", [ids.a])), "Cliente não registra contato de cobrança");
  await submitForm("/financeiro/atrasos", "admin", "admin", { action: "registerCollectionContact" }, { companyId: ids.a, note: "Falou com o financeiro, paga na sexta", promiseDate: offset(3) });
  page = await request("/financeiro/atrasos", "admin");
  ok(page.text.includes("Falou com o financeiro, paga na sexta") && page.text.includes("Pagamento combinado para"), "O contato registrado fica no cliente, com a data combinada");

  // Billed again with a new date to pay, still ahead: not late yet, so not in the queue.
  await db.query(
    "insert into console_invoices(id,company_id,description,amount_cents,due_date,bank_due_date,status,provider_id,bank_base) values($1,$2,$3,8800,$4,$5,'issued',$6,'https://cdpj.partners.bancointer.com.br')",
    [randomUUID(), ids.a, `Rebilled QA ${marker}`, offset(-40), offset(5), randomUUID()],
  );
  page = await request("/financeiro/atrasos", "admin");
  ok(!page.text.includes(`Rebilled QA ${marker}`), "Cobrança feita de novo com boleto ainda válido não entra nos atrasos");

  // Inter shows a charge as marked received by hand: the team confirms how the money came in.
  const marked = randomUUID();
  await db.query(
    "insert into console_invoices(id,company_id,description,amount_cents,due_date,status,bank_status,provider_id,bank_base) values($1,$2,$3,9900,$4,'issued','MARCADO_RECEBIDO',$5,'https://cdpj.partners.bancointer.com.br')",
    [marked, ids.a, `Marked QA ${marker}`, offset(-2), randomUUID()],
  );
  page = await request(`/financeiro/${marked}`, "admin");
  ok(page.text.includes("Marcada como recebida no Inter"), "A fatura marcada como recebida pede a confirmação da equipe");
  page = await request("/financeiro/atrasos", "admin");
  ok(page.text.includes("Marcadas como recebidas no Inter") && page.text.includes(`Marked QA ${marker}`), "Atrasos lista à parte o que o Inter mostra como recebido, para confirmar");
  await submitForm(`/financeiro/${marked}`, "admin", "manager", { action: "confirmPaidOutside" }, { id: marked, note: "Transferência" });
  ok((await one("select status from console_invoices where id=$1", [marked]))?.status === "issued", "Cliente não confirma pagamento fora do boleto");
  await submitForm(`/financeiro/${marked}`, "admin", "admin", { action: "confirmPaidOutside" }, { id: marked, note: "Transferência em 05/10" });
  ok(
    (await one("select status from console_invoices where id=$1", [marked]))?.status === "paid" &&
      (await one("select details->>'note' note from console_audit_events where entity_id=$1 and action='invoice.paid_outside'", [marked]))?.note === "Transferência em 05/10",
    "Confirmado, conta como paga com o motivo registrado",
  );
  // The NFS-e issued by hand is recorded on the invoice, which leaves the list of notes to issue.
  await submitForm(`/financeiro/${marked}`, "admin", "manager", { action: "markFiscalIssued" }, { id: marked, number: "123", url: "" });
  await submitForm(`/financeiro/${marked}`, "admin", "admin", { action: "markFiscalIssued" }, { id: marked, number: "", url: "" });
  ok((await one("select fiscal_status from console_invoices where id=$1", [marked]))?.fiscal_status === "not_requested", "Sem número nem link (ou pelo cliente), a nota não é registrada");
  await submitForm(`/financeiro/${marked}`, "admin", "admin", { action: "markFiscalIssued" }, { id: marked, number: "NFS-e 4521", url: "" });
  ok(
    (await one("select fiscal_status from console_invoices where id=$1", [marked]))?.fiscal_status === "authorized" &&
      (await one("select details->>'number' n from console_audit_events where entity_id=$1 and action='invoice.fiscal_recorded'", [marked]))?.n === "NFS-e 4521",
    "A nota emitida por fora fica registrada na fatura, com o número",
  );
  ok((await request(`/financeiro/${marked}`, "manager")).text.includes("Nota fiscal emitida."), "O cliente vê que a nota foi emitida");

  // The bank took the charge but the answer never came: the Console finds it by its reference and links it.
  await submitForm("/financeiro/nova", "admin", "admin", "Criar rascunho", {
    companyId: ids.a,
    engagementId: "",
    description: `Uncertain QA ${marker}`,
    amount: "77.00",
    dueDate: offset(10),
    billingType: "one_time",
  });
  const uncertain = await one("select id from console_invoices where description=$1", [`Uncertain QA ${marker}`]);
  flags({ approved: true, postTimeout: true });
  await submitForm(`/financeiro/${uncertain.id}`, "admin", "admin", { action: "issueCharge" }, { id: uncertain.id, confirm: "yes", numDiasAgenda: "30" });
  flags({ approved: true });
  ok((await one("select bank_status, provider_id from console_invoices where id=$1", [uncertain.id]))?.bank_status === "RESPOSTA_INDEFINIDA", "Emissão sem resposta fica registrada assim, sem repetir");
  await submitForm(`/financeiro/${uncertain.id}`, "admin", "admin", { action: "locateCharge" }, { id: uncertain.id });
  const located = await one("select provider_id, bank_status from console_invoices where id=$1", [uncertain.id]);
  ok(!!located?.provider_id && located.bank_status !== "RESPOSTA_INDEFINIDA", "Localizar no Inter acha a cobrança pela referência e liga à fatura");

  // A paused recurrence resumed after its due date: the missed periods become drafts, the recurrence goes on from the next one.
  const plan = randomUUID(), planInvoice = randomUUID();
  const missedDue = offset(-20);
  await db.query(
    "insert into console_subscriptions(id,company_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,status,actor_id) values($1,$2,$3,12000,'monthly',$4,$5,$6,'paused',$7)",
    [plan, ids.a, `Paused plan ${marker}`, Number(missedDue.slice(8)), Number(missedDue.slice(5, 7)), missedDue, people.admin.id],
  );
  await db.query(
    "insert into console_invoices(id,company_id,subscription_id,description,amount_cents,due_date,status) values($1,$2,$3,$4,12000,$5,'paid')",
    [planInvoice, ids.a, plan, `Paused plan ${marker} old`, offset(-50)],
  );
  page = await request(`/financeiro/${planInvoice}`, "admin");
  ok(/missed\\?":\[\\?"/.test(page.text), "A fatura da recorrência pausada sabe os vencimentos que passaram");
  await submitForm(`/financeiro/${planInvoice}`, "admin", "admin", { action: "changeSubscription" }, { id: plan, status: "active" });
  ok((await one("select status from console_subscriptions where id=$1", [plan]))?.status === "paused", "Sem escolher o que fazer com o que passou, a recorrência não volta");
  await submitForm(`/financeiro/${planInvoice}`, "admin", "admin", { action: "changeSubscription" }, { id: plan, status: "active", catchUp: "drafts" });
  const resumed = await one("select status, next_due_date::text due from console_subscriptions where id=$1", [plan]);
  const drafts = (await db.query("select due_date::text due, status from console_invoices where description like $1 and subscription_id is null", [`Paused plan ${marker} · vencimento de%`])).rows;
  ok(resumed.status === "active" && resumed.due > today && drafts.length === 1 && drafts[0].due === missedDue && drafts[0].status === "draft", "Retomar cria o rascunho do vencimento perdido e segue do próximo");

  // The routine drafted the period and the bank refused it, then the recurrence paused: resuming uses that draft, never a second one.
  const plan2 = randomUUID(), own = randomUUID();
  const missed2 = offset(-15);
  await db.query(
    "insert into console_subscriptions(id,company_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,status,actor_id) values($1,$2,$3,13000,'monthly',$4,$5,$6,'paused',$7)",
    [plan2, ids.a, `Refused plan ${marker}`, Number(missed2.slice(8)), Number(missed2.slice(5, 7)), missed2, people.admin.id],
  );
  await db.query(
    "insert into console_invoices(id,company_id,subscription_id,description,amount_cents,due_date,status) values($1,$2,$3,$4,13000,$5,'draft')",
    [own, ids.a, plan2, `Refused plan ${marker} period`, missed2],
  );
  page = await request(`/financeiro/${own}`, "admin");
  ok(/drafted\\?":\[\\?"/.test(page.text), "O diálogo sabe que o vencimento já tem o rascunho da rotina");
  await submitForm(`/financeiro/${own}`, "admin", "admin", { action: "changeSubscription" }, { id: plan2, status: "active", catchUp: "drafts" });
  const reused = await one("select subscription_id, bank_due_date::text pay, status from console_invoices where id=$1", [own]);
  ok(
    reused.subscription_id === null && reused.pay > today && reused.status === "draft" &&
      (await one("select count(*)::int n from console_invoices where company_id=$1 and due_date=$2 and status <> 'cancelled' and description like $3", [ids.a, missed2, `Refused plan ${marker}%`]))?.n === 1,
    "Retomar reaproveita o rascunho do período, com nova data para pagar, sem criar outro",
  );

  // The month close goes once, from the daily digest (earlier tests already ran it; running again sends nothing new),
  // and only from the month's first business day on (month-close.ts): on a 1st that is a Sunday before a holiday, it waits.
  await cron("/api/cron/ops-digest");
  await cron("/api/cron/ops-digest");
  const closes = sentNotices().filter((n) => String(n.payload?.subject ?? "").startsWith("[Console] Fechamento de"));
  const seat = calendar((await one("select holidays from console_environment_profile limit 1"))?.holidays ?? {});
  const firstBusinessDay =
    Array.from({ length: 10 }, (_, i) => `${today.slice(0, 8)}${String(i + 1).padStart(2, "0")}`).find((day) => seat.isBusinessDay(day)) ?? `${today.slice(0, 8)}01`;
  if (today < firstBusinessDay) ok(closes.length === 0, "Antes do primeiro dia útil do mês, o fechamento espera");
  else
    ok(
      closes.length > 0 && new Set(closes.map((n) => n.payload.to[0])).size === closes.length && String(closes[0].payload.text).includes("Recebido:"),
      "O fechamento do mês sai uma vez, com o recebido e o em aberto",
    );

  // A contract a year old with its anniversary within 30 days: the readjust by IPCA comes prepared.
  const item = randomUUID(), contract = randomUUID();
  await db.query("insert into console_engagements(id,company_id,name,kind,amount_cents) values($1,$2,$3,'product',10000)", [item, ids.a, `Readjust item ${marker}`]);
  await db.query(
    "insert into console_contracts(id,company_id,title,body,author_id,engagement_id,status,kind,starts_at,signed_at,document_hash) values($1,$2,$3,'CONTRATO',$4,$5,'signed','contract',$6,now() - interval '1 year','x')",
    [contract, ids.a, `Readjust QA ${marker}`, people.admin.id, item, offset(-355)],
  );
  ok((await request(`/contratos/${contract}`, "admin")).text.includes("Preparar reajuste"), "A página do contrato oferece o reajuste do aniversário");
  const form = await request(`/contratos/novo?parentId=${contract}&reajuste=1`, "admin");
  ok(form.text.includes("Reajuste pelo IPCA") && form.text.includes('name="readjust"') && !form.text.includes('name="startsAt"'), "O aditivo de reajuste abre com o IPCA e o novo valor, sem mexer na vigência");
  await submitForm("/contratos/novo", "admin", "admin", { action: "createContract" }, { companyId: ids.a, parentId: contract, templateId: "", engagementId: item, title: "", startsAt: offset(10), endsAt: "", readjust: "yes" });
  const amendment = await one("select id, body, starts_at from console_contracts where parent_id=$1", [contract]);
  ok(
    !!amendment && amendment.body.includes("REAJUSTE") && amendment.body.includes(`Readjust item ${marker}`) && !/\{\{(objeto_reajuste|novo_valor|valor_atual|aniversario)\}\}/.test(amendment.body) && amendment.starts_at === null,
    "O aditivo de reajuste nasce preenchido em rascunho, com o item e sem datas de vigência",
  );
  ok(
    (await one("select details->>'amendmentId' a from console_automation_events where kind='contract.readjust' and entity_id like $1", [`${contract}:%`]))?.a === amendment.id,
    "O reajuste preparado fica registrado para o aniversário",
  );
  ok(!(await request(`/contratos/${contract}`, "admin")).text.includes("Preparar reajuste"), "Com o aditivo em andamento, o reajuste não é oferecido de novo");
  await db.query("delete from console_automation_events where kind='contract.readjust' and entity_id like $1", [`${contract}:%`]);

  await db.query("delete from console_contracts where parent_id=$1", [contract]);
  await db.query("delete from console_contracts where id=$1", [contract]);
  await db.query("delete from console_engagements where id=$1", [item]);
}
