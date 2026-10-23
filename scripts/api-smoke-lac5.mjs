// Lacunas L15 (Projetos) in the native app: projects.moveTask's optional
// `afterId` reorders a task inside its column ("Mover para o topo / para cima
// / para baixo"), with the same authorization as a column move. Called from
// api-smoke.mjs; creates its own companies, people, projects and tasks and
// removes them at the end.
import { randomUUID } from "node:crypto";

/**
 * @param {{
 *   db: import("pg").Pool,
 *   rpc: (path: string, input: unknown, cookie?: string, headers?: Record<string, string>) => Promise<{ status: number, body: any }>,
 *   ok: (condition: unknown, message: string) => void,
 *   marker: string,
 *   emailSignIn: (email: string) => Promise<{ status: number, body: any, cookie: string }>,
 *   staff: string,
 * }} ctx
 */
export async function lac5Checks({ db, rpc, ok, marker, emailSignIn, staff }) {
  const address = (name) => `api-lac5-${name}-${marker}@example.invalid`;
  const companies = { own: randomUUID(), other: randomUUID() };
  const projects = { main: randomUUID(), side: randomUUID(), foreign: randomUUID() };
  const userIds = [];
  const people = {};
  const refused = (r, message) => r.status === 400 && r.body?.message === message;
  async function person(name, company, role, selected) {
    const id = randomUUID(),
      email = address(name),
      membership = randomUUID();
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Lacunas ${name}`, email]);
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
  async function task(engagement, company, title, status, position, extra = {}) {
    const id = randomUUID();
    await db.query(
      "insert into console_tasks(id,engagement_id,company_id,title,status,position,requested,created_by) values($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, engagement, company, title, status, position, extra.requested ?? false, extra.createdBy ?? people.admin.id],
    );
    return id;
  }
  const column = async (engagement, status) =>
    (
      await db.query("select id from console_tasks where engagement_id=$1 and status=$2 order by position, created_at", [engagement, status])
    ).rows.map((row) => row.id);

  try {
    for (const [key, id] of Object.entries(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        id,
        `API lac5 ${key} ${marker}`,
        (randomUUID().replace(/\D/g, "") + "73018264590142").slice(0, 14),
        address(`billing-${key}`),
      ]);
    for (const [id, company, name] of [
      [projects.main, companies.own, `Portal lac5 ${marker}`],
      [projects.side, companies.own, `Aplicativo lac5 ${marker}`],
      [projects.foreign, companies.other, `Outro lac5 ${marker}`],
    ])
      await db.query("insert into console_engagements(id,company_id,name,kind,status) values($1,$2,$3,'project','active')", [id, company, name]);
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("scoped", companies.own, "member", [projects.side]);
    await person("elsewhere", companies.other, "manager");
    const admin = (await emailSignIn(people.admin.email)).cookie;
    const membro = (await emailSignIn(people.membro.email)).cookie;
    const scoped = (await emailSignIn(people.scoped.email)).cookie;
    const elsewhere = (await emailSignIn(people.elsewhere.email)).cookie;

    const a = await task(projects.main, companies.own, "Cabeçalho", "todo", 1024);
    const b = await task(projects.main, companies.own, "Rodapé", "todo", 2048);
    const c = await task(projects.main, companies.own, "Contato", "todo", 3072);
    const review = await task(projects.main, companies.own, "Entrega", "review", 1024);
    const review2 = await task(projects.main, companies.own, "Entrega 2", "review", 2048);
    const request = await task(projects.main, companies.own, "Pedido", "backlog", 1024, { requested: true, createdBy: people.membro.id });
    const foreign = await task(projects.foreign, companies.other, "Alheia", "todo", 1024);

    // Reordering inside the column: top, after another, and the old call (no afterId) to the end.
    let r = await rpc("projects.moveTask", { id: c, status: "todo", afterId: null }, membro);
    ok(r.status === 200 && r.body.message === "Tarefa movida." && (await column(projects.main, "todo")).join() === [c, a, b].join(), "projects.moveTask: afterId null puts the task at the top of its column");
    r = await rpc("projects.moveTask", { id: c, status: "todo", afterId: a }, admin);
    ok(r.status === 200 && (await column(projects.main, "todo")).join() === [a, c, b].join(), "projects.moveTask: afterId puts the task right after another (Mover para baixo)");
    r = await rpc("projects.moveTask", { id: a, status: "todo" }, membro);
    ok(
      r.status === 200 && r.body.message === "Tarefa movida para A fazer." && (await column(projects.main, "todo")).join() === [c, b, a].join(),
      "projects.moveTask: without afterId (old apps) the task still goes to the end of the column",
    );
    const moved = await db.query("select 1 from console_audit_events where action='task.moved' and entity_id=any($1::text[])", [[a, c]]);
    ok(moved.rowCount === 0, "projects.moveTask: reordering inside a column is not a column move on record");

    // The client's rules stay: Revisão can be reordered, not left; a request stays in the Backlog.
    r = await rpc("projects.moveTask", { id: review2, status: "review", afterId: null }, membro);
    ok(r.status === 200 && (await column(projects.main, "review")).join() === [review2, review].join(), "projects.moveTask: the client reorders inside Revisão");
    ok(
      refused(await rpc("projects.moveTask", { id: review, status: "done", afterId: null }, membro), "Para concluir, use Aprovar na tarefa em Revisão.") &&
        refused(
          await rpc("projects.moveTask", { id: request, status: "todo", afterId: c }, membro),
          "Este pedido fica no Backlog até a equipe confirmar se ele faz parte do combinado.",
        ),
      "projects.moveTask: afterId does not get around the client's column rules",
    );

    // Who may: a Membro outside the selection and another company answer 404; another company's task too.
    const before = (await column(projects.main, "todo")).join();
    ok(
      (await rpc("projects.moveTask", { id: a, status: "todo", afterId: null }, scoped)).status === 404 &&
        (await rpc("projects.moveTask", { id: a, status: "todo", afterId: null }, elsewhere)).status === 404 &&
        (await rpc("projects.moveTask", { id: foreign, status: "todo", afterId: null }, admin)).status === 404 &&
        (await column(projects.main, "todo")).join() === before,
      "projects.moveTask: afterId outside the selection or in another company answers 404 and changes nothing",
    );
    // An afterId from another company's board is not a place here: the task goes to the top, the other board is untouched.
    const foreignBefore = (await db.query("select position from console_tasks where id=$1", [foreign])).rows[0].position;
    r = await rpc("projects.moveTask", { id: b, status: "todo", afterId: foreign }, admin);
    ok(
      r.status === 200 &&
        (await column(projects.main, "todo"))[0] === b &&
        (await db.query("select position from console_tasks where id=$1", [foreign])).rows[0].position === foreignBefore,
      "projects.moveTask: another board's task as afterId moves nothing there",
    );
    ok(
      (await rpc("projects.moveTask", { id: a, status: "todo", afterId: "nao-e-uuid" }, admin)).status === 400,
      "projects.moveTask: afterId must be a task id",
    );
    // The team reorders too.
    r = await rpc("projects.moveTask", { id: a, status: "todo", afterId: null }, staff);
    ok(r.status === 200 && (await column(projects.main, "todo"))[0] === a, "projects.moveTask: the team reorders a column");
  } finally {
    const all = Object.values(projects);
    await db.query("delete from console_tasks where engagement_id=any($1::text[])", [all]);
    await db.query("delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [Object.values(companies), userIds]);
    await db.query("delete from console_engagements where id=any($1::text[])", [all]);
    await db.query("delete from console_session where user_id=any($1::text[])", [userIds]);
    await db.query("delete from console_memberships where company_id=any($1::text[])", [Object.values(companies)]);
    await db.query("delete from console_user where id=any($1::text[])", [userIds]);
    await db.query("delete from console_companies where id=any($1::text[])", [Object.values(companies)]);
  }
}
