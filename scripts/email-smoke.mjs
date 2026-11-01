/**
 * E-mail (lib/mail) against a local JMAP stand-in (scripts/jmap-mock.mjs),
 * never the real server: the team's own mailbox lists, reads (scripts and
 * handlers gone, remote images blocked, cid images inlined, marked read),
 * searches, downloads, sends (audit without content), moves, stars and
 * deletes from the Lixeira. Refused: a client's member, the team on someone
 * else's address, no session, someone else's attachment, another site.
 */
export async function runEmailTests({ database: db, people, request, submitForm, ok, marker, base, jmap, notFoundPage }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const mine = `qa-mail-${marker}@anuntech.com`;
  const other = `qa-outra-${marker}@anuntech.com`;
  const me = jmap.addAccount(mine);
  const them = jmap.addAccount(other);
  // The admin's account has the mailbox's address among its verified e-mails.
  await db.query("insert into console_account_emails(id,user_id,email,verified_at) values($1,$2,$3,now())", [
    `qa-mail-${marker}`,
    people.admin.id,
    mine,
  ]);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const pdf = Buffer.from(`%PDF-1.4 relatorio ${marker}`);
  const html = jmap.addEmail(me, {
    from: [{ name: "Cliente QA", email: "cliente@example.invalid" }],
    to: [{ name: "QA", email: mine }],
    cc: [{ email: "bia@example.invalid" }],
    subject: `HTML ${marker}`,
    text: `Resumo do HTML ${marker}`,
    html: `<html><head><title>T</title><meta http-equiv="refresh" content="0;url=https://evil.example"></head><body onload="steal()"><script>steal()</script><p onclick="steal()">Olá <a href="javascript:steal()">clique</a></p><img src="cid:logo@qa"><img src="https://tracker.example/pixel.gif"><form action="https://evil.example"><input name="x"></form><iframe src="https://evil.example"></iframe></body></html>`,
    attachments: [
      { name: "logo.png", type: "image/png", bytes: png, cid: "<logo@qa>" },
      { name: "relatorio.pdf", type: "application/pdf", bytes: pdf },
    ],
    receivedAt: "2026-10-31T12:00:00Z",
    messageId: `orig-${marker}@example.invalid`,
  });
  const text = jmap.addEmail(me, {
    from: [{ email: "fornecedor@example.invalid" }],
    to: [{ email: mine }],
    subject: `Texto ${marker}`,
    text: `Veja https://anuntech.com/x.\nSegunda linha ${marker}`,
    keywords: { $flagged: true },
    receivedAt: "2026-10-31T11:00:00Z",
  });
  const secret = jmap.addEmail(them, {
    from: [{ email: "alguem@example.invalid" }],
    to: [{ email: other }],
    subject: `SEGREDO-${marker}`,
    text: "Só da outra pessoa",
    attachments: [{ name: "segredo.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-segredo") }],
  });
  const touched = (accountId) => jmap.calls.filter((c) => c.accountId === accountId);

  try {
    // The list: folders in Portuguese, newest first, unread in bold, the dock's E-mail.
    const inbox = await request("/email", "admin");
    ok(inbox.status === 200 && inbox.text.includes(`HTML ${marker}`) && inbox.text.includes(`Texto ${marker}`), "A equipe abre a própria caixa em /email");
    ok(["Entrada", "Rascunhos", "Enviados", "Spam", "Lixeira", "Projetos"].every((name) => inbox.text.includes(name)), "As pastas aparecem com os nomes em português");
    ok(inbox.text.indexOf(`HTML ${marker}`) < inbox.text.indexOf(`Texto ${marker}`), "As mensagens vêm da mais nova para a mais antiga");
    ok(inbox.text.includes('href="/email"'), "O dock mostra E-mail para quem tem caixa");
    ok(!inbox.text.includes(`SEGREDO-${marker}`) && touched(them).length === 0, "A caixa de outra pessoa não é lida");
    const clientDock = await request("/painel", "manager");
    ok(clientDock.status === 200 && !clientDock.text.includes('href="/email"'), "O dock do cliente não mostra E-mail");

    // Reading: the HTML is cleaned and framed; opening marks it read.
    const read = await request(`/email?msg=${html.id}`, "admin");
    ok(read.status === 200 && read.text.includes("relatorio.pdf") && read.text.includes("Cliente QA"), "A mensagem abre com remetente e anexos");
    ok(
      !read.text.includes("steal()") && !read.text.includes("evil.example") && !read.text.includes("<script>steal"),
      "O HTML chega sem script, sem eventos, sem javascript:, sem formulário, sem iframe e sem meta refresh",
    );
    ok(read.text.includes('sandbox="allow-popups allow-popups-to-escape-sandbox"') && !/sandbox="[^"]*allow-scripts/.test(read.text), "O HTML abre num iframe sem scripts e sem a mesma origem");
    ok(read.text.includes("default-src &#x27;none&#x27;") || read.text.includes("default-src &amp;#x27;none&amp;#x27;") || read.text.includes("default-src 'none'"), "O iframe leva a política que não carrega nada de fora");
    ok(read.text.includes(`data:image/png;base64,${png.toString("base64")}`), "A imagem cid: pequena vira data: no servidor");
    ok(read.text.includes("Mostrar imagens") && read.text.includes("tracker.example"), "Imagens remotas ficam bloqueadas, com o botão Mostrar imagens");
    ok(jmap.email(me, html.id).keywords.$seen === true, "Abrir a mensagem marca como lida");
    const plain = await request(`/email?msg=${text.id}`, "admin");
    ok(plain.text.includes('href="https://anuntech.com/x"') && plain.text.includes("Segunda linha"), "Mensagem só de texto mostra as linhas e os links clicáveis");

    // Search goes to the server's filter.text.
    const found = await request(`/email?q=${encodeURIComponent(`Texto ${marker}`)}`, "admin");
    ok(
      found.text.includes(`Texto ${marker}`) && !found.text.includes(`HTML ${marker}`) && jmap.calls.some((c) => c.name === "Email/query" && c.args.filter?.text === `Texto ${marker}`),
      "A busca usa o texto no servidor",
    );

    // Downloads: the mailbox's own attachment, private and as a file.
    const pdfPart = html.attachments.find((a) => a.name === "relatorio.pdf");
    const link = (caixa, blob, nome = "relatorio.pdf") => `/api/email/anexo?caixa=${encodeURIComponent(caixa)}&blob=${blob}&nome=${encodeURIComponent(nome)}`;
    const download = await fetch(base + link(mine, pdfPart.blobId), { headers: { Cookie: people.admin.cookie } });
    const bytes = Buffer.from(await download.arrayBuffer());
    ok(
      download.status === 200 &&
        bytes.equals(pdf) &&
        /^attachment; filename\*=UTF-8''relatorio\.pdf$/.test(download.headers.get("content-disposition") ?? "") &&
        download.headers.get("cache-control") === "private, no-store" &&
        download.headers.get("x-content-type-options") === "nosniff",
      "O anexo baixa como arquivo, privado e sem sniffing",
    );

    // Sending: an attachment uploaded first, then the message; Enviados, the identity and the audit.
    const note = Buffer.from(`nota ${marker}`);
    const upload = await request(`/api/email/envio?caixa=${encodeURIComponent(mine)}`, "admin", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "text/plain" },
      body: note,
    });
    const blob = JSON.parse(upload.text);
    ok(upload.status === 200 && jmap.accounts.get(me).blobs.get(blob.blobId)?.bytes.equals(note), "O anexo sobe para a conta da caixa");
    const tooBig = await request(`/api/email/envio?caixa=${encodeURIComponent(mine)}`, "admin", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/octet-stream" },
      body: Buffer.alloc(4 * 1024 * 1024 + 1),
    });
    ok(tooBig.status === 413, "Anexo acima de 4 MB é recusado");
    const before = jmap.submissions.length;
    await submitForm("/email", "admin", "admin", { action: "sendEmail" }, {
      caixa: mine,
      para: "Ana <ana@example.invalid>, bia@example.invalid",
      cc: "",
      cco: "carlos@example.invalid",
      assunto: `Re: HTML ${marker}`,
      corpo: `CORPO-PRIVADO-${marker}`,
      anexos: JSON.stringify([{ blobId: blob.blobId, name: "nota.txt", type: "text/plain", size: note.length }]),
      inReplyTo: JSON.stringify([`orig-${marker}@example.invalid`]),
      references: JSON.stringify([`orig-${marker}@example.invalid`]),
    });
    const sent = jmap.submissions[before];
    const sentEmail = sent && jmap.email(me, sent.emailId);
    ok(
      jmap.submissions.length === before + 1 && sent.identity === mine && sent.from[0].email === mine && sent.from[0].name === "QA admin" && sent.bcc.length === 1,
      "O envio sai da caixa da pessoa, com o nome dela, para Para, Cc e Cco",
    );
    ok(
      sentEmail.mailboxIds[jmap.roleOf(me, "sent")] && !sentEmail.mailboxIds[jmap.roleOf(me, "drafts")] && !sentEmail.keywords.$draft,
      "A mensagem enviada vai para Enviados, sem a marca de rascunho",
    );
    ok(sentEmail.inReplyTo?.[0] === `orig-${marker}@example.invalid` && sentEmail.attachments.length === 1, "A resposta leva o In-Reply-To e o anexo");
    const audit = await one("select details from console_audit_events where action='email.sent' and actor_id=$1 order by created_at desc limit 1", [people.admin.id]);
    ok(
      audit?.details?.recipients === 3 && !JSON.stringify(audit.details).includes("PRIVADO") && !JSON.stringify(audit.details).includes("ana@example.invalid"),
      "O envio fica na auditoria com a quantidade de destinatários, sem o conteúdo",
    );
    await submitForm("/email", "admin", "admin", { action: "sendEmail" }, { caixa: mine, para: "nao-e-email", corpo: "x" });
    ok(jmap.submissions.length === before + 1, "Endereço inválido é recusado antes de enviar");

    // Star, unread, archive, Lixeira and deleting for good.
    const fields = { caixa: mine, pasta: "", q: "", pagina: "1", id: html.id };
    await submitForm("/email", "admin", "admin", { action: "starEmail" }, { ...fields, estrela: "1" });
    ok(jmap.email(me, html.id).keywords.$flagged === true, "Marcar com estrela");
    await submitForm("/email", "admin", "admin", { action: "markUnread" }, fields);
    ok(!jmap.email(me, html.id).keywords.$seen, "Marcar como não lida");
    await submitForm("/email", "admin", "admin", { action: "moveEmail" }, { ...fields, id: text.id, destino: "archive" });
    const archive = jmap.roleOf(me, "archive");
    ok(archive && jmap.email(me, text.id).mailboxIds[archive] && Object.keys(jmap.email(me, text.id).mailboxIds).length === 1, "Arquivar cria a pasta Arquivo e move a mensagem");
    await submitForm("/email", "admin", "admin", { action: "deleteForever" }, fields);
    ok(!!jmap.email(me, html.id), "Excluir de vez fora da Lixeira é recusado");
    await submitForm("/email", "admin", "admin", { action: "moveEmail" }, { ...fields, destino: "trash" });
    ok(jmap.email(me, html.id).mailboxIds[jmap.roleOf(me, "trash")], "Mover para a Lixeira");
    await submitForm("/email", "admin", "admin", { action: "deleteForever" }, fields);
    ok(!jmap.email(me, html.id), "Excluir de vez na Lixeira");

    // Refusals: a client's member, the team on another address, no session, someone else's attachment, another site.
    ok(notFoundPage(await request("/email", "manager")), "Membro de empresa cliente não abre /email");
    ok(notFoundPage(await request("/email", "support")), "Membro (papel Membro) de empresa cliente também não abre /email");
    const foreign = await request(`/email?caixa=${encodeURIComponent(other)}`, "admin");
    ok(notFoundPage(foreign) && !foreign.text.includes(`SEGREDO-${marker}`), "A equipe não abre a caixa de outro endereço");
    const anonymous = await request("/email");
    ok([303, 307, 308].includes(anonymous.status) && (anonymous.headers.get("location") ?? "").includes("/entrar"), "Sem sessão, /email manda entrar");
    const secretBlob = secret.attachments[0].blobId;
    ok((await request(link(other, secretBlob, "segredo.pdf"), "admin")).status === 404, "Anexo da caixa de outra pessoa não baixa");
    ok((await request(link(mine, secretBlob, "segredo.pdf"), "admin")).status === 404, "Anexo de outra caixa pela caixa própria não baixa");
    ok((await request(link(mine, pdfPart.blobId), "manager")).status === 404, "Cliente não baixa anexo da caixa da equipe");
    ok((await request(link(mine, pdfPart.blobId))).status === 401, "Sem sessão, o anexo não baixa");
    const crossSite = await request(`/api/email/envio?caixa=${encodeURIComponent(mine)}`, "admin", { method: "POST", headers: { Origin: "https://example.com" }, body: "x" });
    ok(crossSite.status === 403, "Anexo enviado de outro site é recusado");
    const foreignUpload = await request(`/api/email/envio?caixa=${encodeURIComponent(other)}`, "admin", { method: "POST", headers: { Origin: base }, body: "x" });
    ok(foreignUpload.status === 404, "Não dá para anexar na caixa de outra pessoa");
    const sentBefore = jmap.submissions.length;
    await submitForm("/email", "admin", "manager", { action: "sendEmail" }, { caixa: mine, para: "ana@example.invalid", corpo: "x" });
    await submitForm("/email", "admin", "admin", { action: "sendEmail" }, { caixa: other, para: "ana@example.invalid", corpo: "x" });
    await submitForm("/email", "admin", "admin", { action: "moveEmail" }, { caixa: other, pasta: "", q: "", pagina: "1", id: secret.id, destino: "trash" });
    ok(jmap.submissions.length === sentBefore, "Cliente e caixa alheia não enviam");
    ok(
      jmap.email(them, secret.id).mailboxIds[jmap.roleOf(them, "inbox")] && touched(them).filter((c) => c.name !== "download").length === 0,
      "Nenhuma ação chega à caixa de outra pessoa",
    );
    ok(touched(them).length === 0, "O servidor de e-mail nunca recebeu pedido na conta de outra pessoa");
  } finally {
    await db.query("delete from console_account_emails where id=$1", [`qa-mail-${marker}`]);
  }
}
