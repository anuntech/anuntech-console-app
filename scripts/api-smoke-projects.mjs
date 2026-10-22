// Projetos in the native app: the list's filters, the board, a task's detail
// and every board change (requests, edits, columns, files, comments, deletion
// and activity), with the web's rules through /api/v1. Called from
// api-smoke.mjs with what it already has in scope; creates its own companies,
// people and projects and removes them at the end.
import { randomUUID } from "node:crypto";

/**
 * @param {{
 *   db: import("pg").Pool,
 *   rpc: (path: string, input: unknown, cookie?: string, headers?: Record<string, string>) => Promise<{ status: number, body: any }>,
 *   ok: (condition: unknown, message: string) => void,
 *   marker: string,
 *   emailSignIn: (email: string) => Promise<{ status: number, body: any, cookie: string }>,
 *   staff: string,
 *   base: string,
 * }} ctx
 */
export async function projectsChecks({ db, rpc, ok, marker, emailSignIn, staff, base }) {
  const address = (name) => `api-projects-${name}-${marker}@example.invalid`;
  const companies = { own: randomUUID(), other: randomUUID() };
  const projects = { main: randomUUID(), side: randomUUID(), paused: randomUUID(), foreign: randomUUID() };
  const userIds = [];
  const people = {};
  const blocked = "Você não tem permissão para fazer isso.";
  const refused = (r, message) => r.status === 400 && r.body?.message === message;
  const taskRow = async (id) => (await db.query("select * from console_tasks where id=$1", [id])).rows[0];
  async function person(name, company, role, selected) {
    const id = randomUUID(),
      email = address(name),
      membership = randomUUID();
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Projetos ${name}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role,engagement_access) values($1,$2,$3,$4,$5)", [
      membership,
      company,
      email,
      role,
      selected ? "selected" : "all",
    ]);
    for (const engagement of selected ?? [])
      await db.query("insert into console_membership_engagements(membership_id,engagement_id) values($1,$2)", [membership, engagement]);
    people[name] = { id, email };
  }
  /** A staged upload, as POST /api/v1/anexos leaves it: ready, owned by the person, valid for an hour. */
  async function upload(authorId, name = "briefing.pdf") {
    const id = randomUUID();
    const content = Buffer.from(`%PDF-1.4\n% ${marker}\n`);
    await db.query(
      "insert into console_ticket_uploads(id,author_id,name,expected_size,received_size,content,mime,ready,expires_at) values($1,$2,$3,$4,$4,$5,'application/pdf',true,now()+interval '1 hour')",
      [id, authorId, name, content.length, content],
    );
    return id;
  }

  try {
    for (const [key, id] of Object.entries(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        id,
        `API projects ${key} ${marker}`,
        (randomUUID().replace(/\D/g, "") + "48201937465012").slice(0, 14),
        address(`billing-${key}`),
      ]);
    for (const [id, company, name, status] of [
      [projects.main, companies.own, `Portal ${marker}`, "active"],
      [projects.side, companies.own, `Aplicativo ${marker}`, "active"],
      [projects.paused, companies.own, `Pausado ${marker}`, "paused"],
      [projects.foreign, companies.other, `Outro ${marker}`, "active"],
    ])
      await db.query("insert into console_engagements(id,company_id,name,kind,status) values($1,$2,$3,'project',$4)", [id, company, name, status]);
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("scoped", companies.own, "member", [projects.side]);
    await person("elsewhere", companies.other, "manager");
    const admin = (await emailSignIn(people.admin.email)).cookie;
    const membro = (await emailSignIn(people.membro.email)).cookie;
    const scoped = (await emailSignIn(people.scoped.email)).cookie;
    const elsewhere = (await emailSignIn(people.elsewhere.email)).cookie;
    const late = randomUUID();
    await db.query(
      "insert into console_tasks(id,engagement_id,company_id,title,status,priority,due_date,labels,estimate_minutes,created_by) values($1,$2,$3,'Layout da home','todo','urgent','2020-01-10',$4,90,$5)",
      [late, projects.main, companies.own, ["Design", "Home"], people.admin.id],
    );

    // The list: situation, search, company and a Membro's selection.
    let r = await rpc("projects.list", {}, admin);
    ok(
      r.status === 200 &&
        r.body.rows.some((p) => p.id === projects.main && p.status === "active") &&
        !r.body.rows.some((p) => p.id === projects.paused || p.id === projects.foreign),
      "projects.list: active projects by default, never another company's",
    );
    r = await rpc("projects.list", { status: "paused" }, admin);
    ok(
      r.status === 200 && r.body.rows.length >= 1 && r.body.rows.every((p) => p.status === "paused") && r.body.rows.some((p) => p.id === projects.paused),
      "projects.list: paused projects show under Pausados",
    );
    r = await rpc("projects.list", { status: "all", search: `Aplicativo ${marker}` }, admin);
    ok(r.status === 200 && r.body.rows.length === 1 && r.body.rows[0].id === projects.side, "projects.list: the search finds a project by name");
    r = await rpc("projects.list", { status: "all" }, scoped);
    ok(
      r.status === 200 && r.body.rows.map((p) => p.id).join() === projects.side,
      "projects.list: a Membro with selected projects sees only those",
    );
    r = await rpc("projects.list", { status: "all", company: companies.other }, admin);
    ok(r.status === 200 && !r.body.rows.some((p) => p.id === projects.foreign), "projects.list: another company's filter shows nothing of it");

    // The board.
    r = await rpc("projects.get", { id: projects.main }, membro);
    const card = r.body?.columns?.find((c) => c.status === "todo")?.tasks.find((t) => t.id === late);
    ok(
      r.status === 200 &&
        card?.overdue === true &&
        card.estimateLabel === "1h30" &&
        card.priority === "urgent" &&
        card.labels.join() === "Design,Home" &&
        card.requested === false &&
        r.body.viewer.id === people.membro.id &&
        r.body.viewer.staff === false &&
        r.body.canCreate === true &&
        r.body.people.some((p) => p.id === people.admin.id) &&
        !r.body.people.some((p) => p.id === people.scoped.id) &&
        r.body.guide.length > 0,
      "projects.get: the board brings priority, labels, estimate, lateness, the viewer and who can be given a task",
    );
    ok(
      (await rpc("projects.get", { id: projects.main }, scoped)).status === 404 &&
        (await rpc("projects.get", { id: projects.main }, elsewhere)).status === 404,
      "projects.get: a project outside the selection or another company's answers 404",
    );

    // A request from the client, with a file.
    const staged = await upload(people.membro.id);
    r = await rpc(
      "projects.createTask",
      {
        engagementId: projects.main,
        status: "done",
        title: "Trocar o banner",
        description: "O banner novo está no anexo.",
        priority: "high",
        dueDate: "2099-03-01",
        estimate: "2",
        labels: ["Home", "home", " Banner "],
        assigneeIds: [people.admin.id],
        uploadIds: [staged],
      },
      membro,
    );
    const requestId = r.body?.id;
    let row = requestId ? await taskRow(requestId) : null;
    ok(
      r.status === 200 &&
        r.body.message === "Pedido criado no Backlog. A equipe confirma se ele faz parte do combinado." &&
        row?.status === "backlog" &&
        row.requested === true &&
        row.created_by === people.membro.id &&
        row.estimate_minutes === 120 &&
        row.labels.join() === "Home,Banner" &&
        (await db.query("select 1 from console_task_assignees where task_id=$1 and user_id=$2", [requestId, people.admin.id])).rowCount === 1 &&
        (await db.query("select 1 from console_attachments where task_id=$1 and author_id=$2 and comment_id is null", [requestId, people.membro.id])).rowCount === 1 &&
        (await db.query("select 1 from console_ticket_uploads where id=$1", [staged])).rowCount === 0 &&
        (await db.query("select 1 from console_audit_events where entity_id=$1 and action='task.created'", [requestId])).rowCount === 1,
      "projects.createTask: a client's task is a request in the Backlog, with people, labels, estimate and the staged file",
    );
    r = await rpc("projects.createTask", { engagementId: projects.main, title: "Com anexo alheio", uploadIds: [await upload(people.admin.id)] }, membro);
    ok(refused(r, "Os anexos expiraram. Selecione os arquivos novamente."), "projects.createTask: someone else's upload is refused");
    r = await rpc("projects.createTask", { engagementId: projects.main, title: "   " }, membro);
    ok(refused(r, "Dê um título à tarefa."), "projects.createTask: a task needs a title (the web's message)");
    r = await rpc("projects.createTask", { engagementId: projects.main, title: "X", assigneeIds: [people.scoped.id] }, membro);
    ok(refused(r, "Uma das pessoas escolhidas não participa deste projeto."), "projects.createTask: only people who see the project can be given it");
    ok(
      (await rpc("projects.createTask", { engagementId: projects.main, title: "Fora" }, scoped)).status === 404 &&
        (await rpc("projects.createTask", { engagementId: projects.main, title: "Fora" }, elsewhere)).status === 404,
      "projects.createTask: outside the selection or the company answers 404",
    );

    // The detail and the column, with the client's rules.
    r = await rpc("projects.task", { id: requestId }, membro);
    ok(
      r.status === 200 &&
        r.body.requested &&
        r.body.statuses.map((s) => s.value).join() === "backlog" &&
        r.body.files.length === 1 &&
        r.body.files[0].href === `/api/anexos/${r.body.files[0].id}` &&
        r.body.files[0].canRemove === true &&
        r.body.canDelete === true &&
        r.body.estimateHours === "2" &&
        r.body.assignees[0]?.id === people.admin.id,
      "projects.task: the detail brings files, people and what the client may do (a request stays in the Backlog)",
    );
    const fileId = r.body.files[0].id;
    // The app downloads with its session cookie, as it does a ticket's files.
    const download = (cookie) => fetch(`${base}/api/anexos/${fileId}`, { headers: { Cookie: cookie } });
    const got = await download(membro);
    ok(
      got.status === 200 &&
        (await got.text()).startsWith("%PDF-") &&
        (await download(scoped)).status === 404 &&
        (await download(elsewhere)).status === 404,
      "A task's file downloads with the app's session, never outside the selection or the company",
    );
    r = await rpc("projects.task", { id: requestId }, admin);
    ok(r.status === 200 && r.body.canDelete === false && r.body.files[0].canRemove === false, "projects.task: someone else's task is not theirs to delete");
    ok(
      (await rpc("projects.task", { id: requestId }, scoped)).status === 404 && (await rpc("projects.task", { id: requestId }, elsewhere)).status === 404,
      "projects.task: outside the selection or the company answers 404",
    );
    r = await rpc("projects.moveTask", { id: requestId, status: "todo" }, membro);
    ok(
      refused(r, "Este pedido fica no Backlog até a equipe confirmar se ele faz parte do combinado.") && (await taskRow(requestId)).status === "backlog",
      "projects.moveTask: a request stays in the Backlog until the team takes it",
    );
    r = await rpc("projects.moveTask", { id: requestId, status: "todo" }, staff);
    row = await taskRow(requestId);
    ok(r.status === 200 && row.status === "todo" && row.requested === false, "projects.moveTask: the team takes a request into the work");
    r = await rpc("projects.task", { id: requestId }, membro);
    ok(r.body?.statuses.map((s) => s.value).join() === "backlog,todo,in_progress", "projects.task: the client moves a task among Backlog, A fazer and Em andamento");
    r = await rpc("projects.moveTask", { id: requestId, status: "in_progress" }, membro);
    ok(
      r.status === 200 &&
        r.body.message === "Tarefa movida para Em andamento." &&
        (await taskRow(requestId)).status === "in_progress" &&
        (await db.query("select 1 from console_audit_events where entity_id=$1 and action='task.moved' and actor_id=$2", [requestId, people.membro.id])).rowCount === 1,
      "projects.moveTask: the client moves a task, on record",
    );
    ok(
      refused(await rpc("projects.moveTask", { id: requestId, status: "done" }, membro), "Só a equipe conclui tarefas. Quando a entrega estiver pronta, ela aparece em Revisão para você aprovar.") &&
        refused(await rpc("projects.moveTask", { id: requestId, status: "review" }, membro), "Só a equipe coloca uma entrega em Revisão."),
      "projects.moveTask: the client neither concludes nor puts a task in Revisão",
    );
    ok((await rpc("projects.moveTask", { id: requestId, status: "todo" }, scoped)).status === 404, "projects.moveTask: outside the selection answers 404");

    // Editing, files.
    const edit = {
      id: requestId,
      status: "in_progress",
      title: "Trocar o banner da home",
      description: "",
      priority: "normal",
      dueDate: "",
      estimate: "1,5",
      labels: ["Banner"],
      assigneeIds: [],
    };
    r = await rpc("projects.updateTask", { ...edit, removeFileIds: [fileId] }, admin);
    ok(refused(r, blocked) && (await db.query("select 1 from console_attachments where id=$1", [fileId])).rowCount === 1, "projects.updateTask: a file is removed only by who added it, the task's creator or the team");
    r = await rpc("projects.updateTask", { ...edit, labels: ["x".repeat(25)] }, membro);
    ok(refused(r, "Cada etiqueta tem até 24 caracteres."), "projects.updateTask: labels follow the web's limits");
    r = await rpc("projects.updateTask", { ...edit, status: "done" }, membro);
    ok(refused(r, "Só a equipe conclui tarefas. Quando a entrega estiver pronta, ela aparece em Revisão para você aprovar."), "projects.updateTask: the column follows the client's rules");
    const second = await upload(people.membro.id, "foto.pdf");
    r = await rpc("projects.updateTask", { ...edit, uploadIds: [second], removeFileIds: [fileId] }, membro);
    row = await taskRow(requestId);
    const files = (await db.query("select name from console_attachments where task_id=$1 and comment_id is null", [requestId])).rows.map((f) => f.name);
    ok(
      r.status === 200 &&
        r.body.message === "Tarefa atualizada." &&
        row.title === "Trocar o banner da home" &&
        row.estimate_minutes === 90 &&
        row.due_date === null &&
        files.join() === "foto.pdf" &&
        (await db.query("select 1 from console_task_assignees where task_id=$1", [requestId])).rowCount === 0,
      "projects.updateTask: the client edits every field, adds a file and removes their own",
    );
    const secondId = (await db.query("select id from console_attachments where task_id=$1", [requestId])).rows[0].id;
    ok(refused(await rpc("projects.removeTaskFile", { id: secondId }, admin), blocked), "projects.removeTaskFile: someone else's file on someone else's task is refused");
    ok((await rpc("projects.removeTaskFile", { id: secondId }, elsewhere)).status === 404, "projects.removeTaskFile: another company answers 404");
    r = await rpc("projects.removeTaskFile", { id: secondId }, membro);
    ok(r.status === 200 && r.body.message === "Anexo removido." && (await db.query("select 1 from console_attachments where id=$1", [secondId])).rowCount === 0, "projects.removeTaskFile: whoever added a file removes it");

    // Comments.
    ok(refused(await rpc("projects.comment", { taskId: requestId, body: "  " }, admin), "Escreva o comentário ou anexe um arquivo."), "projects.comment: an empty comment is refused");
    const attached = await upload(people.admin.id, "print.pdf");
    r = await rpc("projects.comment", { taskId: requestId, body: "Pode ser este?", uploadIds: [attached] }, admin);
    ok(r.status === 200 && r.body.message === "Comentário publicado.", "projects.comment: a comment with a file");
    r = await rpc("projects.task", { id: requestId }, membro);
    const comment = r.body?.comments?.[0];
    ok(
      comment?.body === "Pode ser este?" &&
        comment.mine === false &&
        comment.canEdit === false &&
        comment.canDelete === false &&
        comment.author.id === people.admin.id &&
        comment.files[0]?.name === "print.pdf",
      "projects.task: comments come with author, files and what the viewer may do",
    );
    ok(
      refused(await rpc("projects.editComment", { id: comment.id, body: "Outro texto" }, membro), "Só quem escreveu o comentário pode editá-lo.") &&
        refused(await rpc("projects.deleteComment", { id: comment.id }, membro), "Só quem escreveu o comentário ou a equipe pode excluí-lo.") &&
        (await rpc("projects.editComment", { id: comment.id, body: "Outro texto" }, elsewhere)).status === 404,
      "projects.editComment and deleteComment: only the author (or the team, to delete)",
    );
    r = await rpc("projects.editComment", { id: comment.id, body: "Pode ser este banner?" }, admin);
    ok(
      r.status === 200 && (await db.query("select body, edited_at from console_task_comments where id=$1", [comment.id])).rows[0].edited_at !== null,
      "projects.editComment: the author edits the words",
    );
    r = await rpc("projects.deleteComment", { id: comment.id }, admin);
    ok(
      r.status === 200 &&
        r.body.message === "Comentário excluído." &&
        (await db.query("select 1 from console_attachments where comment_id=$1", [comment.id])).rowCount === 0,
      "projects.deleteComment: the author deletes a comment and its files",
    );

    // Activity.
    r = await rpc("projects.activity", { id: projects.main }, membro);
    ok(
      r.status === 200 &&
        r.body.events.some((e) => e.text === "criou a tarefa" && e.task?.id === requestId && e.who.id === people.membro.id) &&
        r.body.events.some((e) => e.text === "moveu de A fazer para Em andamento") &&
        r.body.events.some((e) => e.kind === "comments") &&
        r.body.filters.some((f) => f.key === "all"),
      "projects.activity: the board's history in the web's words",
    );
    ok((await rpc("projects.activity", { id: projects.main }, scoped)).status === 404, "projects.activity: outside the selection answers 404");

    // Deletion.
    ok(refused(await rpc("projects.deleteTask", { id: requestId }, admin), "Só quem criou a tarefa ou a equipe pode excluí-la."), "projects.deleteTask: only the creator or the team");
    r = await rpc("projects.deleteTask", { id: requestId }, membro);
    ok(
      r.status === 200 &&
        r.body.message === "Tarefa excluída." &&
        !(await taskRow(requestId)) &&
        (await db.query("select 1 from console_audit_events where entity_id=$1 and action='task.deleted'", [requestId])).rowCount === 1,
      "projects.deleteTask: the creator deletes the task, on record",
    );

    // The team's task goes where they put it, and a delivery in Revisão is the Administrador's to review.
    r = await rpc("projects.createTask", { engagementId: projects.main, status: "review", title: "Entrega da home" }, staff);
    row = r.body?.id ? await taskRow(r.body.id) : null;
    ok(r.status === 200 && r.body.message === "Tarefa criada." && row?.status === "review" && row.requested === false, "projects.createTask: the team creates in any column");
    const delivery = r.body.id;
    ok(
      (await rpc("projects.task", { id: delivery }, admin)).body?.canReview === true && (await rpc("projects.task", { id: delivery }, membro)).body?.canReview === false,
      "projects.task: only the company's Administrador reviews a delivery",
    );
    ok(
      refused(await rpc("projects.moveTask", { id: delivery, status: "in_progress" }, admin), "Esta entrega está em Revisão: use Revisar para aprovar ou apontar um problema."),
      "projects.moveTask: a delivery in Revisão is answered through Revisar",
    );
  } finally {
    const all = Object.values(projects);
    await db.query("delete from console_attachments where task_id in (select id from console_tasks where engagement_id=any($1::text[]))", [all]);
    await db.query("delete from console_task_comments where task_id in (select id from console_tasks where engagement_id=any($1::text[]))", [all]);
    await db.query("delete from console_task_assignees where task_id in (select id from console_tasks where engagement_id=any($1::text[]))", [all]);
    await db.query("delete from console_tasks where engagement_id=any($1::text[])", [all]);
    await db.query("delete from console_ticket_uploads where author_id=any($1::text[])", [userIds]);
    await db.query("delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [Object.values(companies), userIds]);
    await db.query("delete from console_engagements where id=any($1::text[])", [all]);
    await db.query("delete from console_session where user_id=any($1::text[])", [userIds]);
    await db.query("delete from console_memberships where company_id=any($1::text[])", [Object.values(companies)]);
    await db.query("delete from console_user where id=any($1::text[])", [userIds]);
    await db.query("delete from console_companies where id=any($1::text[])", [Object.values(companies)]);
  }
}
