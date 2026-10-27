// Arquivos in the native app (files.*, bookmarks.create with an uploadId,
// bookmarks.download and the space meter of bookmarks.list): the web's R2 rules
// (lib/drive/uploads.ts) through the app's API. The suite plays the phone: it
// starts the upload, PUTs each part straight to the R2 stand-in (scripts/r2-mock.mjs)
// and finishes it. Another company answers 404, someone else's upload is not
// continued, a Membro adds only where the web lets them, the quota refuses before
// R2, an upload becomes one bookmark only, and the download address is signed
// only after the access check. Called from api-smoke.mjs; creates its own
// companies and people and removes them at the end.
import { randomBytes, randomUUID } from "node:crypto";

/**
 * @param {{
 *   db: import("pg").Pool,
 *   rpc: (path: string, input: unknown, cookie?: string, headers?: Record<string, string>) => Promise<{ status: number, body: any }>,
 *   ok: (condition: unknown, message: string) => void,
 *   marker: string,
 *   emailSignIn: (email: string) => Promise<{ status: number, body: any, cookie: string }>,
 *   staff: string,
 *   base: string,
 *   r2: { endpoint: string, objects: Map<string, Buffer>, requests: { method: string }[] },
 * }} ctx
 */
export async function arquivosAppChecks({ db, rpc, ok, marker, emailSignIn, staff, base, r2 }) {
  const address = (name) => `api-arquivos-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "51846203917425").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const userIds = [];
  const people = {};
  const MB = 1024 * 1024;
  const GB = 1024 ** 3;
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Arquivos ${name} ${marker.slice(0, 8)}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email, session: (await emailSignIn(email)).cookie };
  }
  /** What the app does after files.startUpload: sign, PUT every part to R2, finish with the ETags. */
  async function sendParts(cookie, upload, bytes, { skipLast = false } = {}) {
    const numbers = Array.from({ length: upload.partCount }, (_, i) => i + 1);
    const signed = await rpc("files.signParts", { id: upload.id, parts: numbers }, cookie);
    const parts = [];
    for (const { partNumber, url } of signed.body?.parts ?? []) {
      if (skipLast && partNumber === upload.partCount) continue;
      const put = await fetch(url, { method: "PUT", body: bytes.subarray((partNumber - 1) * upload.partSize, partNumber * upload.partSize) });
      parts.push({ partNumber, etag: put.headers.get("etag") });
    }
    return { signed, finished: await rpc("files.finishUpload", { id: upload.id, parts }, cookie) };
  }
  /** A file already in R2, ready for bookmarks.create. */
  async function stored(cookie, target, bytes, fileName = "foto.jpg") {
    const started = await rpc("files.startUpload", { ...target, fileName, size: bytes.length, mime: "image/jpeg" }, cookie);
    if (started.status !== 200) return { started };
    const { finished } = await sendParts(cookie, started.body, bytes);
    return { started, finished, id: started.body.id };
  }
  const row = async (id) => (await db.query("select * from console_bookmarks where id=$1", [id])).rows[0];
  const upload = async (id) => (await db.query("select * from console_file_uploads where id=$1", [id])).rows[0];

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
        companies[key],
        `API arquivos ${key} ${marker}`,
        cnpj(),
        address(`billing-${key}`),
      ]);
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("peer", companies.own, "member");
    await person("elsewhere", companies.other, "manager");
    const { admin, membro, peer, elsewhere } = Object.fromEntries(Object.entries(people).map(([k, v]) => [k, v.session]));
    const own = { companyId: companies.own, folderId: "" };

    // The list says R2 is there and how full each space is, as the web's "Espaço usado".
    let r = await rpc("bookmarks.list", {}, membro);
    const mine = r.body?.spaces?.find((s) => s.companyId === companies.own);
    ok(
      r.status === 200 && r.body.largeFiles === true && r.body.spaces.length === 1 && mine?.used === 0 && mine.quota === 5 * GB,
      "bookmarks.list gives largeFiles and the client's space (5 GB by default)",
    );
    r = await rpc("bookmarks.list", { company: companies.own }, staff);
    ok(
      r.status === 200 &&
        r.body.spaces.some((s) => s.companyId === null && s.quota === null) &&
        r.body.spaces.some((s) => s.companyId === companies.own) &&
        !r.body.spaces.some((s) => s.companyId === companies.other),
      "The team sees Anuntech's space (no limit) and the company it filtered, as on the web",
    );
    r = await rpc("bookmarks.list", { company: companies.own }, elsewhere);
    ok(r.status === 200 && !r.body.spaces.some((s) => s.companyId === companies.own), "Another company's space never shows up");
    r = await rpc("bookmarks.list", { page: 2 }, membro);
    ok(r.status === 200 && r.body.spaces === undefined && r.body.largeFiles === undefined, "The meter comes with the first page only");

    // A 17 MB video from the phone goes in two parts, straight to R2.
    const video = randomBytes(17 * MB);
    r = await rpc("files.startUpload", { ...own, fileName: "../Vídeo da obra.mov", size: video.length, mime: "video/quicktime" }, membro);
    const big = r.body;
    ok(r.status === 200 && big.partCount === 2 && big.partSize === 16 * MB, "A Membro starts a large upload for their company, in parts");
    ok((await rpc("files.signParts", { id: big.id, parts: [1] }, elsewhere)).status === 404, "Another company cannot sign parts of the upload (404)");
    ok((await rpc("files.signParts", { id: big.id, parts: [1] }, peer)).status === 404, "A colleague cannot continue someone else's upload (404)");
    ok((await rpc("files.signParts", { id: big.id, parts: [3] }, membro)).status === 400, "Parts beyond the file are refused");
    const before = r2.requests.length;
    const sent = await sendParts(membro, big, video);
    ok(
      sent.signed.body.parts.every((p) => p.url.startsWith(r2.endpoint) && p.url.includes("X-Amz-Signature")) && r2.requests.length > before,
      "Each part goes to a signed R2 address",
    );
    ok(sent.finished.status === 200 && sent.finished.body.id === big.id && r2.objects.get(`${companies.own}/${big.id}`)?.equals(video), "files.finishUpload joins the parts in R2");
    ok((await upload(big.id))?.status === "completed", "The upload waits, completed, for its bookmark");
    ok((await rpc("bookmarks.create", { ...own, title: "X", kind: "file", uploadId: big.id }, elsewhere)).status === 404, "Another company cannot take the upload (404)");
    r = await rpc("bookmarks.create", { ...own, title: "X", kind: "file", uploadId: big.id }, peer);
    ok(r.status === 400 && r.body?.message === "O envio do arquivo não foi concluído. Envie de novo.", "A colleague cannot take someone else's upload");
    r = await rpc("bookmarks.create", { ...own, title: "Vídeo da obra", kind: "file", uploadId: big.id }, membro);
    const videoId = r.body?.id;
    const saved = videoId ? await row(videoId) : null;
    ok(
      r.status === 200 &&
        r.body.message === "Bookmark salvo." &&
        saved?.storage_key === `${companies.own}/${big.id}` &&
        Number(saved.file_size) === video.length &&
        saved.file_name === "Vídeo da obra.mov" &&
        saved.mime === "video/quicktime" &&
        !saved.content,
      "bookmarks.create saves the file bookmark pointing at R2, without bytes in the database",
    );
    r = await rpc("bookmarks.create", { ...own, title: "Outra vez", kind: "file", uploadId: big.id }, membro);
    ok(r.status === 400 && r.body?.message === "O envio do arquivo não foi concluído. Envie de novo.", "An upload becomes a bookmark only once");
    ok(
      (await rpc("bookmarks.create", { ...own, title: "Sem envio", kind: "file" }, membro)).body?.message === "Informe um link ou selecione um arquivo.",
      "A file bookmark needs a finished upload",
    );
    r = await rpc("bookmarks.list", { company: companies.own }, membro);
    const listed = r.body?.items?.find((i) => i.id === videoId);
    ok(
      listed?.fileSize === video.length && listed.filePath === `/api/bookmarks/${videoId}` && r.body.spaces.find((s) => s.companyId === companies.own)?.used === video.length,
      "The list gives the R2 file's size and the space it takes",
    );

    // Downloads: a five-minute address, made only after the access check.
    r = await rpc("bookmarks.download", { id: videoId }, peer);
    ok(
      r.status === 200 &&
        r.body.url?.startsWith(r2.endpoint) &&
        r.body.url.includes("X-Amz-Expires=300") &&
        r.body.url.includes("attachment") &&
        r.body.fileName === "Vídeo da obra.mov" &&
        r.body.fileSize === video.length,
      "bookmarks.download signs a five-minute address for whoever sees the file",
    );
    ok(Buffer.from(await (await fetch(r.body.url)).arrayBuffer()).equals(video), "The signed address gives back the same bytes");
    r = await rpc("bookmarks.download", { id: videoId, inline: true }, membro);
    ok(r.status === 200 && r.body.url.includes("inline"), "inline asks the browser to show the file");
    const signedBefore = r2.requests.length;
    ok((await rpc("bookmarks.download", { id: videoId }, elsewhere)).status === 404 && r2.requests.length === signedBefore, "Another company gets 404, and no address");
    ok((await rpc("bookmarks.download", { id: videoId })).status === 401, "Downloading needs a session");

    // Membro rules, as the web: a folder only some people see takes files only from them.
    r = await rpc("bookmarks.createFolder", { companyId: companies.own, name: "Diretoria", visibility: "people" }, admin);
    const closed = r.body?.id;
    ok(r.status === 200 && !!closed, "An Administrador creates a folder only they see");
    ok((await rpc("files.startUpload", { companyId: "", folderId: closed, fileName: "x.pdf", size: 1000 }, membro)).status === 404, "A Membro cannot upload into a folder they do not see (404)");
    const secret = await stored(admin, { companyId: "", folderId: closed }, randomBytes(64 * 1024), "ata.pdf");
    ok(secret.finished?.status === 200 && (await upload(secret.id))?.folder_id === closed, "Its owner uploads into it");
    r = await rpc("bookmarks.create", { companyId: "", folderId: closed, title: "Ata", kind: "file", uploadId: secret.id }, admin);
    const ata = r.body?.id;
    ok(r.status === 200 && (await row(ata))?.storage_key === `${companies.own}/${secret.id}`, "The folder's file is saved in the folder's company");
    ok((await rpc("bookmarks.download", { id: ata }, membro)).status === 404, "A Membro outside the folder cannot download its file (404)");

    // An older file kept in the database: no address, the app reads filePath with the session.
    const form = new FormData();
    for (const [key, value] of Object.entries({ title: "Antigo", companyId: companies.own, folderId: "" })) form.set(key, value);
    form.set("file", new Blob([new Uint8Array(2048).fill(66)], { type: "application/pdf" }), "antigo.pdf");
    const legacy = await fetch(`${base}/api/v1/bookmarks/arquivo`, { method: "POST", headers: { Cookie: membro }, body: form }).then((res) => res.json());
    r = await rpc("bookmarks.download", { id: legacy.id }, membro);
    ok(r.status === 200 && r.body.url === null && r.body.fileName === "antigo.pdf" && r.body.fileSize === 2048, "An older 1 MB file has no address: the app keeps the old way");
    r = await rpc("bookmarks.create", { ...own, title: "Link", url: "https://example.invalid/a" }, membro);
    ok((await rpc("bookmarks.download", { id: r.body.id }, membro)).status === 404, "A link has nothing to download");

    // Another company, Anuntech's own space, the size limit and the quota.
    ok((await rpc("files.startUpload", { companyId: companies.other, folderId: "", fileName: "x.pdf", size: 1000 }, membro)).status === 404, "Uploading into another company answers 404");
    ok((await rpc("files.startUpload", { companyId: companies.own, folderId: "", fileName: "x.pdf", size: 1000 }, elsewhere)).status === 404, "Another company's client cannot upload here (404)");
    ok((await rpc("files.startUpload", { companyId: "", folderId: "", fileName: "x.pdf", size: 1000 }, staff)).status === 404, "Anuntech's own space stays on the web");
    ok((await rpc("files.startUpload", { ...own, fileName: "x.pdf", size: 1000 })).status === 401, "Uploading needs a session");
    r = await rpc("files.startUpload", { ...own, fileName: "x.zip", size: 101 * GB }, membro);
    ok(r.status === 400 && r.body?.message === "Escolha um arquivo de até 100 GB.", "Files over 100 GB are refused with the web's words");
    r = await rpc("files.startUpload", { ...own, fileName: "x.zip", size: 0 }, membro);
    ok(r.status === 400 && r.body?.message === "Selecione um arquivo com conteúdo.", "An empty file is refused");
    await db.query("update console_companies set storage_quota_bytes=$2 where id=$1", [companies.own, video.length + MB]);
    const quotaBefore = r2.requests.length;
    r = await rpc("files.startUpload", { ...own, fileName: "grande.zip", size: 2 * MB }, membro);
    ok(
      r.status === 413 && /^O espaço da empresa acabou: restam .+ de .+\. Exclua arquivos ou fale com a Anuntech para aumentar\.$/.test(r.body?.message ?? "") && r2.requests.length === quotaBefore,
      "Over the company's quota: refused with the web's words, before R2",
    );
    r = await rpc("bookmarks.list", { company: companies.own }, membro);
    ok(r.body?.spaces?.find((s) => s.companyId === companies.own)?.quota === video.length + MB, "The meter shows the company's own quota");
    await db.query("update console_companies set storage_quota_bytes=null where id=$1", [companies.own]);

    // Missing parts, cancelling.
    const partial = randomBytes(17 * MB);
    r = await rpc("files.startUpload", { ...own, fileName: "fotos.zip", size: partial.length }, membro);
    const half = r.body;
    const missing = await sendParts(membro, half, partial, { skipLast: true });
    ok(missing.finished.status === 400 && missing.finished.body?.message === "O envio não terminou: faltam partes.", "Without every part the upload does not finish");
    ok((await rpc("files.cancelUpload", { id: half.id }, peer)).status === 404, "A colleague cannot cancel someone else's upload (404)");
    r = await rpc("files.cancelUpload", { id: half.id }, membro);
    ok(r.status === 200 && r.body.cancelled === true && (await upload(half.id))?.status === "aborted", "files.cancelUpload lets the upload go");
    ok((await rpc("files.signParts", { id: half.id, parts: [1] }, membro)).status === 404, "A cancelled upload takes no more parts");
    ok((await rpc("files.cancelUpload", { id: big.id }, membro)).body?.message === "Este arquivo já foi salvo.", "A saved file cannot be cancelled");

    // Deleting from the app moves the bookmark to the web's trash: the file stays in R2 for 30 days, and nothing opens it.
    r = await rpc("bookmarks.remove", { id: videoId }, membro);
    const gone = (await db.query("select deleted_at from console_bookmarks where id=$1", [videoId])).rows[0];
    ok(r.status === 200 && !!gone?.deleted_at && r2.objects.has(`${companies.own}/${big.id}`), "Deleting the file bookmark moves it to the trash, the file kept for 30 days");
    ok((await rpc("bookmarks.get", { id: videoId }, membro)).status === 404, "A bookmark in the trash is not found by the app");

    // The web's Arquivos in the app: trash, versions, copy, tags, subfolders, links and activity.
    r = await rpc("bookmarks.list", { company: companies.own, folder: "lixeira" }, membro);
    ok(r.status === 200 && r.body.folder === "lixeira" && r.body.items.some((i) => i.id === videoId && !!i.deletedAt) && r.body.trashCount >= 1, "The app opens the trash");
    ok((await rpc("bookmarks.restore", { id: videoId }, elsewhere)).status === 404, "Another company cannot restore (404)");
    r = await rpc("bookmarks.restore", { id: videoId }, membro);
    ok(r.status === 200 && !(await row(videoId)).deleted_at, "Restoring brings the file back");
    const second = await stored(membro, own, randomBytes(2000), "video-v2.mov");
    r = await rpc("bookmarks.replaceFile", { id: videoId, uploadId: second.id }, membro);
    ok(r.status === 200 && (await row(videoId)).storage_key === `${companies.own}/${second.id}`, "A new version replaces the file from the app");
    r = await rpc("bookmarks.versions", { id: videoId }, membro);
    const v1 = r.body?.versions?.[0];
    ok(r.status === 200 && r.body.editable === true && v1?.version === 1, "The app lists the earlier versions");
    r = await rpc("bookmarks.downloadVersion", { id: videoId, versionId: v1.id }, membro);
    ok(r.status === 200 && Buffer.from(await (await fetch(r.body.url)).arrayBuffer()).equals(video), "An earlier version downloads from the app");
    ok((await rpc("bookmarks.restoreVersion", { versionId: v1.id }, elsewhere)).status === 404, "Another company cannot restore a version (404)");
    r = await rpc("bookmarks.restoreVersion", { versionId: v1.id }, membro);
    ok(r.status === 200 && (await row(videoId)).storage_key === `${companies.own}/${big.id}`, "Restoring a version brings the old file back");
    // The Console may have suggested "video" already; a different choice is the person's.
    r = await rpc("bookmarks.update", { id: videoId, title: "Vídeo", folderId: "", tag: "apresentacao" }, membro);
    ok(r.status === 200 && (await row(videoId)).tag === "apresentacao" && (await row(videoId)).tag_source === "person", "The app sets a tag as the person's choice");
    r = await rpc("bookmarks.list", { company: companies.own, tag: "apresentacao" }, membro);
    ok(r.status === 200 && r.body.items.length === 1 && r.body.items[0].tag === "apresentacao" && r.body.tags.some((t) => t.tag === "apresentacao"), "The list filters by tag and counts them");
    r = await rpc("bookmarks.list", { company: companies.own, kind: "links" }, membro);
    ok(r.status === 200 && r.body.items.every((i) => i.kind === "link"), "The list filters by type");
    r = await rpc("bookmarks.copy", { id: videoId, folderId: "" }, membro);
    ok(r.status === 200 && Number((await db.query("select count(*) as n from console_bookmarks where company_id=$1 and title like 'Vídeo%'", [companies.own])).rows[0].n) === 2, "The app copies an item");
    r = await rpc("bookmarks.createFolder", { companyId: companies.own, name: "Sub", visibility: "company", parentId: closed }, admin);
    const sub = r.body?.id;
    ok(r.status === 200 && (await db.query("select parent_id from console_bookmark_folders where id=$1", [sub])).rows[0]?.parent_id === closed, "The app creates a folder inside another");
    r = await rpc("bookmarks.list", { company: companies.own }, admin);
    ok(r.body.folders.find((f) => f.id === sub)?.parentId === closed, "The list says which folder each one sits in");
    {
      // A folder counts what its subfolders hold too.
      const before = r.body.folders.find((f) => f.id === closed)?.count ?? 0;
      const copy = (await db.query("select id from console_bookmarks where company_id=$1 and title like 'Vídeo%' and id<>$2 limit 1", [companies.own, videoId])).rows[0].id;
      const was = (await db.query("select folder_id from console_bookmarks where id=$1", [copy])).rows[0].folder_id;
      await db.query("update console_bookmarks set folder_id=$2 where id=$1", [copy, sub]);
      const after = await rpc("bookmarks.list", { company: companies.own }, admin);
      const moved = was === closed ? 0 : 1;
      ok(after.body.folders.find((f) => f.id === sub)?.count === 1 && after.body.folders.find((f) => f.id === closed)?.count === before + moved, "A folder counts the files in its subfolders");
      await db.query("update console_bookmarks set folder_id=$2 where id=$1", [copy, was]);
    }
    r = await rpc("bookmarks.moveFolder", { id: sub, parentId: "" }, admin);
    ok(r.status === 200 && (await db.query("select parent_id from console_bookmark_folders where id=$1", [sub])).rows[0]?.parent_id === null, "The app moves a folder to the top");
    r = await rpc("bookmarks.shareFolder", { id: sub, visibility: "company", userIds: [], adds: "owner" }, admin);
    ok(r.status === 200 && (await db.query("select adds from console_bookmark_folders where id=$1", [sub])).rows[0]?.adds === "owner", "The app makes a folder only to see and download");
    ok((await rpc("bookmarks.createShareLink", { kind: "download", bookmarkId: videoId }, peer)).status === 400, "Who does not edit the file makes no link");
    r = await rpc("bookmarks.createShareLink", { kind: "download", bookmarkId: videoId, expiresInDays: 7 }, membro);
    ok(r.status === 200 && /\/compartilhado\/[A-Za-z0-9_-]{43}$/.test(r.body.url ?? ""), "The app makes an external link, the address shown once");
    r = await rpc("bookmarks.shareLinks", { bookmarkId: videoId }, membro);
    const link = r.body?.links?.[0];
    ok(r.status === 200 && link?.state === "active", "The app lists the links made");
    ok((await rpc("bookmarks.revokeShareLink", { id: link.id }, elsewhere)).status === 404, "Another company cannot turn a link off (404)");
    r = await rpc("bookmarks.revokeShareLink", { id: link.id }, membro);
    ok(r.status === 200 && (await rpc("bookmarks.shareLinks", { bookmarkId: videoId }, membro)).body.links[0].state === "revoked", "The app turns a link off");
    r = await rpc("bookmarks.activity", { id: videoId }, membro);
    ok(r.status === 200 && r.body.activity.some((a) => a.what === "Enviou uma nova versão"), "The app shows the item's activity");
    ok((await rpc("bookmarks.activity", { id: videoId }, peer)).status === 404, "Who does not edit the item does not see its activity");
  } finally {
    const ids = Object.values(companies);
    const folders = (await db.query("select id from console_bookmark_folders where company_id=any($1::text[])", [ids])).rows.map((f) => f.id);
    for (const [statement, values] of [
      ["delete from console_share_links where company_id=any($1::text[])", [ids]],
      ["delete from console_file_uploads where company_id=any($1::text[]) or actor_id=any($2::text[])", [ids, userIds]],
      ["delete from console_bookmark_folder_shares where folder_id=any($1::text[])", [folders]],
      ["delete from console_bookmarks where company_id=any($1::text[]) or author_id=any($2::text[])", [ids, userIds]],
      ["update console_bookmark_folders set parent_id=null where id=any($1::text[])", [folders]],
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
