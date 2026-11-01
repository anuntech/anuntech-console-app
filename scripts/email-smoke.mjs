import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * E-mail management (lib/mail) against a local stand-in of Stalwart's JMAP
 * admin API (scripts/jmap-mock.mjs) and of the DNS (scripts/dns-mock.cjs),
 * never the real server: the team lists the anuntech.com mailboxes, creates
 * one with a generated or typed password, resets it, edits name, quota and
 * aliases, downloads the Apple profile, manages forwards, reads the DNS
 * health and deletes (its own mailbox with one more confirmation).
 * Refused: a client's Administrador and Membro, assisted access, no session,
 * an account of another domain, an administrator account, colliding
 * addresses and the hourly limit. No password reaches the audit, the logs or
 * the database, and the Console never asks the server for a mailbox's mail.
 */
export async function runEmailTests({ database: db, people, request, ok, marker, base, jmap, notFoundPage, dnsFile, serverLogs }) {
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  const actionId = (name) => {
    const found = Object.entries(manifest).filter(([, action]) => action.exportedName === name);
    assert.equal(found.length, 1, `Ação ${name} encontrada no build`);
    return found[0][0];
  };
  // The call a page makes with JavaScript on: the reply is what the action returned.
  const call = async (page, who, name, values) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(values))
      for (const each of Array.isArray(value) ? value : [value]) body.append(`_1_${key}`, each);
    body.set("0", JSON.stringify([null, "$K1"]));
    return request(page, who, { method: "POST", body, headers: { Origin: base, "Next-Action": actionId(name), Accept: "text/x-component" } });
  };
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  const passwordIn = (reply) => /"password":"([^"]+)"/.exec(reply.text)?.[1] ?? null;
  const sets = (id) => jmap.calls.filter((c) => c.name.endsWith("/set") && JSON.stringify(c.args).includes(`"${id}"`));
  const shown = [];

  // The server as it is today, in miniature: anuntech.com with mailboxes, an admin account and a forward,
  // and teste.anuntech.cloud, where the admin and the service account live.
  const zone = `$ORIGIN anuntech.com.
@ 3600 IN MX 10 mx1.anuntech.cloud.
@ IN TXT "v=spf1 mx -all"
v1-rsa-20261026._domainkey IN TXT ( "v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqa"
  "${marker}" )
v1-ed25519-20261026._domainkey IN TXT "v=DKIM1; k=ed25519; h=sha256; p=ED25519KEY${marker}="
_dmarc IN TXT "v=DMARC1; p=reject; rua=mailto:postmaster@anuntech.com"
`;
  const anun = jmap.addDomain("anuntech.com", { dnsZoneFile: zone });
  const test = jmap.addDomain("teste.anuntech.cloud");
  const GB = 1024 ** 3;
  const kauan = jmap.addAccount({ name: "kauan", domainId: anun, description: "Kauan", quota: 5 * GB, used: 1.2 * GB, aliases: ["k"] });
  const finance = jmap.addAccount({ name: "finance", domainId: anun, description: "Financeiro", quota: 5 * GB, used: 4.8 * GB });
  const odd = jmap.addAccount({ name: `cota-${marker}`, domainId: anun, quota: 3 * GB });
  const boss = jmap.addAccount({ name: `chefe-${marker}`, domainId: anun, role: "Admin" });
  const admin = jmap.addAccount({ name: "admin", domainId: test, role: "Admin" });
  const service = jmap.addAccount({ name: "console", domainId: test, role: "Custom" });
  const outsider = jmap.addAccount({ name: `fora-${marker}`, domainId: test });
  const ownLocal = `qa-propria-${marker}`;
  const own = jmap.addAccount({ name: ownLocal, domainId: anun, description: "QA admin" });
  jmap.addList({ name: "alessandro", domainId: anun, description: "Alessandro", recipients: ["alessandro@gmail.example"] });
  const foreignList = jmap.addList({ name: `lista-${marker}`, domainId: test, recipients: ["x@example.invalid"] });
  // The admin's own mailbox is one of the account's verified e-mails.
  await db.query("insert into console_account_emails(id,user_id,email,verified_at) values($1,$2,$3,now())", [
    `qa-mail-${marker}`,
    people.admin.id,
    `${ownLocal}@anuntech.com`,
  ]);
  const limitKey = (scope) => createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(`${scope}:${people.admin.id}`).digest("hex");

  try {
    // The list: managed domain only, quota bars, protected accounts without actions, E-mail in the team's dock.
    const page = await request("/email", "admin");
    ok(page.status === 200 && page.text.includes("kauan@anuntech.com") && page.text.includes("finance@anuntech.com"), "A equipe vê as caixas de anuntech.com em /email");
    ok(!page.text.includes("teste.anuntech.cloud") && !page.text.includes(`fora-${marker}`), "Contas de outro domínio (admin e conta de serviço) não aparecem");
    ok(page.text.includes(`chefe-${marker}@anuntech.com`) && page.text.includes("Gerenciada no servidor"), "Conta de administrador aparece sem ações, como gerenciada no servidor");
    ok(page.text.includes("1,2 GB") && page.text.includes("de 5 GB") && page.text.includes('aria-valuenow="96"'), "Cada caixa mostra o espaço usado sobre a cota, com a barra");
    ok(page.text.includes('href="/email"'), "O dock da equipe mostra E-mail");
    const clientDock = await request("/painel", "manager");
    ok(clientDock.status === 200 && !clientDock.text.includes('href="/email"'), "O dock do cliente não mostra E-mail");

    // Who gets in: only the team; a client's Administrador and Membro, assisted access and no session do not.
    ok(notFoundPage(await request("/email", "manager")), "Administrador de empresa cliente não abre /email");
    ok(notFoundPage(await request("/email", "support")), "Membro de empresa cliente não abre /email");
    ok(notFoundPage(await request("/email", "assisted")), "No acesso assistido, a equipe não abre /email");
    ok(notFoundPage(await request("/email/redirecionamentos", "manager")) && notFoundPage(await request("/email/dns", "support")), "Cliente não abre redirecionamentos nem DNS");
    const anonymous = await request("/email");
    ok([303, 307, 308].includes(anonymous.status) && (anonymous.headers.get("location") ?? "").includes("/entrar"), "Sem sessão, /email manda entrar");

    // Create with a generated password: shown once, set on the server, never stored.
    const local = `qa-${marker}`;
    const created = await call("/email", "admin", "createMailbox", { domain: "anuntech.com", local: `  QA-${marker}@anuntech.com `, name: "Caixa QA", quota: "5", mode: "generate" });
    const generated = passwordIn(created);
    const box = jmap.find(jmap.accounts, local, anun);
    ok(
      created.status === 200 && !!generated && /^[A-Za-z2-9]{6}(-[A-Za-z2-9]{6}){3}$/.test(generated) && jmap.secretOf(box?.id) === generated,
      "Nova caixa com senha gerada: a senha forte volta uma vez e é a do servidor",
    );
    shown.push(generated);
    ok(
      box.roles["@type"] === "User" &&
        box.permissions["@type"] === "Inherit" &&
        box.encryptionAtRest["@type"] === "Disabled" &&
        box.quotas.maxDiskQuota === 5 * GB &&
        box.description === "Caixa QA" &&
        !Array.isArray(box.credentials) &&
        !Array.isArray(box.aliases),
      "A caixa nasce com papel User, permissões herdadas, sem criptografia, 5 GB e listas como objetos",
    );
    const audit = await one("select details from console_audit_events where action='email.mailbox.created' and entity_id=$1", [box.id]);
    ok(audit?.details?.address === `${local}@anuntech.com` && audit.details.generatedPassword === true && !JSON.stringify(audit.details).includes(generated), "A criação fica na auditoria, sem a senha");

    // Typed passwords: the Console's rule, then the server's.
    const short = await call("/email", "admin", "createMailbox", { domain: "anuntech.com", local: `qa-curta-${marker}`, name: "", quota: "1", mode: "type", password: "curta" });
    ok(short.text.includes("Use pelo menos 12 caracteres") && !jmap.find(jmap.accounts, `qa-curta-${marker}`, anun), "Senha digitada curta é recusada antes do servidor");
    const weak = await call("/email", "admin", "createMailbox", { domain: "anuntech.com", local: `qa-fraca-${marker}`, name: "", quota: "1", mode: "type", password: "senhafraca12345" });
    ok(weak.text.includes("achou a senha fraca") && !jmap.find(jmap.accounts, `qa-fraca-${marker}`, anun), "Senha que o servidor acha fraca volta com a explicação, sem criar a caixa");
    const typedSecret = `Cavalo-Bateria-Grampo-${marker}`;
    const typed = await call("/email", "admin", "createMailbox", { domain: "anuntech.com", local: `qa-digitada-${marker}`, name: "", quota: "10", mode: "type", password: typedSecret });
    const typedBox = jmap.find(jmap.accounts, `qa-digitada-${marker}`, anun);
    ok(typed.text.includes("criada") && jmap.secretOf(typedBox?.id) === typedSecret && !typed.text.includes(typedSecret) && typedBox.quotas.maxDiskQuota === 10 * GB, "Senha digitada vale no servidor e não volta na resposta");

    // Addresses that collide, the server's own and another domain are refused.
    const before = jmap.accounts.size;
    for (const [taken, why] of [
      ["kauan", "já é uma caixa"],
      ["k", "já é apelido"],
      ["alessandro", "já é um redirecionamento"],
      ["postmaster", "do próprio servidor"],
      ["joão", "sem acento"],
    ]) {
      const reply = await call("/email", "admin", "createMailbox", { domain: "anuntech.com", local: taken, name: "", quota: "1", mode: "generate" });
      ok(reply.text.includes(why) && !passwordIn(reply), `Endereço ${taken} é recusado (${why})`);
    }
    const otherDomain = await call("/email", "admin", "createMailbox", { domain: "teste.anuntech.cloud", local: `qa-x-${marker}`, name: "", quota: "1", mode: "generate" });
    ok(otherDomain.text.includes("não tem permissão"), "Caixa em outro domínio é recusada");
    ok(
      !jmap.calls.some((c) => c.name === "x:Account/set" && Object.values(c.args.create ?? {}).some((value) => value.domainId === test)),
      "Nenhuma caixa em outro domínio chegou ao servidor",
    );
    ok(jmap.accounts.size === before, "Nenhuma das recusas criou caixa");

    // Reset: generated (shown once) and typed.
    const reset = await call("/email", "admin", "resetMailboxPassword", { id: box.id, mode: "generate" });
    const second = passwordIn(reset);
    ok(!!second && second !== generated && jmap.secretOf(box.id) === second && reset.text.includes("trocada"), "Trocar senha gera outra, mostrada uma vez");
    shown.push(second);
    const resetCall = jmap.calls.filter((c) => c.name === "x:Account/set" && c.args.update?.[box.id]).at(-1);
    ok(Object.keys(resetCall.args.update[box.id]).join() === "credentials/0/secret", "A troca muda só credentials/0/secret");
    const typedReset = `Outra-Frase-Bem-Longa-${marker}`;
    const resetTyped = await call("/email", "admin", "resetMailboxPassword", { id: box.id, mode: "type", password: typedReset });
    ok(jmap.secretOf(box.id) === typedReset && !resetTyped.text.includes(typedReset), "Trocar por uma senha digitada");
    const resetAudit = await db.query("select details from console_audit_events where action='email.mailbox.password_reset' and entity_id=$1", [box.id]);
    ok(resetAudit.rowCount === 2 && !resetAudit.rows.some((r) => [second, typedReset].some((s) => JSON.stringify(r.details).includes(s))), "As trocas ficam na auditoria, sem a senha");

    // Edit: name, quota and aliases (a collision is refused), then the alias goes.
    const alias = `qa-apelido-${marker}`;
    const edited = await call("/email", "admin", "updateMailbox", { id: box.id, name: "Caixa QA editada", quota: "20", alias: [alias, `${alias}@anuntech.com`] });
    let current = jmap.accounts.get(box.id);
    ok(
      edited.text.includes("salva") &&
        current.description === "Caixa QA editada" &&
        current.quotas.maxDiskQuota === 20 * GB &&
        JSON.stringify(current.aliases) === JSON.stringify({ 0: { name: alias, domainId: anun, enable: true } }),
      "Editar muda nome, cota e apelidos (um só, sem repetir)",
    );
    for (const [taken, why] of [
      ["finance", "já é uma caixa"],
      ["k", "já é apelido"],
      ["alessandro", "já é um redirecionamento"],
      [local, "endereço desta caixa"],
    ]) {
      const reply = await call("/email", "admin", "updateMailbox", { id: box.id, name: "Caixa QA editada", quota: "20", alias: [alias, taken] });
      ok(reply.text.includes(why) && JSON.stringify(jmap.accounts.get(box.id).aliases) === JSON.stringify(current.aliases), `Apelido ${taken} é recusado (${why})`);
    }
    await call("/email", "admin", "updateMailbox", { id: box.id, name: "", quota: "20" });
    current = jmap.accounts.get(box.id);
    ok(JSON.stringify(current.aliases) === "{}" && current.description === null, "Tirar o apelido e o nome");
    await call("/email", "admin", "updateMailbox", { id: odd, name: "Cota diferente", quota: "keep" });
    ok(jmap.accounts.get(odd).quotas.maxDiskQuota === 3 * GB && jmap.accounts.get(odd).description === "Cota diferente", "Uma cota fora das opções fica como está ao salvar");
    const badQuota = await call("/email", "admin", "updateMailbox", { id: box.id, name: "", quota: "3" });
    ok(badQuota.text.includes("Escolha o espaço") && jmap.accounts.get(box.id).quotas.maxDiskQuota === 20 * GB, "Cota fora das opções é recusada");

    // Accounts outside the area: another domain, an admin, the service account, an id that does not exist.
    const callsBefore = jmap.calls.length;
    for (const [id, label] of [
      [outsider, "de outro domínio"],
      [boss, "de administrador"],
      [admin, "admin do servidor"],
      [service, "de serviço"],
      ["naoexiste", "inexistente"],
    ]) {
      const replies = [
        await call("/email", "admin", "resetMailboxPassword", { id, mode: "generate" }),
        await call("/email", "admin", "updateMailbox", { id, name: "x", quota: "1" }),
        await call("/email", "admin", "deleteMailbox", { id, confirm: "x" }),
      ];
      ok(replies.every((r) => r.text.includes("não é gerenciada pelo Console") && !passwordIn(r)) && !sets(id).length, `Conta ${label}: trocar senha, editar e excluir são recusados sem mexer no servidor`);
    }
    ok(jmap.calls.slice(callsBefore).every((c) => !c.name.endsWith("/set")), "Nenhuma dessas recusas mandou mudança ao servidor");

    // The Apple profile: private, an attachment, the address as user, never a password.
    const profile = await request(`/api/email/perfil/${box.id}`, "admin");
    ok(
      profile.status === 200 &&
        profile.headers.get("content-type") === "application/x-apple-aspen-config" &&
        profile.headers.get("content-disposition") === `attachment; filename="email-qa-${marker}-anuntech-com.mobileconfig"` &&
        profile.headers.get("cache-control") === "private, no-store" &&
        profile.text.includes("com.apple.mail.managed") &&
        profile.text.includes(`<string>${local}@anuntech.com</string>`) &&
        profile.text.includes("<integer>993</integer>") &&
        profile.text.includes("<integer>465</integer>"),
      "Baixar perfil para iPhone/Mac: o arquivo da caixa, privado e como anexo",
    );
    ok(![generated, second, typedReset].some((s) => profile.text.includes(s)) && !/<key>(IncomingPassword|OutgoingPassword)<\/key>/.test(profile.text), "O perfil não leva senha");
    ok((await request(`/api/email/perfil/${box.id}`, "manager")).status === 404, "Cliente não baixa o perfil");
    ok((await request(`/api/email/perfil/${box.id}`, "assisted")).status === 404, "No acesso assistido, o perfil não baixa");
    ok((await request(`/api/email/perfil/${box.id}`)).status === 401, "Sem sessão, o perfil não baixa");
    ok(
      (await request(`/api/email/perfil/${outsider}`, "admin")).status === 404 &&
        (await request(`/api/email/perfil/${boss}`, "admin")).status === 404 &&
        (await request("/api/email/perfil/..%2F..%2Fjmap", "admin")).status === 404,
      "Perfil de conta de outro domínio, de administrador ou de id estranho não sai",
    );

    // Forwards.
    const forwards = await request("/email/redirecionamentos", "admin");
    ok(forwards.status === 200 && forwards.text.includes("alessandro@anuntech.com") && forwards.text.includes("alessandro@gmail.example") && !forwards.text.includes(`lista-${marker}`), "Redirecionamentos lista os do domínio, com os destinos");
    const fwd = `qa-fwd-${marker}`;
    for (const [recipients, why] of [
      [`ninguem-${marker}@anuntech.com`, "não existe"],
      [`${fwd}@anuntech.com`, "ele mesmo"],
      ["sem-arroba", "não é um endereço"],
      ["", "pelo menos um destino"],
    ]) {
      const reply = await call("/email/redirecionamentos", "admin", "createForward", { domain: "anuntech.com", local: fwd, name: "", recipients });
      ok(reply.text.includes(why) && !jmap.find(jmap.lists, fwd, anun), `Redirecionamento recusado: ${why}`);
    }
    const kauanCollision = await call("/email/redirecionamentos", "admin", "createForward", { domain: "anuntech.com", local: "kauan", name: "", recipients: "fulano@example.invalid" });
    ok(kauanCollision.text.includes("já é uma caixa"), "Redirecionamento não toma o endereço de uma caixa");
    await call("/email/redirecionamentos", "admin", "createForward", { domain: "anuntech.com", local: fwd, name: "Contato QA", recipients: "Fulano@Example.invalid\nkauan@anuntech.com, k@anuntech.com" });
    let list = jmap.find(jmap.lists, fwd, anun);
    ok(
      JSON.stringify(list?.recipients) === JSON.stringify({ "fulano@example.invalid": true, "kauan@anuntech.com": true, "k@anuntech.com": true }) && list.description === "Contato QA",
      "Criar redirecionamento para fora e para caixas e apelidos do domínio",
    );
    await call("/email/redirecionamentos", "admin", "updateForward", { id: list.id, name: "Contato QA 2", recipients: "beltrano@example.invalid" });
    list = jmap.lists.get(list.id);
    ok(JSON.stringify(list.recipients) === JSON.stringify({ "beltrano@example.invalid": true }) && list.description === "Contato QA 2", "Editar troca os destinos inteiros");
    const foreignEdit = await call("/email/redirecionamentos", "admin", "updateForward", { id: foreignList, name: "x", recipients: "y@example.invalid" });
    ok(foreignEdit.text.includes("não existe mais") && !sets(foreignList).length, "Redirecionamento de outro domínio não é alterado");
    await call("/email/redirecionamentos", "manager", "deleteForward", { id: list.id });
    ok(jmap.lists.has(list.id), "Cliente não exclui redirecionamento");
    await call("/email/redirecionamentos", "admin", "deleteForward", { id: list.id });
    ok(!jmap.lists.has(list.id), "Excluir redirecionamento");
    const forwardAudit = (await db.query("select action from console_audit_events where entity_id=$1 order by created_at", [list.id])).rows.map((r) => r.action);
    ok(forwardAudit.join() === "email.forward.created,email.forward.updated,email.forward.deleted", "Os redirecionamentos ficam na auditoria");

    // DNS health against the stand-in resolver.
    writeFileSync(
      dnsFile,
      JSON.stringify({
        "MX anuntech.com": [{ exchange: "mx1.anuntech.cloud", priority: 10 }],
        "TXT anuntech.com": [["v=spf1 include:_spf.google.com ~all"]],
        "TXT v1-rsa-20261026._domainkey.anuntech.com": [["v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqa", marker]],
        "TXT _dmarc.anuntech.com": "ESERVFAIL",
      }),
    );
    const dns = await request("/email/dns", "admin");
    ok(dns.status === 200 && dns.text.includes("Recebimento (MX)") && dns.text.includes("Certo") && dns.text.includes("Falta isto"), "Saúde do DNS mostra o que está certo e o que falta");
    ok(dns.text.includes("Acrescente mx ao registro") && dns.text.includes("v=spf1 mx -all"), "SPF sem o servidor da Anuntech diz o que acrescentar e o valor certo");
    ok(dns.text.includes("v1-ed25519-20261026._domainkey.anuntech.com") && dns.text.includes(`ED25519KEY${marker}=`), "DKIM que falta vem com o nome e o valor para copiar");
    ok(dns.text.includes("Não deu para conferir"), "Consulta que falhou não vira certo nem errado");
    const asked = readFileSync(`${dnsFile}.log`, "utf8");
    ok(asked.includes("MX anuntech.com") && asked.includes("TXT _dmarc.anuntech.com"), "O DNS é consultado pelo resolvedor simulado");

    // Deleting: the full address, and one more confirmation for one's own mailbox.
    const wrong = await call("/email", "admin", "deleteMailbox", { id: box.id, confirm: local });
    ok(wrong.text.includes("digite o endereço completo") && jmap.accounts.has(box.id), "Excluir sem digitar o endereço completo é recusado");
    await call("/email", "manager", "deleteMailbox", { id: box.id, confirm: `${local}@anuntech.com` });
    await call("/email", "support", "deleteMailbox", { id: box.id, confirm: `${local}@anuntech.com` });
    await call("/email", undefined, "deleteMailbox", { id: box.id, confirm: `${local}@anuntech.com` });
    ok(jmap.accounts.has(box.id), "Cliente e quem não tem sessão não excluem caixa");
    const deleted = await call("/email", "admin", "deleteMailbox", { id: box.id, confirm: `${local.toUpperCase()}@anuntech.com` });
    ok(deleted.text.includes("excluída") && !jmap.accounts.has(box.id), "Excluir caixa com o endereço completo");
    ok((await one("select details from console_audit_events where action='email.mailbox.deleted' and entity_id=$1", [box.id]))?.details?.own === false, "A exclusão fica na auditoria");
    const mine = await request("/email", "admin");
    ok(mine.text.includes(`${ownLocal}@anuntech.com`), "A própria caixa aparece na lista");
    const ownFirst = await call("/email", "admin", "deleteMailbox", { id: own, confirm: `${ownLocal}@anuntech.com` });
    ok(ownFirst.text.includes("sua própria caixa") && jmap.accounts.has(own), "Excluir a própria caixa pede a confirmação a mais");
    await call("/email", "admin", "deleteMailbox", { id: own, confirm: `${ownLocal}@anuntech.com`, own: "on" });
    ok(!jmap.accounts.has(own) && (await one("select details from console_audit_events where action='email.mailbox.deleted' and entity_id=$1", [own]))?.details?.own === true, "Com a confirmação a mais, a própria caixa é excluída");

    // Clients and no session change nothing.
    const accountsBefore = jmap.accounts.size;
    await call("/email", "manager", "createMailbox", { domain: "anuntech.com", local: `qa-cliente-${marker}`, name: "", quota: "1", mode: "generate" });
    await call("/email", "support", "createMailbox", { domain: "anuntech.com", local: `qa-membro-${marker}`, name: "", quota: "1", mode: "generate" });
    await call("/email", "assisted", "createMailbox", { domain: "anuntech.com", local: `qa-assistido-${marker}`, name: "", quota: "1", mode: "generate" });
    const clientReset = await call("/email", "manager", "resetMailboxPassword", { id: kauan, mode: "generate" });
    await call("/email", "support", "updateMailbox", { id: finance, name: "Invadido", quota: "1" });
    await call("/email/redirecionamentos", "manager", "createForward", { domain: "anuntech.com", local: `qa-fwd2-${marker}`, name: "", recipients: "x@example.invalid" });
    ok(
      jmap.accounts.size === accountsBefore &&
        !passwordIn(clientReset) &&
        jmap.secretOf(kauan) === "Inicial-Forte-2026" &&
        jmap.accounts.get(finance).description === "Financeiro" &&
        !jmap.find(jmap.lists, `qa-fwd2-${marker}`, anun),
      "Administrador, Membro e acesso assistido não criam, não trocam senha, não editam nem redirecionam",
    );

    // The hourly limits: creations and resets.
    for (const scope of ["mail-create", "mail-password"])
      await db.query(
        "insert into console_otp_limits(key,last_sent_at,window_start,count) values($1,now(),now(),20) on conflict (key) do update set window_start=now(), count=20",
        [limitKey(scope)],
      );
    const limited = await call("/email", "admin", "createMailbox", { domain: "anuntech.com", local: `qa-limite-${marker}`, name: "", quota: "1", mode: "generate" });
    const limitedReset = await call("/email", "admin", "resetMailboxPassword", { id: finance, mode: "generate" });
    ok(limited.text.includes("limite de 20 caixas") && !jmap.find(jmap.accounts, `qa-limite-${marker}`, anun), "Limite por hora de caixas criadas");
    ok(limitedReset.text.includes("limite de 20 trocas") && jmap.secretOf(finance) === "Inicial-Forte-2026", "Limite por hora de trocas de senha");

    // What never happened: reading mail, asking for secrets, passwords at rest.
    ok(jmap.calls.every((c) => c.name.startsWith("x:")), "O Console só usou os métodos de gestão (x:), nunca leu caixa nem mensagem");
    ok(!jmap.calls.some((c) => c.name.endsWith("/get") && (c.args.properties ?? ["credentials"]).includes("credentials")), "O Console nunca pediu as credenciais de volta");
    ok(jmap.requests.length > 0 && jmap.requests.every((r) => r.authorized), "Todo pedido ao servidor foi com a conta de serviço");
    const secrets = [...shown, typedSecret, typedReset];
    const stored = await db.query("select details::text as text from console_audit_events where action like 'email.%'");
    ok(stored.rowCount >= 8 && !stored.rows.some((r) => secrets.some((s) => r.text.includes(s))), "Nenhuma senha na auditoria");
    const logs = serverLogs();
    ok(!secrets.some((s) => logs.includes(s)), "Nenhuma senha no log do servidor");
  } finally {
    await db.query("delete from console_account_emails where id=$1", [`qa-mail-${marker}`]);
    await db.query("delete from console_otp_limits where key=any($1::text[])", [[limitKey("mail-create"), limitKey("mail-password")]]);
  }
}
