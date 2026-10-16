import { randomBytes, randomUUID } from "node:crypto";

/**
 * Ajuda: every signed-in person reads every article (what only an Administrador
 * does is marked, and a Membro is told whom to ask), the account menu leads
 * there instead of a dock button, and the tutorial videos are served with a
 * long cache because their names carry a hash. Also what writing the help
 * found wrong on screen: the payment page of a charge the bank closed unpaid,
 * and a concluded delivery that a client could reopen.
 */
export async function runHelpTests({ database: db, ids, people, request, submitForm, ok, marker, notFoundPage }) {
  const anonymous = await request("/ajuda");
  ok(anonymous.status >= 300 && anonymous.status < 400, "Sem sessão, a Ajuda pede login");
  for (const who of ["support", "manager", "admin"]) {
    const page = await request("/ajuda", who);
    ok(page.status === 200 && page.text.includes("Tutoriais em vídeo") && page.text.includes("Perguntas frequentes"), `${who} abre a Ajuda`);
  }
  let page = await request("/ajuda/pagar-uma-fatura", "support");
  ok(page.status === 200 && page.text.includes("Pagar com Pix ou boleto") && page.text.includes("Quem faz isto é um Administrador da sua empresa"), "O Membro lê o artigo do Financeiro e sabe a quem pedir");
  page = await request("/ajuda/pagar-uma-fatura", "manager");
  ok(page.status === 200 && !page.text.includes("Quem faz isto é um Administrador da sua empresa"), "O Administrador lê o artigo sem o aviso do Membro");
  ok(notFoundPage(await request("/ajuda/artigo-que-nao-existe", "support")), "Artigo inexistente responde como página não encontrada");
  page = await request("/ajuda?q=boleto", "support");
  ok(page.status === 200 && page.text.includes("/ajuda/pagar-uma-fatura"), "A busca da Ajuda acha o artigo pelo assunto");
  // The account menu renders only when opened; Como trabalhamos, now part of the help, leads back to it.
  page = await request("/como-trabalhamos", "support");
  ok(page.status === 200 && page.text.includes('href="/ajuda"'), "Como trabalhamos leva de volta à Ajuda");
  const article = await request("/ajuda/abrir-um-chamado", "support");
  const video = /\/ajuda\/videos\/chamado-[0-9a-f]{10}\.mp4/.exec(article.text)?.[0];
  ok(!!video, "O artigo de chamado traz o vídeo");
  const file = await request(video, null, { headers: { Range: "bytes=0-99" } });
  ok([200, 206].includes(file.status), "O vídeo é servido");
  ok((await request(video)).headers.get("cache-control")?.includes("immutable"), "O vídeo tem cache longo pelo nome com hash");

  // The bank closed the boleto and the Pix unpaid: the amount is still owed, and the page says so.
  const expired = randomUUID(),
    cancelled = randomUUID();
  const publicOf = { [expired]: randomBytes(32).toString("base64url"), [cancelled]: randomBytes(32).toString("base64url") };
  for (const [id, provider] of [
    [expired, `exp-${marker}`],
    [cancelled, `can-${marker}`],
  ])
    await db.query(
      "insert into console_invoices(id,company_id,description,amount_cents,due_date,status,bank_status,provider_id,bank_base,public_id) values($1,$2,$3,15000,$4,'cancelled','EXPIRADO',$5,'https://cdpj.partners.bancointer.com.br',$6)",
      [id, ids.a, `Help debt ${marker}`, "2026-09-10", provider, publicOf[id]],
    );
  await db.query(
    "insert into console_audit_events(id,actor_id,company_id,action,entity_id,details) values($1,$2,$3,'invoice.bank_cancelled',$4,$5)",
    [randomUUID(), people.admin.id, ids.a, cancelled, JSON.stringify({ providerId: `can-${marker}` })],
  );
  page = await request(`/pagar/${publicOf[expired]}`);
  ok(page.status === 200 && page.text.includes("Boleto e Pix vencidos") && !page.text.includes("Não é necessário pagar"), "Boleto vencido sem pagamento não diz que não precisa pagar");
  page = await request(`/pagar/${publicOf[cancelled]}`);
  ok(page.status === 200 && page.text.includes("Não é necessário pagar"), "Cobrança cancelada pela equipe diz que não precisa pagar");

  // A concluded delivery stays concluded: reopening it is the team's call.
  const project = randomUUID(),
    task = randomUUID();
  await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'project')", [project, ids.a, `Help project ${marker}`]);
  await db.query("insert into console_tasks(id,engagement_id,company_id,title,status,created_by,approved_by,approved_at) values($1,$2,$3,$4,'done',$5,$6,now())", [
    task,
    project,
    ids.a,
    `Help done ${marker}`,
    people.admin.id,
    people.finance.id,
  ]);
  await submitForm(`/projetos/${project}`, "manager", "manager", { action: "updateTask" }, { id: task, title: `Help done ${marker}`, status: "todo" });
  const row = (await db.query("select status, approved_by from console_tasks where id=$1", [task])).rows[0];
  ok(row.status === "done" && row.approved_by === people.finance.id, "O cliente não tira uma entrega de Concluído nem apaga a aprovação");
  for (const id of [expired, cancelled]) await db.query("delete from console_audit_events where entity_id=$1", [id]);
}
