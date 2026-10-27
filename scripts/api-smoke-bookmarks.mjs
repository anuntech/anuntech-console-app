// Bookmarks in the native app (bookmarks.* and POST /api/v1/bookmarks/arquivo):
// the web's rules through the app's API. Anyone who sees a folder adds to it;
// a bookmark is edited by who saved it or the folder's owner; only the owner
// renames, shares and deletes a folder; deleting it leaves the bookmarks in
// "Sem pasta"; another company answers 404 and Anuntech's own space stays on
// the web. Called from api-smoke.mjs; creates its own companies and people and
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
 *   base: string,
 * }} ctx
 */
export async function bookmarksChecks({ db, rpc, ok, marker, emailSignIn, staff, base }) {
  const address = (name) => `api-bookmarks-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "73917305829164").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const userIds = [];
  const people = {};
  const blocked = "Você não tem permissão para fazer isso.";
  const refused = (r, message) => r.status === 400 && r.body?.message === message;
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Marcador ${name} ${marker.slice(0, 8)}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email, session: (await emailSignIn(email)).cookie };
  }
  /** The app's file upload: multipart with the session cookie, no browser headers. */
  async function upload(cookie, fields, bytes = 2048, name = "contrato.pdf") {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    if (bytes) form.set("file", new Blob([new Uint8Array(bytes).fill(65)], { type: "application/pdf" }), name);
    const response = await fetch(`${base}/api/v1/bookmarks/arquivo`, {
      method: "POST",
      headers: cookie ? { Cookie: cookie } : {},
      body: form,
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }
  const row = async (id) => (await db.query("select * from console_bookmarks where id=$1", [id])).rows[0];

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API bookmarks ${key} ${marker}`,
        cnpj(),
        address(`billing-${key}`),
      ]);
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("peer", companies.own, "member");
    await person("elsewhere", companies.other, "manager");
    const { admin, membro, peer, elsewhere } = Object.fromEntries(Object.entries(people).map(([k, v]) => [k, v.session]));

    // Folders: any client of the company creates one; another company or Anuntech's own space, no.
    let r = await rpc("bookmarks.createFolder", { companyId: companies.own, name: "  Acessos  " }, membro);
    const folder = r.body?.id;
    ok(r.status === 200 && r.body.message === "Pasta criada." && !!folder, "A Membro creates a folder in their company");
    ok((await rpc("bookmarks.createFolder", { companyId: companies.own, name: "Intrusa" }, elsewhere)).status === 404, "Another company's folder answers 404");
    ok(refused(await rpc("bookmarks.createFolder", { companyId: companies.own, name: "   " }, membro), "Dê um nome à pasta."), "A folder needs a name (the web's words)");

    // Links: in the company, in a folder anyone who sees it uses; never outside.
    r = await rpc("bookmarks.create", { companyId: companies.own, title: "Painel", url: "https://example.invalid/painel" }, membro);
    const loose = r.body?.id;
    ok(r.status === 200 && r.body.message === "Bookmark salvo." && (await row(loose))?.folder_id === null, "A Membro saves a link without a folder");
    r = await rpc("bookmarks.create", { folderId: folder, title: "Drive", url: "https://example.invalid/drive" }, peer);
    const peerLink = r.body?.id;
    ok(r.status === 200 && (await row(peerLink))?.company_id === companies.own, "Whoever sees a folder adds to it, in the folder's company");
    ok(refused(await rpc("bookmarks.create", { companyId: companies.own, title: "X", url: "javascript:alert(1)" }, membro), "Informe um link HTTP ou HTTPS válido, sem credenciais."), "Only http(s) links, as on the web");
    ok(refused(await rpc("bookmarks.create", { companyId: companies.own, title: "X" }, membro), "Informe um link ou selecione um arquivo."), "A link bookmark needs the link");
    ok((await rpc("bookmarks.create", { companyId: companies.own, title: "X", url: "https://example.invalid" }, elsewhere)).status === 404, "Saving in another company answers 404");
    ok((await rpc("bookmarks.create", { folderId: folder, title: "X", url: "https://example.invalid" }, elsewhere)).status === 404, "Another company's folder answers 404 on create");
    ok((await rpc("bookmarks.create", { companyId: "", title: "X", url: "https://example.invalid" }, staff)).status === 404, "Anuntech's own space stays on the web");
    r = await rpc("bookmarks.create", { companyId: companies.own, title: "Fluxo", kind: "board" }, membro);
    const board = r.body?.id;
    ok(r.status === 200 && r.body.message === "Lousa criada." && !!(await row(board))?.board, "A blank board is created, to draw in the Console");

    // The list: folders with who sees them, permissions per item, company filter.
    r = await rpc("bookmarks.list", { company: companies.own }, peer);
    const listed = r.body;
    const folderView = listed?.folders?.find((f) => f.id === folder);
    ok(
      r.status === 200 &&
        folderView?.visibility === "company" &&
        folderView.manages === false &&
        folderView.owner.startsWith("Marcador membro") &&
        listed.companies.some((c) => c.id === companies.own) &&
        listed.items.find((i) => i.id === loose)?.editable === false &&
        listed.items.find((i) => i.id === peerLink)?.editable === true &&
        listed.rootCount >= 2 &&
        typeof listed.items[0]?.createdAt === "string",
      "bookmarks.list says who sees each folder and what the viewer may change",
    );
    r = await rpc("bookmarks.list", { folder: "root" }, membro);
    ok(r.status === 200 && r.body.folder === "root" && r.body.items.every((i) => i.folderId === null), "Sem pasta lists only the loose bookmarks");
    r = await rpc("bookmarks.list", { folder: randomUUID() }, membro);
    ok(r.status === 200 && r.body.folder === "all", "An unknown folder shows everything, as on the web");
    r = await rpc("bookmarks.list", { company: companies.own }, elsewhere);
    ok(r.status === 200 && !r.body.items.some((i) => i.id === loose) && !r.body.folders.some((f) => f.id === folder), "Another company's bookmarks never show up");

    // Editing: who saved it or the folder's owner; nobody else of the company.
    ok(refused(await rpc("bookmarks.update", { id: loose, title: "Meu", url: "https://example.invalid/x" }, peer), blocked), "A colleague cannot edit someone else's bookmark");
    r = await rpc("bookmarks.update", { id: peerLink, title: "Drive da empresa", url: "https://example.invalid/drive2", folderId: folder }, membro);
    ok(r.status === 200 && r.body.message === "Bookmark atualizado." && (await row(peerLink)).title === "Drive da empresa", "The folder's owner edits what others saved in it");
    ok((await rpc("bookmarks.update", { id: loose, title: "X", url: "https://example.invalid" }, elsewhere)).status === 404, "Editing another company's bookmark answers 404");
    r = await rpc("bookmarks.move", { id: loose, folderId: folder }, membro);
    ok(r.status === 200 && r.body.message === "Bookmark movido." && (await row(loose)).folder_id === folder, "The author moves a bookmark into a folder");
    ok(refused(await rpc("bookmarks.move", { id: loose, folderId: "" }, peer), blocked), "A colleague cannot move it");
    ok((await rpc("bookmarks.move", { id: loose, folderId: "" }, elsewhere)).status === 404, "Moving another company's bookmark answers 404");

    // Files from the phone: the web's limit, the company's access, the session.
    r = await upload(membro, { title: "Contrato social", companyId: companies.own, folderId: "" });
    const file = r.body?.id;
    const stored = file ? await row(file) : null;
    ok(r.status === 200 && r.body.message === "Bookmark salvo." && stored?.file_name === "contrato.pdf" && stored.content.length === 2048, "The app saves a file bookmark");
    r = await rpc("bookmarks.list", { company: companies.own }, membro);
    ok(r.body.items.find((i) => i.id === file)?.fileSize === 2048 && r.body.items.find((i) => i.id === file)?.filePath === `/api/bookmarks/${file}`, "The list gives the file's size and download path");
    r = await upload(membro, { title: "Grande", companyId: companies.own, folderId: "" }, 1024 * 1024 + 1);
    ok(r.status === 400 && r.body?.error === "Escolha um arquivo de até 1 MB.", "Files over 1 MB are refused, as on the web");
    ok((await upload(elsewhere, { title: "X", companyId: companies.own, folderId: "" })).status === 404, "Uploading into another company answers 404");
    ok((await upload(staff, { title: "X", companyId: "", folderId: "" })).status === 404, "Files in Anuntech's own space stay on the web");
    ok((await upload("", { title: "X", companyId: companies.own, folderId: "" })).status === 401, "Uploading needs a session");
    r = await upload(membro, { title: "Sem arquivo", companyId: companies.own, folderId: "" }, 0);
    ok(r.status === 400 && r.body?.error === "Informe um link ou selecione um arquivo.", "An upload without a file is refused");

    // Sharing: only the owner; only people of the company (or the team).
    ok(refused(await rpc("bookmarks.shareFolder", { id: folder, visibility: "people", userIds: [people.peer.id] }, peer), blocked), "Only the owner shares a folder");
    ok(
      refused(await rpc("bookmarks.shareFolder", { id: folder, visibility: "people", userIds: [people.elsewhere.id] }, membro), "Uma das pessoas escolhidas não participa desta empresa."),
      "A folder is never shared outside its company",
    );
    r = await rpc("bookmarks.searchPeople", { folderId: folder, query: "Marcador" }, membro);
    const found = r.body?.people?.map((p) => p.id) ?? [];
    ok(r.status === 200 && found.includes(people.admin.id) && found.includes(people.peer.id) && !found.includes(people.elsewhere.id) && !found.includes(people.membro.id), "The share search finds the company's people, not others nor oneself");
    r = await rpc("bookmarks.searchPeople", { folderId: folder, query: "Marcador" }, admin);
    ok(r.status === 200 && r.body.people.length === 0, "Someone who does not own the folder finds no one");
    r = await rpc("bookmarks.shareFolder", { id: folder, visibility: "people", userIds: [people.admin.id] }, membro);
    ok(r.status === 200 && r.body.message === "Compartilhamento atualizado.", "The owner shares the folder with chosen people");
    r = await rpc("bookmarks.list", {}, admin);
    const shared = r.body?.folders?.find((f) => f.id === folder);
    ok(shared?.visibility === "people" && shared.sharedWith.length === 1 && shared.sharedWith[0].id === people.admin.id && !!shared.sharedWith[0].avatar, "The list shows who the folder is shared with");
    r = await rpc("bookmarks.list", {}, peer);
    ok(!r.body.folders.some((f) => f.id === folder) && !r.body.items.some((i) => i.id === peerLink), "A folder shared with others disappears for the rest of the company");
    ok((await rpc("bookmarks.renameFolder", { id: folder, name: "Minha" }, peer)).status === 404, "A folder the person cannot see answers 404");
    ok((await rpc("bookmarks.update", { id: peerLink, title: "X", url: "https://example.invalid" }, peer)).status === 404, "A bookmark inside it answers 404 too, even to who saved it");

    // Renaming and deleting: only the owner; the bookmarks go to Sem pasta.
    ok(refused(await rpc("bookmarks.renameFolder", { id: folder, name: "Minha" }, admin), blocked), "Someone it is shared with cannot rename it");
    r = await rpc("bookmarks.renameFolder", { id: folder, name: "Acessos do site" }, membro);
    ok(r.status === 200 && r.body.message === "Pasta renomeada.", "The owner renames the folder");
    ok(refused(await rpc("bookmarks.deleteFolder", { id: folder }, admin), blocked), "Only the owner deletes a folder, not even an Administrador");
    r = await rpc("bookmarks.deleteFolder", { id: folder }, membro);
    const orphans = (await db.query("select folder_id from console_bookmarks where id=any($1::text[])", [[loose, peerLink]])).rows;
    ok(
      r.status === 200 && r.body.message === "Pasta excluída." && orphans.length === 2 && orphans.every((o) => o.folder_id === null),
      "Deleting a folder leaves its bookmarks in Sem pasta",
    );

    // Deleting a bookmark.
    ok(refused(await rpc("bookmarks.remove", { id: loose }, peer), blocked), "A colleague cannot delete someone else's bookmark");
    ok((await rpc("bookmarks.remove", { id: loose }, elsewhere)).status === 404, "Deleting another company's bookmark answers 404");
    r = await rpc("bookmarks.remove", { id: loose }, membro);
    ok(r.status === 200 && r.body.message === "Movido para a lixeira. Fica lá por 30 dias." && !!(await row(loose))?.deleted_at, "The author deletes the bookmark (into the trash)");

    // Paging beyond one page.
    const many = Array.from({ length: 27 }, () => randomUUID());
    for (const id of many)
      await db.query("insert into console_bookmarks(id,company_id,author_id,title,url) values($1,$2,$3,'Muitos','https://example.invalid/m')", [id, companies.own, people.admin.id]);
    const first = await rpc("bookmarks.list", { company: companies.own, search: "Muitos" }, peer);
    const second = await rpc("bookmarks.list", { company: companies.own, search: "Muitos", page: 2 }, peer);
    ok(
      first.body?.items.length === 25 &&
        first.body.pageCount === 2 &&
        first.body.total === 27 &&
        second.body?.page === 2 &&
        second.body.items.length === 2 &&
        !second.body.items.some((i) => first.body.items.some((f) => f.id === i.id)),
      "bookmarks.list pages 25 at a time, without repeating rows",
    );
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
