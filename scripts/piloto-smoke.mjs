import { randomUUID } from "node:crypto";

/**
 * Piloto automático: an event recorded with the change, the events cron
 * opening one decision for it, the queue running a step through the
 * screen's own action, steps finished elsewhere ticking by themselves, a
 * decision that no longer applies closing alone, and nobody outside the
 * team seeing or deciding anything.
 */
export async function runPilotoTests({ database: db, ids, request, submitForm, ok, marker }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const denied = (r) => r.status === 404 || r.text.includes("NEXT_HTTP_ERROR_FALLBACK;404");
  const cron = () => request("/api/cron/eventos", undefined, { headers: { Authorization: "Bearer test-cron-secret" } });
  const content = {
    summary: "Portal de pedidos",
    stack: ["Next.js"],
    phases: [{ name: "Construção", description: "", hoursMin: 10, hoursMax: 12, weeks: 2, tasks: [{ title: "Pedidos", description: "" }] }],
    hourlyRateCents: 10000,
    discountCents: 0,
    upfrontPercent: 50,
    notes: "",
  };
  const accepted = async (title) => {
    await submitForm("/orcamentos/novo", "admin", "admin", { action: "createQuote" }, { companyId: ids.a, title, validUntil: "", content: JSON.stringify(content), ticketId: "" });
    const quote = await one("select * from console_quotes where title=$1", [title]);
    await submitForm(`/orcamentos/${quote.id}`, "admin", "admin", { action: "sendQuote" }, { id: quote.id });
    await submitForm(`/orcamentos/${quote.id}`, "admin", "finance", { action: "answerQuote" }, { id: quote.id, decision: "accept", consent: "on" });
    return one("select * from console_quotes where id=$1", [quote.id]);
  };

  const quote = await accepted(`Piloto ${marker}`);
  const events = (await db.query("select * from console_events where entity_id=$1", [quote.id])).rows;
  ok(quote.status === "accepted" && events.length === 1 && events[0].type === "quote.accepted" && !events[0].processed_at, "O aceite do orçamento grava o evento na mesma transação");

  ok((await request("/api/cron/eventos", undefined)).status === 401, "A rotina do Piloto pede a chave");
  const run = await cron();
  ok(run.status === 200, "A rotina do Piloto roda");
  await cron();
  const decisions = (await db.query("select * from console_decisions where kind='quote.start' and entity_id=$1", [quote.id])).rows;
  const decision = decisions[0];
  ok(
    decisions.length === 1 &&
      decision.status === "pending" &&
      decision.steps.map((s) => s.key).join(",") === "project,contract,upfront" &&
      (await one("select processed_at from console_events where id=$1", [events[0].id])).processed_at !== null,
    "O orçamento aceito abre uma decisão só, com projeto, contrato e entrada",
  );

  const page = await request("/piloto", "admin");
  ok(page.status === 200 && page.text.includes(decision.title) && page.text.includes("Fazer agora"), "A equipe vê a decisão na fila");
  ok(denied(await request("/piloto", "manager")) && denied(await request("/piloto", "support")), "Cliente não abre o Piloto automático");
  ok((await request("/painel", "admin")).text.includes("Decisões para aprovar"), "O Painel da equipe aponta para a fila");

  // A client posting the queue's action changes nothing.
  await submitForm("/piloto", "admin", "manager", { action: "runDecisionStep" }, { id: decision.id, step: "project" });
  await submitForm("/piloto", "admin", "manager", { action: "dismissDecision" }, { id: decision.id, reason: "Tentativa do cliente" });
  ok(
    !(await one("select 1 as ok from console_engagements where quote_id=$1", [quote.id])) && (await one("select status from console_decisions where id=$1", [decision.id])).status === "pending",
    "Cliente não executa nem dispensa decisões",
  );
  // A link step does not run from the queue.
  await submitForm("/piloto", "admin", "admin", { action: "runDecisionStep" }, { id: decision.id, step: "contract" });
  ok(!(await one("select 1 as ok from console_contracts where quote_id=$1", [quote.id])), "Passo de link não roda pela fila");

  await submitForm("/piloto", "admin", "admin", { action: "runDecisionStep" }, { id: decision.id, step: "project" });
  const project = await one("select * from console_engagements where quote_id=$1", [quote.id]);
  let row = await one("select * from console_decisions where id=$1", [decision.id]);
  ok(
    !!project && row.steps[0].done && !!row.steps[0].doneBy && row.status === "pending" &&
      !!(await one("select 1 as ok from console_audit_events where entity_id=$1 and action='decision.step_done'", [decision.id])),
    "Fazer agora cria o projeto pela ação da tela, como a pessoa que clicou",
  );
  await submitForm("/piloto", "admin", "admin", { action: "runDecisionStep" }, { id: decision.id, step: "project" });
  ok((await one("select count(*)::int as n from console_engagements where quote_id=$1", [quote.id])).n === 1, "O mesmo passo não roda duas vezes");

  // The contract and the down payment finished on their own screens: the decision closes by itself.
  const template = randomUUID();
  await db.query("insert into console_contract_templates(id,name,body,active) values($1,$2,$3,true)", [template, `Piloto QA ${marker}`, "CONTRATO\n\n{{numero_proposta}}"]);
  await submitForm("/contratos/novo", "admin", "admin", { action: "createContract" }, { companyId: ids.a, quoteId: quote.id, templateId: template, engagementId: "", title: "", startsAt: "", endsAt: "" });
  await db.query("insert into console_automation_events(id, kind, entity_id, company_id, details) values($1, 'quote.upfront', $2, $3, '{}'::jsonb)", [randomUUID(), quote.id, ids.a]);
  await cron();
  row = await one("select * from console_decisions where id=$1", [decision.id]);
  ok(row.status === "done" && row.resolution === "mixed" && row.steps.every((s) => s.done), "Passos feitos nas telas fecham a decisão sozinha");
  ok((await request("/piloto", "admin")).text.includes("Resolvida pela fila e pelas telas"), "O histórico mostra como a decisão terminou");

  // A second proposal: dismissed with a reason.
  const second = await accepted(`Piloto dispensa ${marker}`);
  await cron();
  const other = await one("select * from console_decisions where kind='quote.start' and entity_id=$1", [second.id]);
  await submitForm("/piloto", "admin", "admin", { action: "dismissDecision" }, { id: other.id, reason: "x" });
  ok((await one("select status from console_decisions where id=$1", [other.id])).status === "pending", "Dispensar pede um motivo");
  await submitForm("/piloto", "admin", "admin", { action: "dismissDecision" }, { id: other.id, reason: "Cliente vai começar em janeiro" });
  row = await one("select * from console_decisions where id=$1", [other.id]);
  ok(
    row.status === "dismissed" && row.dismiss_reason === "Cliente vai começar em janeiro" && !!row.decided_by &&
      !!(await one("select 1 as ok from console_audit_events where entity_id=$1 and action='decision.dismissed'", [other.id])),
    "A equipe dispensa a decisão com o motivo no histórico",
  );

  // A third one: the proposal goes back to draft, and its decision closes on its own.
  const third = await accepted(`Piloto reaberto ${marker}`);
  await cron();
  await submitForm(`/orcamentos/${third.id}`, "admin", "admin", { action: "revertQuote" }, { id: third.id });
  await cron();
  row = await one("select * from console_decisions where kind='quote.start' and entity_id=$1", [third.id]);
  ok(row.status === "dismissed" && row.dismiss_reason === "O orçamento deixou de estar aceito.", "Orçamento reaberto fecha a decisão sozinha");

  ok((await request("/api/inter/webhook?token=x", undefined, { method: "POST", body: "[]" })).status === 404, "Webhook do Inter fica desligado sem a chave");

  await db.query("delete from console_decisions where entity_id = any($1)", [[quote.id, second.id, third.id]]);
  await db.query("delete from console_events where entity_id = any($1)", [[quote.id, second.id, third.id]]);
  await db.query("update console_contracts set template_id=null where template_id=$1", [template]);
  await db.query("delete from console_contract_templates where id=$1", [template]);
}
