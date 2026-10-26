import { randomBytes } from "node:crypto";

/**
 * Arquivos with R2 (lib/drive): a file sent in parts straight to the bucket
 * (the suite plays the browser), finished by the Console, saved as a bookmark
 * and read back through a signed address; the quota, a lying size, missing
 * parts, someone else's upload, another company and another site refused;
 * deleting the bookmark removes the object.
 */
export async function runArquivosTests({ database: db, ids, people, request, submitForm, ok, marker, base, r2 }) {
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
  const leftovers = [sub2, await folderId(`Interna ${marker}`)].filter(Boolean);
  await db.query("update console_bookmarks set folder_id=null where folder_id=any($1::text[])", [leftovers]);
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
}
