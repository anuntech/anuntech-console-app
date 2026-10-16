import { randomUUID } from "node:crypto";

/**
 * What a Membro sees: no money anywhere, and, when an Administrador narrows it,
 * only the products, services and projects chosen for them (lists, pages,
 * boards, files, requests, the ticket form and the dashboard), enforced on the
 * server. "support" is the company's Membro; "manager" and "finance" are
 * Administradores of company A.
 */
export async function runMemberScopeTests({ database: db, ids, people, request, submitForm, ok, marker, notFoundPage }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const item = randomUUID(),
    product = randomUUID(),
    hiddenProduct = randomUUID(),
    service = randomUUID(),
    projectX = randomUUID(),
    projectY = randomUUID(),
    otherCompanyProject = randomUUID(),
    subscription = randomUUID(),
    taskY = randomUUID(),
    fileY = randomUUID(),
    ticketService = randomUUID(),
    ticketOwn = randomUUID();
  const names = {
    product: `Scope product ${marker}`,
    service: `Scope service ${marker}`,
    projectX: `Scope project X ${marker}`,
    projectY: `Scope project Y ${marker}`,
  };
  await db.query("insert into console_catalog_items(id,kind,name,icon) values($1,'product',$2,'/brand/catalog-icons/synova.webp')", [item, `Scope catalog ${marker}`]);
  await db.query(
    "insert into console_subscriptions(id,company_id,description,amount_cents,interval,anchor_day,anchor_month,next_due_date,status,actor_id) values($1,$2,$3,98765,'monthly',10,1,current_date + 20,'active',$4)",
    [subscription, ids.a, `Scope recurrence ${marker}`, people.admin.id],
  );
  await db.query(
    "insert into console_engagements(id,company_id,name,kind,url,catalog_item_id,amount_cents,subscription_id) values($1,$2,$3,'product','https://example.invalid/scope',$4,98765,$5)",
    [product, ids.a, names.product, item, subscription],
  );
  await db.query("insert into console_engagements(id,company_id,name,kind,amount_cents) values($1,$2,$3,'service',54321)", [service, ids.a, names.service]);
  await db.query("insert into console_engagements(id,company_id,name,kind,url) values($1,$2,$3,'product','https://example.invalid/hidden')", [hiddenProduct, ids.a, `Scope hidden product ${marker}`]);
  for (const [id, name, company] of [
    [projectX, names.projectX, ids.a],
    [projectY, names.projectY, ids.a],
    [otherCompanyProject, `Scope other ${marker}`, ids.b],
  ])
    await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'project')", [id, company, name]);
  await db.query("insert into console_tasks(id,engagement_id,company_id,title,status,created_by) values($1,$2,$3,$4,'todo',$5)", [taskY, projectY, ids.a, `Scope task Y ${marker}`, people.admin.id]);
  await db.query(
    "insert into console_attachments(id,task_id,author_id,name,mime,size,content) values($1,$2,$3,'y.pdf','application/pdf',9,$4)",
    [fileY, taskY, people.admin.id, Buffer.from("%PDF-test")],
  );
  for (const [id, subject, author] of [
    [ticketService, `Scope ticket service ${marker}`, people.admin.id],
    [ticketOwn, `Scope ticket own ${marker}`, people.support.id],
  ])
    await db.query("insert into console_tickets(id,company_id,engagement_id,subject,author_id) values($1,$2,$3,$4,$5)", [id, ids.a, service, subject, author]);

  // Money: a Membro never gets amounts or due dates, not even in the page data.
  let page = await request("/produtos", "support");
  ok(page.status === 200 && page.text.includes(names.product) && page.text.includes(names.service), "O Membro vê os produtos e serviços da empresa");
  ok(!page.text.includes("987,65") && !page.text.includes("Vence em") && !page.text.includes("543,21") && !page.text.includes('"amountCents"'), "O Membro não recebe valor nem vencimento em Produtos");
  ok(page.text.includes("/brand/catalog-icons/synova.webp"), "O produto aparece com o ícone do catálogo");
  page = await request("/produtos", "manager", { headers: { Cookie: `${people.manager.cookie}; console-products-view=list` } });
  ok(page.status === 200 && page.text.includes("987,65"), "O Administrador vê o valor na lista");
  page = await request(`/produtos/${service}`, "support");
  ok(page.status === 200 && page.text.includes(names.service) && !page.text.includes("Cobrança") && !page.text.includes("543,21"), "A página do serviço não mostra cobrança ao Membro");
  page = await request(`/produtos/${service}`, "manager");
  ok(page.status === 200 && page.text.includes("Cobrança") && page.text.includes("543,21"), "O Administrador vê a cobrança do serviço");

  // By default a Membro sees everything of the company, and nothing of another.
  page = await request("/projetos", "support");
  ok(page.text.includes(names.projectX) && page.text.includes(names.projectY) && !page.text.includes(`Scope other ${marker}`), "Sem escolha, o Membro vê todos os projetos da empresa e nenhum de outra");

  // Only an Administrador narrows it, and only to the company's own items.
  const scope = (who, values) =>
    submitForm("/configuracoes/membros", "manager", who, { action: "saveCompanyMember" }, { companyId: ids.a, email: people.support.email, role: "member", ...values });
  await scope("support", { engagementAccess: "selected", engagementIds: [projectX] });
  let membership = await one("select id, engagement_access from console_memberships where company_id=$1 and email=$2 and active", [ids.a, people.support.email]);
  ok(membership.engagement_access === "all", "Um Membro não muda o que ele mesmo vê");
  await scope("manager", { engagementAccess: "selected", engagementIds: [projectX, otherCompanyProject] });
  membership = await one("select id, engagement_access from console_memberships where company_id=$1 and email=$2 and active", [ids.a, people.support.email]);
  ok(membership.engagement_access === "all", "Um item de outra empresa recusa a escolha inteira");
  await scope("manager", { engagementAccess: "selected", engagementIds: [projectX, product] });
  membership = await one("select id, engagement_access from console_memberships where company_id=$1 and email=$2 and active", [ids.a, people.support.email]);
  const chosen = (await db.query("select engagement_id from console_membership_engagements where membership_id=$1 order by engagement_id", [membership.id])).rows.map((r) => r.engagement_id);
  ok(membership.engagement_access === "selected" && chosen.length === 2 && chosen.includes(projectX) && chosen.includes(product), "O Administrador escolhe o que o Membro vê");
  const audit = await one("select details from console_audit_events where action='membership.granted' and entity_id=$1 order by created_at desc limit 1", [membership.id]);
  ok(audit?.details?.engagementAccess === "selected" && audit.details.engagementIds.length === 2, "A escolha fica no histórico");
  page = await request("/configuracoes/membros", "manager");
  ok(page.text.includes("Vê: 2 itens"), "A lista de pessoas mostra o que o Membro vê");

  // Lists, pages and boards follow the choice.
  page = await request("/projetos", "support");
  ok(page.text.includes(names.projectX) && !page.text.includes(names.projectY), "O Membro vê só o projeto escolhido");
  ok(notFoundPage(await request(`/projetos/${projectY}`, "support")), "O quadro de um projeto fora da escolha não abre");
  ok((await request(`/projetos/${projectX}`, "support")).status === 200, "O quadro escolhido abre");
  page = await request("/produtos", "support");
  ok(page.text.includes(names.product) && !page.text.includes(names.service), "Em Produtos, só o que foi escolhido");
  ok(notFoundPage(await request(`/produtos/${service}`, "support")), "A página de um serviço fora da escolha não abre");
  ok((await request(`/api/anexos/${fileY}`, "support")).status === 404, "O anexo de uma tarefa fora da escolha não baixa");
  ok((await request(`/api/anexos/${fileY}`, "manager")).status === 200, "O Administrador baixa o anexo");
  page = await request("/painel", "support");
  ok(
    page.text.includes(names.product) && page.text.includes(names.projectX) && !page.text.includes(names.projectY) && !page.text.includes(names.service),
    "O painel do Membro lista só o que foi escolhido",
  );
  ok(notFoundPage(await request(`/apps/${hiddenProduct}`, "support")), "Um produto fora da escolha não abre como app");
  ok(!notFoundPage(await request(`/apps/${hiddenProduct}`, "manager")), "O Administrador abre o mesmo produto");

  // Requests about products left out stay out, except the ones the Membro opened.
  page = await request("/chamados?status=all", "support");
  ok(!page.text.includes(`Scope ticket service ${marker}`) && page.text.includes(`Scope ticket own ${marker}`), "Chamados sobre itens fora da escolha somem, menos os que o Membro abriu");
  ok(notFoundPage(await request(`/chamados/${ticketService}`, "support")), "O chamado sobre um item fora da escolha não abre");
  ok((await request(`/chamados/${ids.ticketA}`, "support")).status === 200, "Chamado sem produto continua visível");
  page = await request("/chamados/novo", "support");
  ok(page.text.includes(names.product) && !page.text.includes(names.service), "O formulário de chamado oferece só os produtos escolhidos");
  const subject = `Scope forged ticket ${marker}`;
  await submitForm("/chamados/novo", "support", "support", { action: "createTicket" }, { companyId: ids.a, engagementId: service, subject, body: "Teste de acesso." });
  ok(!(await one("select id from console_tickets where subject=$1", [subject])), "Um chamado sobre um item fora da escolha é recusado");

  // Work on a hidden board is refused, and nobody restricted is assigned to it.
  const title = `Scope forged task ${marker}`;
  await submitForm(`/projetos/${projectX}`, "support", "support", { action: "createTask" }, { engagementId: projectY, title });
  ok(!(await one("select id from console_tasks where title=$1", [title])), "O Membro não cria tarefa num projeto fora da escolha");
  const assigned = `Scope assigned task ${marker}`;
  await submitForm(`/projetos/${projectY}`, "admin", "admin", { action: "createTask" }, { engagementId: projectY, title: assigned, assigneeIds: [people.support.id] });
  ok(!(await one("select id from console_tasks where title=$1", [assigned])), "Ninguém atribui ao Membro uma tarefa de projeto que ele não vê");

  // A role edit that does not send the choice keeps it; revoking clears it.
  await submitForm("/configuracoes/membros", "manager", "manager", { action: "saveCompanyMember" }, { companyId: ids.a, email: people.support.email, role: "member" });
  membership = await one("select id, engagement_access from console_memberships where company_id=$1 and email=$2 and active", [ids.a, people.support.email]);
  ok(
    membership.engagement_access === "selected" &&
      Number((await one("select count(*)::int as n from console_membership_engagements where membership_id=$1", [membership.id])).n) === 2,
    "Salvar sem a escolha mantém o que o Membro vê",
  );
  await scope("manager", { engagementAccess: "all" });
  membership = await one("select id, engagement_access from console_memberships where company_id=$1 and email=$2 and active", [ids.a, people.support.email]);
  ok(
    membership.engagement_access === "all" &&
      Number((await one("select count(*)::int as n from console_membership_engagements where membership_id=$1", [membership.id])).n) === 0,
    "Voltar para Tudo da empresa apaga a seleção",
  );
  page = await request("/projetos", "support");
  ok(page.text.includes(names.projectY), "Com Tudo da empresa, o Membro volta a ver todos os projetos");
  // The suite's cleanup deletes tasks and engagements; this fixture's file and catalog item go here.
  await db.query("delete from console_attachments where id=$1", [fileY]);
  await db.query("update console_engagements set catalog_item_id=null where catalog_item_id=$1", [item]);
  await db.query("delete from console_catalog_items where id=$1", [item]);
}
