import { randomUUID } from "node:crypto";

/**
 * Automation batch 5: invites tracked and resent, record changes reach the
 * team, the client list for the team (invites, onboarding, contacts,
 * access), the cleanup page, the 6-month access review and the guided
 * archive.
 */
export async function runClientsTests({ database: db, ids, people, request, submitForm, sentNotices, ok, marker }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];

  // An invite is recorded with Resend's id; a resend goes once a week, by the team or the company's Administrador.
  const invited = `qa-pending-${marker}@example.invalid`;
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "saveMembership" }, { companyId: ids.a, email: invited, role: "member" });
  const membership = await one("select id from console_memberships where email=$1 and company_id=$2 and active", [invited, ids.a]);
  ok(!!(await one("select 1 as ok from console_automation_events where kind='invite.mail' and details->>'membershipId'=$1", [membership.id])), "O convite fica registrado para conferir a entrega");
  await submitForm(`/empresas/${ids.a}`, "admin", "outsider", { action: "resendInvite" }, { id: membership.id });
  ok(!(await one("select 1 as ok from console_automation_events where kind='invite.resend' and entity_id like $1", [`${membership.id}:%`])), "Quem não administra a empresa não reenvia o convite");
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "resendInvite" }, { id: membership.id });
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "resendInvite" }, { id: membership.id });
  ok(
    (await db.query("select id from console_automation_events where kind='invite.resend' and entity_id like $1", [`${membership.id}:%`])).rowCount === 1 &&
      (await db.query("select id from console_automation_events where kind='invite.mail' and details->>'membershipId'=$1", [membership.id])).rowCount === 2,
    "Reenviar o convite vale uma vez por semana",
  );
  await db.query("update console_memberships set created_at = now() - interval '5 days' where id=$1", [membership.id]);
  let painel = await request("/painel", "admin");
  ok(painel.text.includes("Convites sem primeiro acesso"), "O painel lista o convite parado");

  // The client edits its own billing record: the team hears what changed.
  const company = await one("select * from console_companies where id=$1", [ids.a]);
  const address = company.billing_address ?? {};
  const before = sentNotices().length;
  await submitForm("/configuracoes/empresa", "admin", "manager", { action: "saveCompanySettings" }, {
    id: ids.a,
    name: company.name,
    document: company.document,
    billingEmail: `financeiro-${marker}@example.invalid`,
    phone: company.phone ?? "",
    endereco: address.endereco ?? "",
    numero: address.numero ?? "",
    complemento: address.complemento ?? "",
    bairro: address.bairro ?? "",
    cidade: address.cidade ?? "",
    uf: address.uf ?? "",
    cep: address.cep ?? "",
    codigoMunicipio: address.codigoMunicipio ?? "",
  });
  const change = sentNotices().slice(before).find((n) => String(n.payload?.subject ?? "").startsWith("[Console] Cadastro alterado pelo cliente"));
  ok(!!change && String(change.payload.text).includes(`financeiro-${marker}@example.invalid`), "Mudança no cadastro feita pelo cliente avisa a equipe com o antes e o depois");

  // Onboarding and contacts: what a new client still needs, for the team only.
  const page = await request(`/empresas/${ids.b}`, "admin");
  // Company B got an Administrador when a proposal was sent (handoff tests) who never signed in.
  ok(page.text.includes("Implantação") && page.text.includes("O Administrador ainda não entrou") && !page.text.includes("Convidar o Administrador do cliente"), "A ficha de implantação mostra só o que falta");
  painel = await request("/painel", "admin");
  ok(painel.text.includes("Contatos para revisar"), "O painel lista contatos e documentos para revisar");

  // Cleanup: test-looking records, children first; "Não é teste" keeps one off the list.
  const testCompany = randomUUID();
  const documentOf = (uuid) => BigInt(`0x${uuid.replaceAll("-", "").slice(0, 11)}`).toString().padStart(14, "0");
  await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [testCompany, `Empresa Teste ${marker}`, documentOf(testCompany), `teste-${marker}@example.invalid`]);
  let cleanup = await request("/configuracoes/limpeza", "admin");
  ok(cleanup.text.includes(`Empresa Teste ${marker}`), "A limpeza lista a empresa com cara de teste");
  ok((await request("/configuracoes/limpeza", "manager")).text.includes(`Empresa Teste ${marker}`) === false, "Cliente não vê a limpeza");
  await submitForm("/configuracoes/limpeza", "admin", "admin", { action: "keepRecord" }, { id: testCompany });
  cleanup = await request("/configuracoes/limpeza", "admin");
  ok(!cleanup.text.includes(`Empresa Teste ${marker}`), "Marcar que não é teste tira o registro da lista");

  // Every 6 months the Administrador reviews who has access again.
  await db.query(
    "insert into console_user_milestones(id,user_id,company_id,key,created_at) values($1,$2,$3,'members_reviewed',now() - interval '200 days') on conflict (user_id,company_id,key) do update set created_at = excluded.created_at",
    [randomUUID(), people.manager.id, ids.a],
  );
  const overview = await request("/painel", "manager");
  ok(overview.text.includes("faz 6 meses desde a última revisão"), "A revisão de acessos volta ao Administrador depois de 6 meses");

  // Archiving: only what is ticked winds down with it.
  const leaving = randomUUID(), plan = randomUUID(), item = randomUUID();
  await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [leaving, `Leaving ${marker}`, documentOf(leaving), `leaving-${marker}@example.invalid`]);
  await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'product')", [item, leaving, `Leaving item ${marker}`]);
  await db.query(
    "insert into console_subscriptions(id,company_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,status,actor_id) values($1,$2,$3,9900,'monthly',10,1,current_date + 20,'active',$4)",
    [plan, leaving, `Leaving plan ${marker}`, people.admin.id],
  );
  const archive = await request(`/empresas/${leaving}`, "admin");
  ok(/recurrences\\?":1/.test(archive.text) && /engagements\\?":1/.test(archive.text), "A página da empresa sabe o que ainda está ativo para o arquivamento");
  await submitForm(`/empresas/${leaving}`, "admin", "admin", { action: "setCompanyArchived" }, { id: leaving, archived: "yes", pauseRecurrences: "yes" });
  ok(
    (await one("select status from console_subscriptions where id=$1", [plan]))?.status === "paused" &&
      (await one("select status from console_engagements where id=$1", [item]))?.status === "active" &&
      (await one("select archived from console_companies where id=$1", [leaving]))?.archived === true,
    "Arquivar pausa só o que foi marcado",
  );
  await db.query("delete from console_audit_events where company_id = any($1)", [[leaving, testCompany]]);
  await db.query("delete from console_subscriptions where company_id=$1", [leaving]);
  await db.query("delete from console_engagements where company_id=$1", [leaving]);
  await db.query("delete from console_automation_events where entity_id = $1", [testCompany]);
  await db.query("delete from console_companies where id = any($1)", [[leaving, testCompany]]);
}
