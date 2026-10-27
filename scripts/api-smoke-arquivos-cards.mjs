// Arquivos' cards in the native app (f2bda19 and 8affb0a on the web): each
// file's picture (bookmarks.list and overview.get give a five-minute address
// to the small WebP, never the session to R2), stars (bookmarks.star, each
// person's own), the "Com estrela" and "Recentes" filters, the details the
// viewer shows (who added it, the start of a document), "Renomear" through
// bookmarks.update and the split of the storage meter. Another company answers
// 404 and a Membro outside a folder does not reach its files. Called from
// api-smoke.mjs; creates its own companies and people and removes them at the end.
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
 *   r2: { endpoint: string },
 * }} ctx
 */
export async function arquivosCardsChecks({ db, rpc, ok, marker, emailSignIn, base, r2 }) {
  const address = (name) => `api-cards-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "73920481562039").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const userIds = [];
  const people = {};
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Cartões ${name} ${marker.slice(0, 8)}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email, name: `Cartões ${name} ${marker.slice(0, 8)}`, session: (await emailSignIn(email)).cookie };
  }
  /**
   * A file already in R2 and read by the Console's routine: `thumb` "done"
   * when its picture was made; `source` other than its key reads as an older version's.
   */
  async function file(company, owner, fileName, size, { folderId = null, thumb = null, text = null, source = null } = {}) {
    const id = randomUUID();
    const key = `${company}/cards-${id}`;
    await db.query(
      "insert into console_bookmarks(id,company_id,author_id,folder_id,title,file_name,storage_key,file_size,mime) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [id, company, owner, folderId, fileName.replace(/\.[^.]+$/, ""), fileName, key, size, "application/octet-stream"],
    );
    await db.query("insert into console_file_texts(bookmark_id,source_key,status,text,thumb_status) values($1,$2,$3,$4,$5)", [
      id,
      source ?? key,
      text ? "done" : "skipped",
      text,
      thumb,
    ]);
    return id;
  }
  const stars = async (userId) => (await db.query("select bookmark_id from console_bookmark_stars where user_id=$1", [userId])).rows.map((r) => r.bookmark_id);
  const list = async (cookie, input = {}) => rpc("bookmarks.list", { company: companies.own, ...input }, cookie);
  const itemIn = (r, id) => r.body?.items?.find((i) => i.id === id);

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API cartões ${key} ${marker}`,
        cnpj(),
        address(`billing-${key}`),
      ]);
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("peer", companies.own, "member");
    await person("elsewhere", companies.other, "manager");
    const { admin, membro, peer, elsewhere } = Object.fromEntries(Object.entries(people).map(([k, v]) => [k, v.session]));

    // An Administrador's folder only they see, with a photo inside.
    let r = await rpc("bookmarks.createFolder", { companyId: companies.own, name: "Diretoria", visibility: "people" }, admin);
    const closed = r.body?.id;
    ok(r.status === 200 && !!closed, "An Administrador creates a folder only they see");
    const photo = await file(companies.own, people.membro.id, "obra.jpg", 5000, { thumb: "done" });
    const stale = await file(companies.own, people.membro.id, "antiga.png", 3000, { thumb: "done", source: "older-key" });
    const contract = await file(companies.own, people.membro.id, "contrato.pdf", 11000, { thumb: "none", text: "Contrato de prestação de serviços entre as partes." });
    const secret = await file(companies.own, people.admin.id, "ata.jpg", 7000, { folderId: closed, thumb: "done" });
    const foreign = await file(companies.other, people.elsewhere.id, "deles.jpg", 2000, { thumb: "done" });

    // The card's picture: a signed address beside the item, for the file as it is now.
    r = await list(membro);
    const listed = itemIn(r, photo);
    ok(
      r.status === 200 &&
        listed?.thumbUrl?.startsWith(r2.endpoint) &&
        listed.thumbUrl.includes("thumbs") &&
        listed.thumbUrl.includes("X-Amz-Expires=300") &&
        listed.thumbUrl.includes("X-Amz-Signature"),
      "bookmarks.list gives a photo's card picture as a five-minute signed address",
    );
    ok(itemIn(r, stale) && !itemIn(r, stale).thumbUrl, "An older version's picture is not given for the new file");
    ok(itemIn(r, contract) && !itemIn(r, contract).thumbUrl && itemIn(r, contract).page?.startsWith("Contrato de prestação"), "A document brings the start of its text, without a picture");
    ok(listed?.ownerName === people.membro.name, "Each item says who added it");
    ok(!itemIn(r, secret) && !r.body.items.some((i) => i.id === foreign), "A Membro gets no picture of a folder they do not see, nor of another company");

    // The web's route signs the same picture, for the same people.
    const thumbOf = (id, cookie) => fetch(`${base}/api/bookmarks/${id}/miniatura`, { redirect: "manual", headers: { Cookie: cookie } });
    let web = await thumbOf(photo, membro);
    ok(web.status === 302 && web.headers.get("location")?.startsWith(r2.endpoint), "/api/bookmarks/<id>/miniatura still redirects to the picture");
    ok((await thumbOf(photo, elsewhere)).status === 404, "Another company's client gets no picture from the web's route (404)");
    ok((await thumbOf(stale, membro)).status === 404 && (await thumbOf(secret, membro)).status === 404, "The web's route keeps its rules (older version, closed folder)");

    // Stars: each person's own.
    r = await rpc("bookmarks.star", { id: photo }, membro);
    ok(r.status === 200 && r.body.starred === true && r.body.message === "Com estrela.", "bookmarks.star turns the star on with the web's words");
    ok((await stars(people.membro.id)).includes(photo), "The star is saved for the person");
    r = await list(membro);
    ok(itemIn(r, photo)?.starred === true && r.body.starredCount === 1, "The list marks the starred item and counts the stars");
    r = await list(peer);
    ok(!itemIn(r, photo)?.starred && !r.body.starredCount, "A colleague does not see someone else's star");
    r = await list(peer, { folder: "estrela" });
    ok(r.status === 200 && r.body.folder === "estrela" && r.body.items.length === 0, "\"Com estrela\" is empty for a colleague");
    r = await list(membro, { folder: "estrela" });
    ok(r.status === 200 && r.body.folder === "estrela" && r.body.items.length === 1 && r.body.items[0].id === photo, "\"Com estrela\" shows what the person starred");
    r = await rpc("bookmarks.star", { id: photo, starred: true }, membro);
    ok(r.status === 200 && r.body.starred === true && (await stars(people.membro.id)).filter((id) => id === photo).length === 1, "Starring again keeps a single star");
    r = await rpc("bookmarks.star", { id: photo }, membro);
    ok(r.status === 200 && r.body.starred === false && r.body.message === "Estrela tirada." && !(await stars(people.membro.id)).includes(photo), "Without `starred` the star turns over, as the web's menu");
    r = await rpc("bookmarks.star", { id: contract, starred: false }, membro);
    ok(r.status === 200 && r.body.starred === false, "Taking a star that is not there answers the same");
    ok((await rpc("bookmarks.star", { id: foreign, starred: true }, membro)).status === 404, "A star on another company's item answers 404");
    ok((await rpc("bookmarks.star", { id: photo, starred: true }, elsewhere)).status === 404, "Another company's client cannot star this one (404)");
    ok((await rpc("bookmarks.star", { id: secret, starred: true }, membro)).status === 404, "A Membro cannot star a file in a folder they do not see (404)");
    ok((await rpc("bookmarks.star", { id: randomUUID(), starred: true }, membro)).status === 404, "An unknown item answers 404");
    ok((await rpc("bookmarks.star", { id: photo, starred: true })).status === 401, "Starring needs a session");
    r = await rpc("bookmarks.star", { id: secret, starred: true }, admin);
    ok(r.status === 200 && (await stars(people.admin.id)).includes(secret), "Who sees the folder stars its file");

    // "Recentes": what the person added, changed or opened in 30 days, only theirs.
    r = await rpc("bookmarks.create", { companyId: companies.own, title: "Fornecedor", url: "https://example.invalid/fornecedor" }, membro);
    const link = r.body?.id;
    ok(r.status === 200 && !!link, "A Membro adds a link");
    ok((await rpc("bookmarks.download", { id: contract }, peer)).status === 200, "A colleague downloads the document");
    r = await list(membro, { folder: "recentes" });
    ok(r.status === 200 && r.body.folder === "recentes" && r.body.items.some((i) => i.id === link) && !r.body.items.some((i) => i.id === contract), "\"Recentes\" shows what the person added");
    r = await list(peer, { folder: "recentes" });
    ok(r.status === 200 && r.body.items.some((i) => i.id === contract) && !r.body.items.some((i) => i.id === link), "\"Recentes\" of a colleague shows what they opened, not what others added");
    await db.query("update console_audit_events set created_at=now() - interval '31 days' where actor_id=$1 and entity_id=$2", [people.peer.id, contract]);
    r = await list(peer, { folder: "recentes" });
    ok(!r.body.items.some((i) => i.id === contract), "\"Recentes\" forgets after 30 days");

    // One item, for the viewer and a link with ?abrir=: the same readings as the list.
    await rpc("bookmarks.star", { id: photo, starred: true }, membro);
    r = await rpc("bookmarks.get", { id: photo }, membro);
    ok(
      r.status === 200 && r.body.starred === true && r.body.thumbUrl?.startsWith(r2.endpoint) && r.body.ownerName === people.membro.name && r.body.fileSize === 5000,
      "bookmarks.get gives the star, the picture and who added it",
    );
    r = await rpc("bookmarks.get", { id: contract }, peer);
    ok(r.status === 200 && !r.body.starred && r.body.page?.startsWith("Contrato") && !r.body.thumbUrl, "bookmarks.get gives a document's start, and only the viewer's star");
    ok((await rpc("bookmarks.get", { id: photo }, elsewhere)).status === 404, "Another company's client opens nothing by its id (404)");
    ok((await rpc("bookmarks.get", { id: secret }, membro)).status === 404, "A Membro opens nothing in a folder they do not see (404)");

    // "Renomear": only the title, through bookmarks.update (who saved it, the folder's owner, the team).
    r = await rpc("bookmarks.update", { id: photo, title: "Obra, fachada", url: "", folderId: "" }, membro);
    const renamed = (await db.query("select title, file_name, tag_source from console_bookmarks where id=$1", [photo])).rows[0];
    ok(r.status === 200 && renamed.title === "Obra, fachada" && renamed.file_name === "obra.jpg", "Who added it renames the file; the file keeps its name");
    r = await rpc("bookmarks.update", { id: photo, title: "Outro nome", url: "", folderId: "" }, peer);
    ok(r.status !== 200 && (await db.query("select title from console_bookmarks where id=$1", [photo])).rows[0].title === "Obra, fachada", "A colleague cannot rename someone else's file");
    ok((await rpc("bookmarks.update", { id: photo, title: "X", url: "", folderId: "" }, elsewhere)).status === 404, "Another company cannot rename it (404)");

    // The storage meter's split, counted as the space is.
    r = await list(membro);
    const meter = r.body?.spaces?.find((s) => s.companyId === companies.own);
    ok(
      meter?.parts?.media === 5000 + 3000 + 7000 &&
        meter.parts.documents === 11000 &&
        meter.parts.media + meter.parts.documents + meter.parts.other === meter.used,
      "The space comes split into photos and videos, documents and the rest",
    );

    // Início: the latest files with their picture too.
    r = await rpc("overview.get", {}, membro);
    const home = r.body?.bookmarks?.find((b) => b.id === photo);
    ok(r.status === 200 && home?.thumbUrl?.startsWith(r2.endpoint) && home.fileSize === 5000, "Início gives the files' pictures as the list");
    ok(!r.body.bookmarks.some((b) => b.id === secret || b.id === foreign), "Início shows no file the person does not see");
  } finally {
    const ids = Object.values(companies);
    const folders = (await db.query("select id from console_bookmark_folders where company_id=any($1::text[])", [ids])).rows.map((f) => f.id);
    for (const [statement, values] of [
      ["delete from console_bookmark_stars where user_id=any($1::text[])", [userIds]],
      ["delete from console_file_uploads where company_id=any($1::text[]) or actor_id=any($2::text[])", [ids, userIds]],
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
