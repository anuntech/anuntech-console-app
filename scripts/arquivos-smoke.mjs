import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";

/**
 * Arquivos with R2 (lib/drive): a file sent in parts straight to the bucket
 * (the suite plays the browser), finished by the Console, saved as a bookmark
 * and read back through a signed address; the quota, a lying size, missing
 * parts, someone else's upload, another company and another site refused;
 * deleting the bookmark removes the object.
 */
export async function runArquivosTests({ database: db, ids, people, request, submitForm, ok, marker, base, r2, notFoundPage, aiFile }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const json = (who, path, body, method = "POST") =>
    request(path, who, { method, headers: { "Content-Type": "application/json", Origin: base }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => ({
      ...r,
      data: (() => {
        try {
          return JSON.parse(r.text);
        } catch {
          return null;
        }
      })(),
    }));
  /** What the browser does: every part to its signed address, then "concluir". */
  async function sendParts(who, upload, bytes, { skipLast = false } = {}) {
    const numbers = Array.from({ length: upload.partCount }, (_, i) => i + 1);
    const signed = await json(who, `/api/arquivos/envios/${upload.id}/partes`, { parts: numbers });
    const parts = [];
    for (const { partNumber, url } of signed.data) {
      if (skipLast && partNumber === upload.partCount) continue;
      const slice = bytes.subarray((partNumber - 1) * upload.partSize, partNumber * upload.partSize);
      const put = await fetch(url, { method: "PUT", body: slice });
      parts.push({ partNumber, etag: put.headers.get("etag") });
    }
    return json(who, `/api/arquivos/envios/${upload.id}/concluir`, { parts });
  }

  // A 20 MB file for Anuntech's own space goes in two parts of 16 MB and 4 MB.
  const bytes = randomBytes(20 * 1024 * 1024);
  let started = await json("admin", "/api/arquivos/envios", { companyId: "", folderId: "", fileName: `../video ${marker}.mov`, size: bytes.length, mime: "video/quicktime" });
  ok(started.status === 200 && started.data.partCount === 2 && started.data.partSize === 16 * 1024 * 1024, "Um arquivo grande começa o envio em partes");
  const upload = started.data;
  const foreign = await json("manager", `/api/arquivos/envios/${upload.id}/partes`, { parts: [1] });
  ok(foreign.status === 404, "Outra pessoa não continua o envio de alguém");
  const crossSite = await request("/api/arquivos/envios", "admin", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.com" }, body: "{}" });
  ok(crossSite.status === 403, "Envio de outro site é recusado");
  const finished = await sendParts("admin", upload, bytes);
  ok(finished.status === 200 && r2.objects.get(`anuntech/${upload.id}`)?.equals(bytes), "As partes chegam ao R2 e o Console junta o arquivo");
  ok(r2.requests.filter((r) => r.method === "PUT" && r.query.uploadId).every((r) => r.signedByQuery), "Cada parte vai por um endereço assinado");

  await submitForm("/bookmarks", "admin", "admin", { action: "saveBookmark" }, { companyId: "", folderId: "", title: `Vídeo ${marker}`, kind: "file", uploadId: upload.id });
  const saved = await one("select id, file_name, file_size, storage_key, content from console_bookmarks where title=$1", [`Vídeo ${marker}`]);
  ok(saved?.storage_key === `anuntech/${upload.id}` && Number(saved.file_size) === bytes.length && saved.file_name === `video ${marker}.mov` && !saved.content, "O bookmark aponta para o arquivo no R2, sem bytes no banco");
  await submitForm("/bookmarks", "admin", "admin", { action: "saveBookmark" }, { companyId: "", folderId: "", title: `Reuso ${marker}`, kind: "file", uploadId: upload.id });
  ok(!(await one("select 1 as ok from console_bookmarks where title=$1", [`Reuso ${marker}`])), "Um envio vira um bookmark só uma vez");

  const download = await request(`/api/bookmarks/${saved.id}`, "admin");
  const location = download.headers.get("location") ?? "";
  ok(download.status === 302 && location.startsWith(r2.endpoint) && location.includes("X-Amz-Signature") && location.includes("X-Amz-Expires=300"), "O download leva a um endereço assinado de 5 minutos");
  const fetched = Buffer.from(await (await fetch(location)).arrayBuffer());
  ok(fetched.equals(bytes), "O arquivo baixado é o mesmo que foi enviado");
  ok((await request(`/api/bookmarks/${saved.id}`, "manager")).status === 404, "Cliente não baixa arquivo do espaço da Anuntech");
  const page = await request("/bookmarks", "admin");
  ok(page.text.includes("Enviar arquivos") && page.text.includes("Espaço") && page.text.includes("Arquivos"), "A tela Arquivos oferece o envio de vários arquivos e mostra o espaço");

  // The client's company has 5 GB by default; a smaller quota refuses what does not fit, before anything reaches R2.
  await db.query("update console_companies set storage_quota_bytes=$2 where id=$1", [ids.a, 1024 * 1024]);
  const before = r2.requests.length;
  const tooBig = await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: "grande.zip", size: 2 * 1024 * 1024 });
  ok(tooBig.status === 413 && /espaço da empresa acabou/.test(tooBig.data?.error ?? "") && r2.requests.length === before, "Arquivo acima da cota da empresa é recusado antes do R2");
  const otherCompany = await json("manager", "/api/arquivos/envios", { companyId: ids.b, folderId: "", fileName: "x.pdf", size: 1000 });
  ok(otherCompany.status === 404, "Cliente não envia para outra empresa");
  const anuntech = await json("manager", "/api/arquivos/envios", { companyId: "", folderId: "", fileName: "x.pdf", size: 1000 });
  ok(anuntech.status === 404, "Cliente não envia para o espaço da Anuntech");
  ok((await json("admin", "/api/arquivos/envios", { companyId: "", folderId: "", fileName: "x", size: 101 * 1024 ** 3 })).status === 400, "Arquivo acima de 100 GB é recusado");
  await db.query("update console_companies set storage_quota_bytes=null where id=$1", [ids.a]);

  // The client's own file: missing parts are refused; a file smaller than announced is thrown away.
  const small = randomBytes(300 * 1024);
  started = await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: "contrato.pdf", size: small.length + 10 });
  ok(started.status === 200, "Cliente envia arquivo para a própria empresa");
  const lying = await sendParts("manager", started.data, small);
  ok(lying.status === 400 && !r2.objects.has(`${ids.a}/${started.data.id}`), "Tamanho diferente do informado: o arquivo é descartado");
  const big = randomBytes(17 * 1024 * 1024);
  started = await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: "fotos.zip", size: big.length });
  const missing = await sendParts("manager", started.data, big, { skipLast: true });
  ok(missing.status === 400 && /faltam partes/.test(missing.data?.error ?? ""), "Sem todas as partes, o envio não conclui");
  const cancelled = await request(`/api/arquivos/envios/${started.data.id}`, "manager", { method: "DELETE", headers: { Origin: base } });
  ok(cancelled.status === 200 && (await one("select status from console_file_uploads where id=$1", [started.data.id]))?.status === "aborted", "Cancelar libera o envio");

  // Fase 2a: the team sets the space; the search finds file names; a picture opens in the preview, a page never.
  await submitForm(`/empresas/${ids.a}`, "admin", "manager", { action: "setStorageQuota" }, { companyId: ids.a, quotaGb: "50" });
  ok((await one("select storage_quota_bytes from console_companies where id=$1", [ids.a]))?.storage_quota_bytes === null, "Cliente não muda o espaço da empresa");
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "setStorageQuota" }, { companyId: ids.a, quotaGb: "50" });
  ok(Number((await one("select storage_quota_bytes from console_companies where id=$1", [ids.a]))?.storage_quota_bytes) === 50 * 1024 ** 3, "A equipe muda o espaço da empresa em GB");
  ok((await request(`/empresas/${ids.a}`, "admin")).text.includes("Espaço em Arquivos"), "A página da empresa mostra o espaço em Arquivos");
  await submitForm(`/empresas/${ids.a}`, "admin", "admin", { action: "setStorageQuota" }, { companyId: ids.a, quotaGb: "" });
  ok((await one("select storage_quota_bytes from console_companies where id=$1", [ids.a]))?.storage_quota_bytes === null, "Vazio volta ao padrão");
  const picture = randomBytes(2048);
  started = await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: `foto-${marker}.png`, size: picture.length, mime: "image/png" });
  await sendParts("manager", started.data, picture);
  await submitForm("/bookmarks", "manager", "manager", { action: "saveBookmark" }, { companyId: ids.a, folderId: "", title: "Foto da vitrine", kind: "file", uploadId: started.data.id });
  const photo = await one("select id from console_bookmarks where title='Foto da vitrine' and company_id=$1", [ids.a]);
  ok((await request(`/bookmarks?q=foto-${marker}`, "manager")).text.includes("Foto da vitrine"), "A busca encontra pelo nome do arquivo");
  const view = await request(`/api/bookmarks/${photo.id}/ver`, "manager");
  const viewAt = view.headers.get("location") ?? "";
  ok(view.status === 302 && viewAt.includes("response-content-type=image%2Fpng") && viewAt.includes("inline"), "A prévia abre a imagem no Console, com o tipo certo");
  ok((await request(`/api/bookmarks/${photo.id}/ver`, "outsider")).status !== 302, "Pessoa de fora não vê a prévia");
  started = await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: "pagina.html", size: 10 });
  await sendParts("manager", started.data, Buffer.from("<b>oi</b>!"));
  await submitForm("/bookmarks", "manager", "manager", { action: "saveBookmark" }, { companyId: ids.a, folderId: "", title: "Página", kind: "file", uploadId: started.data.id });
  const page2 = await one("select id from console_bookmarks where title='Página' and company_id=$1", [ids.a]);
  ok((await request(`/api/bookmarks/${page2.id}/ver`, "manager")).status === 404, "HTML não abre na prévia, só baixa");

  // Fase 2d: a new version replaces the file and keeps the old one; an old one comes back; all of them count.
  const firstKey = (await one("select storage_key from console_bookmarks where id=$1", [photo.id])).storage_key;
  const second = randomBytes(3000);
  started = await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: `foto-${marker}-v2.png`, size: second.length, mime: "image/png" });
  await sendParts("manager", started.data, second);
  await submitForm("/bookmarks", "manager", "support", { action: "replaceBookmarkFile" }, { id: photo.id, uploadId: started.data.id });
  ok((await one("select storage_key from console_bookmarks where id=$1", [photo.id])).storage_key === firstKey, "Só quem pode editar envia nova versão");
  await submitForm("/bookmarks", "manager", "manager", { action: "replaceBookmarkFile" }, { id: photo.id, uploadId: started.data.id });
  const afterReplace = await one("select storage_key, file_size, file_name from console_bookmarks where id=$1", [photo.id]);
  const kept = await one("select id, version, storage_key from console_file_versions where bookmark_id=$1", [photo.id]);
  ok(afterReplace.storage_key !== firstKey && Number(afterReplace.file_size) === second.length && kept?.storage_key === firstKey && kept.version === 1, "Nova versão vira o arquivo e a anterior fica como versão 1");
  const listed = await json("manager", `/api/bookmarks/${photo.id}/versoes`, undefined, "GET");
  ok(listed.status === 200 && listed.data.versions.length === 1 && listed.data.editable === true, "A lista de versões mostra a anterior");
  ok((await request(`/api/bookmarks/${photo.id}/versoes`, "outsider")).status !== 200, "Pessoa de fora não vê as versões");
  const oldDownload = await request(`/api/bookmarks/${photo.id}/versoes/${kept.id}`, "manager");
  ok(oldDownload.status === 302 && Buffer.from(await (await fetch(oldDownload.headers.get("location"))).arrayBuffer()).equals(picture), "A versão antiga baixa com o conteúdo dela");
  await submitForm("/bookmarks", "manager", "manager", { action: "restoreVersion" }, { id: kept.id });
  const restored = await one("select storage_key from console_bookmarks where id=$1", [photo.id]);
  const history = (await db.query("select version, storage_key from console_file_versions where bookmark_id=$1 order by version", [photo.id])).rows;
  ok(restored.storage_key === firstKey && history.length === 1 && history[0].storage_key === afterReplace.storage_key, "Restaurar a versão traz o arquivo antigo e guarda o atual");

  // Fase 3: links that work without an account. Only who edits shares; the address works once made, then stops when it should.
  const tokenOf = (text) => text.match(/\/(?:compartilhado|enviar)\/([A-Za-z0-9_-]{43})/)?.[1] ?? null;
  const visitor = (path, init = {}) => request(path, undefined, init);
  // The dialog calls the action and reads what it returns (the address shows once): the suite does the same, the way Next's client does.
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  const actionId = (name) => Object.entries(manifest).find(([, a]) => a.exportedName === name)?.[0];
  const callAction = (who, name, args) =>
    request("/bookmarks", who, { method: "POST", headers: { "Next-Action": actionId(name), Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8", Origin: base }, body: JSON.stringify(args) });
  const share = async (who, values) => tokenOf((await callAction(who, "createShareLink", [values])).text);
  ok(!(await share("support", { kind: "download", bookmarkId: photo.id, folderId: "", expiresInDays: "7", password: "", maxDownloads: "", email: "" })), "Quem não edita o item não cria link");
  ok(!(await share("manager", { kind: "download", bookmarkId: saved.id, folderId: "", expiresInDays: "7", password: "", maxDownloads: "", email: "" })), "Cliente não cria link de arquivo da Anuntech");
  const once = await share("manager", { kind: "download", bookmarkId: photo.id, folderId: "", expiresInDays: "7", password: "", maxDownloads: "1", email: "" });
  ok(!!once && !!(await one("select 1 as ok from console_share_links where bookmark_id=$1 and token_hash <> $2", [photo.id, once])), "O link é criado e o banco guarda só o hash do endereço");
  let pageOut = await visitor(`/compartilhado/${once}`);
  ok(pageOut.status === 200 && pageOut.text.includes("Foto da vitrine") && pageOut.text.includes("noindex"), "Quem tem o link vê o arquivo, sem conta, e a página não é indexada");
  ok((await visitor(`/compartilhado/${once}/arquivo/${saved.id}`)).status === 404, "O link não abre um arquivo que não compartilha");
  const viaLink = await visitor(`/compartilhado/${once}/arquivo/${photo.id}`);
  ok(viaLink.status === 302 && (viaLink.headers.get("location") ?? "").includes("X-Amz-Signature"), "O download pelo link vai a um endereço assinado");
  ok((await one("select downloads from console_share_links where bookmark_id=$1 and max_downloads=1", [photo.id]))?.downloads === 1 && !!(await one("select 1 as ok from console_audit_events where action='share_link.downloaded' and entity_id=$1", [photo.id])), "O download é contado e registrado");
  ok((await visitor(`/compartilhado/${once}/arquivo/${photo.id}`)).status === 303 && (await visitor(`/compartilhado/${once}`)).text.includes("número de vezes"), "Passado o limite de downloads, o link para");
  ok(notFoundPage(await visitor(`/compartilhado/${"x".repeat(43)}`)), "Um endereço inventado não abre nada");

  const locked = await share("manager", { kind: "download", bookmarkId: photo.id, folderId: "", expiresInDays: "", password: "senha-forte", maxDownloads: "", email: "" });
  ok(!(await visitor(`/compartilhado/${locked}`)).text.includes("Foto da vitrine") && (await visitor(`/compartilhado/${locked}/arquivo/${photo.id}`)).status === 303, "Com senha, nada abre antes de digitar a senha");
  const wrong = await submitForm(`/compartilhado/${locked}`, undefined, undefined, { action: "unlockShareLink" }, { token: locked, password: "errada" });
  ok(!wrong.headers.get("set-cookie")?.includes("console-link-"), "Senha errada não abre o link");
  const right = await submitForm(`/compartilhado/${locked}`, undefined, undefined, { action: "unlockShareLink" }, { token: locked, password: "senha-forte" });
  const unlock = (right.headers.get("set-cookie") ?? "").match(/console-link-[a-f0-9]+=[^;]+/)?.[0];
  ok(!!unlock && (await visitor(`/compartilhado/${locked}/arquivo/${photo.id}`, { headers: { Cookie: unlock } })).status === 302, "Com a senha certa, o link abre neste navegador");
  const lockedId = (await one("select id from console_share_links where bookmark_id=$1 and password_hash is not null", [photo.id])).id;
  await submitForm("/bookmarks", "support", "support", { action: "revokeShareLink" }, { id: lockedId });
  ok(!(await one("select revoked_at from console_share_links where id=$1", [lockedId])).revoked_at, "Quem não edita o item não desliga o link");
  await submitForm("/bookmarks", "manager", "manager", { action: "revokeShareLink" }, { id: lockedId });
  ok((await visitor(`/compartilhado/${locked}`)).text.includes("desligado") && (await visitor(`/compartilhado/${locked}/arquivo/${photo.id}`, { headers: { Cookie: unlock } })).status === 303, "Desligado, o link para na hora, mesmo para quem já tinha aberto");

  // A request link: anyone with it sends files into the folder, sees nothing there, and programs are refused.
  await submitForm("/bookmarks", "manager", "manager", { action: "createFolder" }, { companyId: ids.a, name: `Recebidos ${marker}`, visibility: "company" });
  const inbox = (await one("select id from console_bookmark_folders where name=$1", [`Recebidos ${marker}`])).id;
  const ask = await share("manager", { kind: "request", bookmarkId: "", folderId: inbox, expiresInDays: "7", password: "", maxDownloads: "", email: "" });
  ok(!!ask && (await visitor(`/enviar/${ask}`)).text.includes(`Recebidos ${marker}`), "O pedido de arquivos abre sem conta");
  const pub = (path, body, origin = base) => visitor(path, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) }).then((r) => ({ ...r, data: (() => { try { return JSON.parse(r.text); } catch { return null; } })() }));
  ok((await pub("/api/publico/envios", { token: ask, fileName: "instalador.exe", size: 10 })).status === 400, "Programa não entra pelo pedido de arquivos");
  ok((await pub("/api/publico/envios", { token: ask, fileName: "a.pdf", size: 10 }, "https://example.com")).status === 403, "Envio de outro site é recusado");
  const sent = randomBytes(1500);
  const vStart = await pub("/api/publico/envios", { token: ask, fileName: `comprovante-${marker}.pdf`, size: sent.length, mime: "application/pdf", senderName: "Marina" });
  ok(vStart.status === 200 && !!vStart.data.secret, "O visitante começa o envio");
  ok((await pub(`/api/publico/envios/${vStart.data.id}/partes`, { token: ask, secret: "outro", parts: [1] })).status === 404, "Sem o segredo do envio, ninguém continua o envio de outro visitante");
  const vSigned = await pub(`/api/publico/envios/${vStart.data.id}/partes`, { token: ask, secret: vStart.data.secret, parts: [1] });
  const vPut = await fetch(vSigned.data[0].url, { method: "PUT", body: sent });
  const vDone = await pub(`/api/publico/envios/${vStart.data.id}/concluir`, { token: ask, secret: vStart.data.secret, parts: [{ partNumber: 1, etag: vPut.headers.get("etag") }] });
  const received = await one("select id, author_id as owner_id, folder_id, company_id, storage_key from console_bookmarks where file_name=$1", [`comprovante-${marker}.pdf`]);
  ok(vDone.status === 200 && received?.folder_id === inbox && received.company_id === ids.a && received.owner_id === people.manager.id && r2.objects.get(received.storage_key)?.equals(sent), "O arquivo chega na pasta, no nome de quem pediu");
  ok(!!(await one("select 1 as ok from console_audit_events where action='bookmark.received' and entity_id=$1 and details->>'sender'='Marina'", [received.id])), "O recebimento fica registrado com o nome de quem enviou");
  ok(!(await visitor(`/enviar/${ask}`)).text.includes(`comprovante-${marker}`), "Quem envia não vê o que já está na pasta");
  // Whoever made the link lost the right (left the company, account deleted): the link reads as turned off.
  const maker = (await one("select created_by from console_share_links where folder_id=$1", [inbox])).created_by;
  await db.query("update console_share_links set created_by=$2 where folder_id=$1", [inbox, people.outsider.id]);
  ok((await visitor(`/enviar/${ask}`)).text.includes("desligado") && (await pub("/api/publico/envios", { token: ask, fileName: "c.pdf", size: 10 })).status === 410, "Sem o direito de quem criou, o link para");
  await db.query("update console_share_links set created_by=$2 where folder_id=$1", [inbox, maker]);
  ok(!(await share("outsider", { kind: "request", bookmarkId: "", folderId: inbox, expiresInDays: "7", password: "", maxDownloads: "", email: "" })), "Quem não é da empresa não cria link da pasta");
  await db.query("update console_share_links set expires_at = now() - interval '1 minute' where folder_id=$1", [inbox]);
  ok((await pub("/api/publico/envios", { token: ask, fileName: "b.pdf", size: 10 })).status === 410 && (await visitor(`/enviar/${ask}`)).text.includes("venceu"), "Vencido, o pedido não recebe mais");

  // Fase 2c: folders inside folders; the inside sees what the outside sees; moving and deleting keep everything.
  const folderId = async (name) => (await one("select id from console_bookmark_folders where name=$1", [name]))?.id;
  await submitForm("/bookmarks", "manager", "manager", { action: "createFolder" }, { companyId: ids.a, name: `Cliente ${marker}`, visibility: "people" });
  const top = await folderId(`Cliente ${marker}`);
  await submitForm("/bookmarks", "manager", "manager", { action: "createFolder" }, { companyId: "", name: `Sub ${marker}`, visibility: "company", parentId: top });
  const sub = await one("select id, parent_id, company_id, visibility from console_bookmark_folders where name=$1", [`Sub ${marker}`]);
  ok(sub?.parent_id === top && sub.company_id === ids.a && sub.visibility === "people", "A subpasta fica dentro da outra, na mesma empresa, e herda quem vê");
  await submitForm("/bookmarks", "manager", "finance", { action: "createFolder" }, { companyId: ids.a, name: `Intrusa ${marker}`, visibility: "company", parentId: top });
  ok(!(await folderId(`Intrusa ${marker}`)), "Quem não vê a pasta não cria pasta dentro dela");
  await submitForm("/bookmarks", "manager", "manager", { action: "shareFolder" }, { id: top, visibility: "people", userIds: people.finance.id });
  ok(!!(await one("select 1 as ok from console_bookmark_folder_shares where folder_id=$1 and user_id=$2", [sub.id, people.finance.id])), "Compartilhar a pasta leva o compartilhamento para as de dentro");
  const subPage = await request(`/bookmarks?pasta=${sub.id}`, "finance");
  ok(subPage.text.includes(`Sub ${marker}`) && subPage.text.includes(`Cliente ${marker}`), "Dentro da subpasta, o caminho mostra a pasta de cima");
  await submitForm("/bookmarks", "manager", "manager", { action: "moveFolder" }, { id: top, parentId: sub.id });
  ok((await one("select parent_id from console_bookmark_folders where id=$1", [top]))?.parent_id === null, "Uma pasta não vai para dentro dela mesma");
  await submitForm("/bookmarks", "admin", "admin", { action: "createFolder" }, { companyId: "", name: `Interna ${marker}`, visibility: "company" });
  await submitForm("/bookmarks", "admin", "admin", { action: "moveFolder" }, { id: sub.id, parentId: await folderId(`Interna ${marker}`) });
  ok((await one("select parent_id from console_bookmark_folders where id=$1", [sub.id]))?.parent_id === top, "Pasta não vai para outra empresa");
  await submitForm("/bookmarks", "manager", "finance", { action: "moveFolder" }, { id: sub.id, parentId: "" });
  ok((await one("select parent_id from console_bookmark_folders where id=$1", [sub.id]))?.parent_id === top, "Só quem criou a pasta (ou a equipe) a move");
  await submitForm("/bookmarks", "manager", "manager", { action: "saveBookmark" }, { companyId: ids.a, folderId: sub.id, title: `Dentro ${marker}`, url: "https://example.invalid/dentro" });
  await submitForm("/bookmarks", "manager", "manager", { action: "deleteFolder" }, { id: sub.id });
  ok((await one("select folder_id from console_bookmarks where title=$1", [`Dentro ${marker}`]))?.folder_id === top, "Excluir a subpasta leva o que tinha dentro para a pasta de cima");
  await submitForm("/bookmarks", "manager", "manager", { action: "createFolder" }, { companyId: "", name: `Sub2 ${marker}`, visibility: "company", parentId: top });
  const sub2 = await folderId(`Sub2 ${marker}`);
  await submitForm("/bookmarks", "manager", "manager", { action: "deleteFolder" }, { id: top });
  ok((await one("select parent_id from console_bookmark_folders where id=$1", [sub2]))?.parent_id === null && (await one("select folder_id from console_bookmarks where title=$1", [`Dentro ${marker}`]))?.folder_id === null, "Excluir a pasta de cima sobe as de dentro para o início");
  // The suites clean their own folders (the run's cleanup removes companies, not folders).
  const leftovers = [sub2, await folderId(`Interna ${marker}`), inbox].filter(Boolean);
  await db.query("update console_bookmarks set folder_id=null where folder_id=any($1::text[])", [leftovers]);
  await db.query("update console_file_uploads set folder_id=null where folder_id=any($1::text[])", [leftovers]);
  await db.query("delete from console_share_links where folder_id=any($1::text[])", [leftovers]);
  await db.query("delete from console_bookmark_folder_shares where folder_id=any($1::text[])", [leftovers]);
  await db.query("delete from console_bookmark_folders where id=any($1::text[])", [leftovers]);

  // Fase 2b: "Excluir" moves to the trash, the file kept in R2; restore brings it back; only "Excluir de vez" or 30 days remove it.
  const cron = (path) => request(path, undefined, { headers: { Authorization: "Bearer test-cron-secret" } });
  await submitForm("/bookmarks", "admin", "admin", { action: "deleteBookmark" }, { id: saved.id });
  let trashed = await one("select deleted_at, deleted_by from console_bookmarks where id=$1", [saved.id]);
  ok(!!trashed?.deleted_at && r2.objects.has(`anuntech/${upload.id}`), "Excluir manda para a lixeira e o arquivo continua no R2");
  ok((await request(`/api/bookmarks/${saved.id}`, "admin")).status === 404, "Item na lixeira não baixa");
  ok(!(await request("/bookmarks?q=" + encodeURIComponent(marker), "admin")).text.includes(`Vídeo ${marker}`), "Item na lixeira sai da lista");
  const trashPage = await request("/bookmarks?pasta=lixeira", "admin");
  ok(trashPage.text.includes(`Vídeo ${marker}`), "Item aparece na Lixeira");
  await submitForm("/bookmarks", "admin", "manager", { action: "restoreBookmark" }, { id: saved.id });
  await submitForm("/bookmarks", "admin", "manager", { action: "purgeBookmark" }, { id: saved.id });
  ok(!!(await one("select deleted_at from console_bookmarks where id=$1", [saved.id]))?.deleted_at, "Cliente não restaura nem apaga item do espaço da Anuntech");
  await submitForm("/bookmarks", "admin", "admin", { action: "restoreBookmark" }, { id: saved.id });
  ok(!(await one("select deleted_at from console_bookmarks where id=$1", [saved.id]))?.deleted_at && (await request(`/api/bookmarks/${saved.id}`, "admin")).status === 302, "Restaurar traz o item de volta, e ele baixa de novo");
  await submitForm("/bookmarks", "admin", "admin", { action: "purgeBookmark" }, { id: saved.id });
  ok(!!(await one("select 1 as ok from console_bookmarks where id=$1", [saved.id])), "Excluir de vez só vale para o que está na lixeira");
  await submitForm("/bookmarks", "admin", "admin", { action: "deleteBookmark" }, { id: saved.id });
  await submitForm("/bookmarks", "admin", "admin", { action: "purgeBookmark" }, { id: saved.id });
  ok(!(await one("select 1 as ok from console_bookmarks where id=$1", [saved.id])) && !r2.objects.has(`anuntech/${upload.id}`), "Excluir de vez tira o item e o arquivo do R2");

  // The daily routine: 30 days in the trash and it is gone; a finished upload never saved is cleared too.
  await submitForm("/bookmarks", "manager", "manager", { action: "deleteBookmark" }, { id: photo.id });
  const photoKey = (await one("select storage_key from console_bookmarks where id=$1", [photo.id])).storage_key;
  await db.query("update console_bookmarks set deleted_at = now() - interval '31 days' where id=$1", [photo.id]);
  const orphanBytes = randomBytes(1000);
  started = await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: "esquecido.bin", size: orphanBytes.length });
  await sendParts("manager", started.data, orphanBytes);
  await db.query("update console_file_uploads set expires_at = now() - interval '1 hour' where id=$1", [started.data.id]);
  const run = await cron("/api/cron/arquivos");
  ok(run.status === 200 && !(await one("select 1 as ok from console_bookmarks where id=$1", [photo.id])) && !r2.objects.has(photoKey), "Depois de 30 dias na lixeira, a rotina apaga o item e o arquivo");
  ok(!r2.objects.has(afterReplace.storage_key) && !(await one("select 1 as ok from console_file_versions where bookmark_id=$1", [photo.id])), "As versões saem junto, do banco e do R2");
  ok(!(await one("select 1 as ok from console_file_uploads where id=$1", [started.data.id])) && !r2.objects.has(`${ids.a}/${started.data.id}`), "Envio concluído e nunca salvo some na rotina, com o arquivo");

  // Fase 4a: the text inside the files, for the search. Read right after saving, accents out, only for who sees the item; a new version is read again.
  const PDFDocument = (await import("pdfkit")).default;
  const pdfOf = (line) =>
    new Promise((resolve) => {
      const doc = new PDFDocument();
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.text(line);
      doc.end();
    });
  const { zipSync, strToU8 } = await import("fflate");
  const docxOf = (line) => Buffer.from(zipSync({ "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>${line}</w:t></w:r></w:p></w:body></w:document>`) }));
  const sendFile = async (who, companyId, fileName, data, mime) => {
    const begun = await json(who, "/api/arquivos/envios", { companyId, folderId: "", fileName, size: data.length, mime });
    await sendParts(who, begun.data, data);
    return begun.data.id;
  };
  const saveFile = async (who, companyId, title, fileName, data, mime) => {
    const uploadId = await sendFile(who, companyId, fileName, data, mime);
    await submitForm("/bookmarks", who, who, { action: "saveBookmark" }, { companyId, folderId: "", title, kind: "file", uploadId });
    return (await one("select id from console_bookmarks where title=$1", [title])).id;
  };
  const textOf = async (id, until = (row) => !!row) => {
    for (let i = 0; i < 60; i++) {
      const row = await one("select status, text, source_key, reason from console_file_texts where bookmark_id=$1", [id]);
      if (until(row)) return row;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  };
  const contract = await saveFile("manager", ids.a, `Contrato ${marker}`, "contrato.pdf", await pdfOf(`Contrato de manutenção da vitrine. Cláusula de reajuste anual pelo IPCA, código ${marker}.`), "application/pdf");
  const brief = await saveFile("manager", ids.a, `Briefing ${marker}`, "briefing.docx", docxOf(`Briefing da campanha: público jovem, orçamento aprovado em outubro.`), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const contractText = await textOf(contract);
  ok(contractText?.status === "done" && contractText.text.includes("reajuste anual"), "O texto do PDF é lido logo depois de salvar");
  ok((await textOf(brief))?.text?.includes("orçamento aprovado"), "O texto do Word é lido");
  const found = await request(`/bookmarks?q=${encodeURIComponent("reajuste ipca")}`, "manager");
  ok(found.text.includes(`Contrato ${marker}`) && found.text.includes("⟦reajuste⟧"), "A busca acha a palavra dentro do PDF e mostra o trecho");
  ok((await request(`/bookmarks?q=${encodeURIComponent("orcamento aprovado")}`, "manager")).text.includes(`Briefing ${marker}`), "A busca no conteúdo ignora os acentos");
  ok(!(await request(`/bookmarks?q=${encodeURIComponent("orcamento aprovado")}`, "outsider")).text.includes(`Briefing ${marker}`), "A busca no conteúdo não mostra arquivo de outra empresa");
  await submitForm("/bookmarks", "manager", "manager", { action: "replaceBookmarkFile" }, { id: contract, uploadId: await sendFile("manager", ids.a, "contrato-v2.docx", docxOf("Aditivo de prazo, sem reajuste."), "application/octet-stream") });
  const reread = await textOf(contract, (row) => row?.source_key !== contractText.source_key);
  ok(reread?.text === "Aditivo de prazo, sem reajuste.", "Uma nova versão é lida de novo");
  ok(!(await request(`/bookmarks?q=${encodeURIComponent("manutenção vitrine")}`, "manager")).text.includes(`Contrato ${marker}`), "O texto da versão antiga sai da busca");
  // The routine reads what was left (an older file, a read that failed).
  await db.query("delete from console_file_texts where bookmark_id=$1", [brief]);
  const textRun = await cron("/api/cron/arquivos-texto");
  ok(textRun.status === 200 && (await one("select status from console_file_texts where bookmark_id=$1", [brief]))?.status === "done", "A rotina lê os arquivos que ficaram sem texto");
  ok((await request("/api/cron/arquivos-texto", undefined)).status === 401, "A rotina pede a chave");

  // Fase 4c: a tag suggested from the name and the text; the model only when no rule fits; a person's choice stays.
  const tagOf = async (id, until = (row) => row?.tag_source) => {
    for (let i = 0; i < 60; i++) {
      const row = await one("select tag, tag_source from console_bookmarks where id=$1", [id]);
      if (until(row)) return row;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  };
  ok((await tagOf(brief))?.tag === "briefing", "O Briefing recebe a etiqueta pelo nome");
  ok((await tagOf(contract))?.tag === "contrato" && (await one("select tag_source from console_bookmarks where id=$1", [contract])).tag_source === "auto", "O Contrato recebe a etiqueta sugerida");
  const notes = `Notas soltas da equipe ${marker}. ${"Conversamos sobre prazos e escopo do próximo trimestre. ".repeat(6)} ETIQUETA-PROPOSTA contato maria@example.com, CPF 123.456.789-09.`;
  const loose = await saveFile("manager", ids.a, `Notas ${marker}`, "notas.txt", Buffer.from(notes), "text/plain");
  ok((await tagOf(loose))?.tag === "proposta", "Sem regra que sirva, a IA escolhe uma etiqueta da lista");
  const tagCalls = readFileSync(aiFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((e) => e.fileTag);
  ok(tagCalls.length > 0 && tagCalls.every((e) => e.scrubbed && e.zeroDataRetention === true && e.disallowPromptTraining === true), "O texto vai à IA sem e-mail e CPF, por provedor que não guarda nem treina");
  const listed4c = await request("/bookmarks?etiqueta=briefing", "manager");
  ok(listed4c.text.includes(`Briefing ${marker}`) && !listed4c.text.includes(`Contrato ${marker}`) && listed4c.text.includes("Todas as etiquetas"), "A lista filtra por etiqueta");
  await submitForm("/bookmarks", "manager", "support", { action: "updateBookmark" }, { id: contract, title: `Contrato ${marker}`, url: "", folderId: "", tag: "relatorio" });
  ok((await one("select tag from console_bookmarks where id=$1", [contract])).tag === "contrato", "Só quem edita o item troca a etiqueta");
  await submitForm("/bookmarks", "manager", "manager", { action: "updateBookmark" }, { id: brief, title: `Briefing ${marker}`, url: "", folderId: "", tag: "briefing" });
  ok((await one("select tag_source from console_bookmarks where id=$1", [brief])).tag_source === "auto", "Salvar sem trocar a etiqueta mantém a sugestão");
  await submitForm("/bookmarks", "manager", "manager", { action: "updateBookmark" }, { id: contract, title: `Contrato ${marker}`, url: "", folderId: "", tag: "" });
  ok((await one("select tag, tag_source from console_bookmarks where id=$1", [contract])).tag_source === "person", "Tirar a etiqueta vale como escolha da pessoa");
  await submitForm("/bookmarks", "manager", "manager", { action: "replaceBookmarkFile" }, { id: contract, uploadId: await sendFile("manager", ids.a, "contrato-v3.pdf", await pdfOf("CONTRATO DE PRESTAÇÃO DE SERVIÇOS. A CONTRATANTE..."), "application/pdf") });
  await textOf(contract, (row) => row?.text?.includes("CONTRATANTE"));
  ok((await one("select tag, tag_source from console_bookmarks where id=$1", [contract])).tag === null, "Uma nova versão não muda a etiqueta que a pessoa escolheu");
  await submitForm("/bookmarks", "manager", "manager", { action: "updateBookmark" }, { id: brief, title: `Briefing ${marker}`, url: "", folderId: "", tag: "inventada" });
  ok((await one("select tag from console_bookmarks where id=$1", [brief])).tag === "briefing", "Etiqueta fora da lista é recusada");

  // Fase 4d: a signed contract and a delivered task's file land in Arquivos by themselves, behind the same doors as their source.
  const signed4d = randomUUID();
  await db.query(
    "insert into console_contracts(id,company_id,title,body,author_id,status,published_at,published_version,publication,document_hash,signed_at,signed_pdf) values($1,$2,$3,'x',$4,'signed',now(),1,$5,'h4d',now(),$6)",
    [signed4d, ids.a, `Suporte mensal ${marker}`, people.admin.id, JSON.stringify({ title: `Suporte mensal ${marker}`, body: "x", companyName: "A", companyDocument: "0", kind: "contract", version: 1 }), await pdfOf(`CONTRATO DE SUPORTE ${marker}. A CONTRATANTE e a CONTRATADA...`)],
  );
  const project4d = randomUUID();
  const delivered = randomUUID();
  const drafting = randomUUID();
  await db.query("insert into console_engagements(id,company_id,name,kind) values($1,$2,$3,'project')", [project4d, ids.a, `Site novo ${marker}`]);
  await db.query("insert into console_tasks(id,engagement_id,company_id,title,status,created_by) values($1,$2,$3,$4,'review',$5),($6,$2,$3,$7,'in_progress',$5)", [delivered, project4d, ids.a, `Layout da home ${marker}`, people.admin.id, drafting, `Rascunho ${marker}`]);
  const homePng = randomBytes(900);
  const deliveryFile = randomUUID();
  await db.query("insert into console_attachments(id,task_id,author_id,name,mime,size,content) values($1,$2,$3,'home.png','image/png',$4,$5),($6,$7,$3,'rascunho.png','image/png',3,$8)", [deliveryFile, delivered, people.admin.id, homePng.length, homePng, randomUUID(), drafting, Buffer.from("abc")]);
  const usedBefore = (await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: "x.bin", size: 1 })).status;
  ok((await cron("/api/cron/arquivos-texto")).status === 200, "A rotina de Arquivos roda");
  const contractCopy = await one("select b.id, b.storage_key, f.name, f.area, f.origin from console_bookmarks b join console_bookmark_folders f on f.id=b.folder_id where b.origin=$1", [`contract:${signed4d}`]);
  ok(contractCopy?.name === "Contratos" && contractCopy.area === "finance" && r2.objects.has(contractCopy.storage_key), "O contrato assinado cai em Contratos, no R2");
  const deliveryCopy = await one("select b.id, b.storage_key, b.title, f.engagement_id, p.origin as parent from console_bookmarks b join console_bookmark_folders f on f.id=b.folder_id join console_bookmark_folders p on p.id=f.parent_id where b.origin=$1", [`attachment:${deliveryFile}`]);
  ok(deliveryCopy?.engagement_id === project4d && deliveryCopy.parent === "deliveries" && deliveryCopy.title === `Layout da home ${marker}` && r2.objects.get(deliveryCopy.storage_key)?.equals(homePng), "O arquivo da entrega cai em Entregas › projeto");
  ok(!(await one("select 1 as ok from console_bookmarks where title=$1", [`Rascunho ${marker}`])), "Tarefa ainda em andamento não é entrega");
  await cron("/api/cron/arquivos-texto");
  ok(Number((await one("select count(*) as n from console_bookmarks where origin=any($1::text[])", [[`contract:${signed4d}`, `attachment:${deliveryFile}`]])).n) === 2, "Rodar de novo não duplica as cópias");
  // The Membro of company A, active for these checks (an earlier suite turns them off), as they were afterwards.
  const supportWas = (await one("select active from console_memberships where company_id=$1 and email=$2", [ids.a, people.support.email])).active;
  await db.query("update console_memberships set active=true where company_id=$1 and email=$2", [ids.a, people.support.email]);
  ok((await request(`/api/bookmarks/${brief}`, "support")).status === 302, "O Membro abre os arquivos da empresa");
  ok((await request(`/api/bookmarks/${contractCopy.id}`, "manager")).status === 302 && (await request(`/api/bookmarks/${contractCopy.id}`, "support")).status !== 302, "O contrato copiado abre para o Administrador e não para o Membro");
  // The search field repeats what was typed; the item's own title ends in "(assinado)".
  ok((await request(`/bookmarks?q=${encodeURIComponent(`Suporte mensal ${marker}`)}`, "manager")).text.includes(`Suporte mensal ${marker} (assinado)`), "O Administrador acha o contrato copiado na busca");
  ok(!(await request(`/bookmarks?q=${encodeURIComponent(`Suporte mensal ${marker}`)}`, "support")).text.includes(`Suporte mensal ${marker} (assinado)`), "Nem a busca mostra o contrato ao Membro");
  ok((await request(`/api/bookmarks/${deliveryCopy.id}`, "support")).status === 302, "A entrega abre para o Membro que vê o projeto");
  await db.query("update console_memberships set engagement_access='selected' where company_id=$1 and email=$2", [ids.a, people.support.email]);
  ok((await request(`/api/bookmarks/${deliveryCopy.id}`, "support")).status !== 302 && !(await request("/bookmarks", "support")).text.includes(`Site novo ${marker}`), "Membro que não vê o projeto não vê a pasta nem a entrega");
  await db.query("update console_memberships set engagement_access='all', active=$3 where company_id=$1 and email=$2", [ids.a, people.support.email, supportWas]);
  const contractsFolder = (await one("select id from console_bookmark_folders where company_id=$1 and origin='contracts'", [ids.a])).id;
  await submitForm("/bookmarks", "admin", "admin", { action: "deleteFolder" }, { id: contractsFolder });
  ok(!!(await one("select 1 as ok from console_bookmark_folders where id=$1", [contractsFolder])), "A pasta do Console não é excluída, nem pela equipe");
  await submitForm("/bookmarks", "manager", "manager", { action: "createFolder" }, { companyId: ids.a, name: `Dentro de Contratos ${marker}`, visibility: "company", parentId: contractsFolder });
  ok((await one("select area from console_bookmark_folders where name=$1", [`Dentro de Contratos ${marker}`]))?.area === "finance", "Uma pasta criada dentro de Contratos herda a trava");
  ok(usedBefore === 200 && (await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: "", fileName: "x.bin", size: 1 })).status === 200, "As cópias do Console não ocupam o espaço da empresa");
  // What is behind a gate stays behind it: no move, edit or folder move takes it out.
  const inner = (await one("select id from console_bookmark_folders where name=$1", [`Dentro de Contratos ${marker}`])).id;
  await submitForm("/bookmarks", "manager", "manager", { action: "saveBookmark" }, { companyId: ids.a, folderId: inner, title: `Aditivo ${marker}`, kind: "link", url: "https://example.com/aditivo" });
  const addendum = (await one("select id from console_bookmarks where title=$1", [`Aditivo ${marker}`])).id;
  await submitForm("/bookmarks", "manager", "manager", { action: "moveBookmark" }, { id: addendum, folderId: "" });
  await submitForm("/bookmarks", "manager", "manager", { action: "updateBookmark" }, { id: addendum, title: `Aditivo ${marker}`, url: "https://example.com/aditivo", folderId: "" });
  ok((await one("select folder_id from console_bookmarks where id=$1", [addendum])).folder_id === inner, "Item de pasta restrita não sai para uma pasta aberta");
  await submitForm("/bookmarks", "manager", "manager", { action: "moveFolder" }, { id: inner, parentId: "" });
  ok((await one("select parent_id from console_bookmark_folders where id=$1", [inner])).parent_id === contractsFolder, "Pasta restrita não sai de trás da trava");
  await submitForm("/bookmarks", "admin", "admin", { action: "replaceBookmarkFile" }, { id: contractCopy.id, uploadId: await sendFile("admin", ids.a, "outro.pdf", Buffer.from("%PDF-1"), "application/pdf") });
  ok((await one("select storage_key from console_bookmarks where id=$1", [contractCopy.id])).storage_key === contractCopy.storage_key, "A cópia do Console não recebe nova versão");
  // A project with something a person put in its deliveries folder is not deleted until that is moved.
  const projectFolder = (await one("select id from console_bookmark_folders where engagement_id=$1", [project4d])).id;
  await submitForm("/bookmarks", "admin", "admin", { action: "saveBookmark" }, { companyId: ids.a, folderId: projectFolder, title: `Nota ${marker}`, kind: "link", url: "https://example.com/nota" });
  await submitForm("/projetos", "admin", "admin", { action: "deleteEngagement" }, { id: project4d, from: "list" });
  ok(!!(await one("select 1 as ok from console_engagements where id=$1", [project4d])), "Projeto com arquivo de alguém na pasta de entregas não é excluído");
  await db.query("delete from console_bookmarks where title=$1", [`Nota ${marker}`]);
  await submitForm("/projetos", "admin", "admin", { action: "deleteEngagement" }, { id: project4d, from: "list" });
  ok(!(await one("select 1 as ok from console_engagements where id=$1", [project4d])) && !(await one("select 1 as ok from console_bookmarks where id=$1", [deliveryCopy.id])) && !r2.objects.has(deliveryCopy.storage_key) && !(await one("select 1 as ok from console_bookmark_folders where engagement_id=$1", [project4d])), "Excluir o projeto leva a pasta e as cópias das entregas");
  // The suite cleans what it made (the run's cleanup removes companies, not folders or contracts).
  await db.query("delete from console_bookmarks where origin=$1 or folder_id in (select id from console_bookmark_folders where company_id=$2 and (origin is not null or area is not null))", [`contract:${signed4d}`, ids.a]);
  await db.query("delete from console_bookmark_folders where company_id=$1 and parent_id is not null and (origin is not null or area is not null)", [ids.a]);
  await db.query("delete from console_bookmark_folders where company_id=$1 and origin is not null", [ids.a]);
  await db.query("delete from console_contracts where id=$1", [signed4d]);

  // Fase 5a: a folder, its subfolders included, as one .zip built while it is sent; through a link too, as one download.
  const { unzipSync } = await import("fflate");
  await submitForm("/bookmarks", "manager", "manager", { action: "createFolder" }, { companyId: ids.a, name: `Pacote ${marker}`, visibility: "company" });
  const pack = (await one("select id from console_bookmark_folders where name=$1", [`Pacote ${marker}`])).id;
  await submitForm("/bookmarks", "manager", "manager", { action: "createFolder" }, { companyId: "", name: "Logos", visibility: "company", parentId: pack });
  const logos = (await one("select id from console_bookmark_folders where name='Logos' and parent_id=$1", [pack])).id;
  const putIn = async (folder, title, fileName, data) => {
    const begun = await json("manager", "/api/arquivos/envios", { companyId: ids.a, folderId: folder, fileName, size: data.length });
    await sendParts("manager", begun.data, data);
    await submitForm("/bookmarks", "manager", "manager", { action: "saveBookmark" }, { companyId: ids.a, folderId: folder, title, kind: "file", uploadId: begun.data.id });
  };
  const readme = Buffer.from(`Leia-me ${marker}`);
  const bigOne = randomBytes(17 * 1024 * 1024);
  await putIn(pack, `Leia-me ${marker}`, "leiame.txt", readme);
  await putIn(pack, `Leia-me 2 ${marker}`, "leiame.txt", Buffer.from("segundo"));
  await putIn(logos, `Logo ${marker}`, "logo.bin", bigOne);
  // The bytes as they come (the suite's request reads text).
  const raw = async (path, who) => {
    const r = await fetch(base + path, { headers: who ? { Cookie: people[who].cookie } : {}, redirect: "manual" });
    return { status: r.status, headers: r.headers, bytes: new Uint8Array(await r.arrayBuffer()) };
  };
  const zipped = await raw(`/api/bookmarks/pastas/${pack}/zip`, "manager");
  const archive = unzipSync(zipped.bytes);
  ok(zipped.status === 200 && (zipped.headers.get("content-disposition") ?? "").includes(encodeURIComponent(`Pacote ${marker}.zip`)), "A pasta baixa como .zip com o nome dela");
  const texts = [archive["leiame.txt"], archive["leiame (2).txt"]].map((bytes) => Buffer.from(bytes ?? []).toString()).sort();
  ok(texts.join("|") === [readme.toString(), "segundo"].sort().join("|") && Buffer.from(archive["Logos/logo.bin"] ?? []).equals(bigOne), "O .zip leva os arquivos, as subpastas e numera nomes repetidos");
  ok(!!(await one("select 1 as ok from console_audit_events where action='bookmark_folder.downloaded' and entity_id=$1", [pack])), "O download da pasta fica registrado");
  ok((await request(`/api/bookmarks/pastas/${pack}/zip`, "outsider")).status === 404, "Pessoa de fora não baixa a pasta");
  const packLink = await share("manager", { kind: "download", bookmarkId: "", folderId: pack, expiresInDays: "7", password: "", maxDownloads: "1", email: "" });
  ok((await visitor(`/compartilhado/${packLink}`)).text.includes("Baixar tudo (.zip)"), "O link da pasta oferece baixar tudo");
  const viaLinkZip = await raw(`/compartilhado/${packLink}/zip`);
  ok(viaLinkZip.status === 200 && Object.keys(unzipSync(viaLinkZip.bytes)).length === 3, "Pelo link, a pasta inteira baixa em .zip");
  ok((await visitor(`/compartilhado/${packLink}/zip`)).status === 303, "O .zip conta como um download do limite");
  await db.query("update console_bookmarks set folder_id=null where folder_id=any($1::text[])", [[pack, logos]]);
  await db.query("update console_file_uploads set folder_id=null where folder_id=any($1::text[])", [[pack, logos]]);
  await db.query("delete from console_share_links where folder_id=$1", [pack]);
  await db.query("delete from console_bookmark_folders where id=$1", [logos]);
  await db.query("delete from console_bookmark_folders where id=$1", [pack]);

  // The links point at the company; the run's cleanup removes companies.
  await db.query("delete from console_share_links where company_id=$1 or company_id is null and created_by=any($2::text[])", [ids.a, Object.values(people).map((p) => p.id)]);
}
