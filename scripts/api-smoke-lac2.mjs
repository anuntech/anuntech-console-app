// Gaps of 23/10, front lac2 (mobile/task.md L8 and L20): profile.activity,
// the web's "Atividade" of Minha conta, only ever the signed-in person's own
// year; and bookmarks.get, one bookmark for the app's edit and move screens
// opened without the list, with the list's rules (company, folder open to the
// viewer, who may change it). Called from api-smoke.mjs; creates its own
// companies and people and removes them at the end.
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
export async function lac2Checks({ db, rpc, ok, marker, emailSignIn, staff }) {
  const address = (name) => `api-lac2-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "73917305829164").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const userIds = [];
  const people = {};
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Marcador ${name} ${marker.slice(0, 8)}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email, session: (await emailSignIn(email)).cookie };
  }
  const audit = (actorId, n) =>
    Promise.all(
      Array.from({ length: n }, () =>
        db.query(
          "insert into console_audit_events(id,actor_id,company_id,action,entity_id,created_at) values($1,$2,$3,'ticket.created',$4,now())",
          [randomUUID(), actorId, companies.own, randomUUID()],
        ),
      ),
    );

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API lac2 ${key} ${marker}`,
        cnpj(),
        address(`billing-${key}`),
      ]);
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("peer", companies.own, "member");
    await person("elsewhere", companies.other, "manager");
    const { admin, membro, peer, elsewhere } = Object.fromEntries(Object.entries(people).map(([k, v]) => [k, v.session]));

    // Atividade: 365 days, oldest first, today last; only the person's own events.
    ok((await rpc("profile.activity", {}, "")).status === 401, "profile.activity needs a session");
    let r = await rpc("profile.activity", {}, membro);
    const before = r.body;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    ok(
      r.status === 200 &&
        before.days.length === 365 &&
        before.days.at(-1).date === today &&
        before.days.every((d, i) => i === 0 || d.date > before.days[i - 1].date) &&
        before.total === before.days.reduce((s, d) => s + d.count, 0),
      "profile.activity answers the web's 365 days, oldest first, with the total",
    );
    const adminBefore = (await rpc("profile.activity", {}, admin)).body;
    await audit(people.membro.id, 3);
    await audit(people.admin.id, 5);
    r = await rpc("profile.activity", {}, membro);
    ok(
      r.status === 200 && r.body.total === before.total + 3 && r.body.days.at(-1).count === before.days.at(-1).count + 3,
      "profile.activity counts the person's own actions of today",
    );
    r = await rpc("profile.activity", {}, admin);
    ok(r.status === 200 && r.body.total === adminBefore.total + 5, "Someone else's actions never count in a person's activity");
    ok((await rpc("profile.activity", { userId: people.admin.id }, membro)).status === 400, "profile.activity takes no person: only the signed-in one");

    // bookmarks.get: the list's item, for edit and move without the list.
    r = await rpc("bookmarks.create", { companyId: companies.own, title: "Painel", url: "https://example.invalid/painel" }, membro);
    const link = r.body?.id;
    r = await rpc("bookmarks.get", { id: link }, membro);
    ok(
      r.status === 200 &&
        r.body.id === link &&
        r.body.kind === "link" &&
        r.body.url === "https://example.invalid/painel" &&
        r.body.editable === true &&
        r.body.folderId === null &&
        r.body.companyId === companies.own &&
        r.body.fileSize === null &&
        r.body.filePath === null &&
        typeof r.body.createdAt === "string",
      "bookmarks.get answers the bookmark as the list shows it, editable by who saved it",
    );
    const listed = (await rpc("bookmarks.list", { company: companies.own }, membro)).body.items.find((i) => i.id === link);
    ok(JSON.stringify(listed) === JSON.stringify(r.body), "bookmarks.get and bookmarks.list say the same about a bookmark");
    r = await rpc("bookmarks.get", { id: link }, peer);
    ok(r.status === 200 && r.body.editable === false, "A colleague sees it but may not change it");
    ok((await rpc("bookmarks.get", { id: link }, admin)).body?.editable === false, "The company's Administrador does not change someone else's bookmark either, as on the web");
    ok((await rpc("bookmarks.get", { id: link }, elsewhere)).status === 404, "Another company's bookmark answers 404");
    ok((await rpc("bookmarks.get", { id: randomUUID() }, membro)).status === 404, "An unknown bookmark answers 404");
    ok((await rpc("bookmarks.get", { id: link }, "")).status === 401, "bookmarks.get needs a session");
    ok((await rpc("bookmarks.get", { id: link }, staff)).body?.editable === true, "The team sees and changes it");

    // A folder only its owner sees: its bookmarks are "not found" for the rest of the company.
    r = await rpc("bookmarks.createFolder", { companyId: companies.own, name: "Só minha", visibility: "people" }, membro);
    const privateFolder = r.body?.id;
    r = await rpc("bookmarks.create", { folderId: privateFolder, title: "Lousa", kind: "board" }, membro);
    const board = r.body?.id;
    r = await rpc("bookmarks.get", { id: board }, membro);
    ok(r.status === 200 && r.body.kind === "board" && r.body.folderId === privateFolder && r.body.hasPreview === false, "bookmarks.get answers a board in the owner's folder");
    ok((await rpc("bookmarks.get", { id: board }, peer)).status === 404, "A bookmark in a folder not shared with the viewer answers 404");
  } finally {
    const ids = Object.values(companies);
    const folders = (await db.query("select id from console_bookmark_folders where company_id=any($1::text[])", [ids])).rows.map((f) => f.id);
    for (const [statement, values] of [
      ["delete from console_bookmark_folder_shares where folder_id=any($1::text[])", [folders]],
      ["delete from console_bookmarks where company_id=any($1::text[]) or author_id=any($2::text[])", [ids, userIds]],
      ["delete from console_bookmark_folders where id=any($1::text[])", [folders]],
      ["delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [ids, userIds]],
      ["delete from console_user_milestones where user_id=any($1::text[])", [userIds]],
      ["delete from console_session where user_id=any($1::text[])", [userIds]],
      ["delete from console_account where user_id=any($1::text[])", [userIds]],
      ["delete from console_memberships where company_id=any($1::text[])", [ids]],
      ["delete from console_companies where id=any($1::text[])", [ids]],
      ["delete from console_user where id=any($1::text[])", [userIds]],
    ])
      await db.query(statement, values);
  }
}
