import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// The first secret every account of the JMAP stand-in starts with (jmap-mock.mjs): a fixture, not a credential.
const INITIAL_FIXTURE = "Inicial-Forte-2026";

/**
 * E-mail management (lib/mail) against a local stand-in of Stalwart's JMAP
 * admin API (scripts/jmap-mock.mjs) and of the DNS (scripts/dns-mock.cjs),
 * never the real server: the team lists the anuntech.com mailboxes, creates
 * one with a generated or typed password, resets it, edits name, quota and
 * aliases, downloads the Apple profile, manages forwards, reads the DNS
 * health and deletes (its own mailbox with one more confirmation). A client's
 * domain, once linked, is managed by its Administrador from the e-mail
 * product in Produtos, on the web and in the app (mail.*), and a Membro
 * changes only the password of the mailbox linked to them.
 * Refused: another company's domain and mailboxes, a Membro beyond their own
 * mailbox, assisted access, no session, an account of another domain, an
 * administrator account, colliding addresses and the hourly limit. No password reaches the audit, the logs or
 * the database, and the Console never asks the server for a mailbox's mail.
 */
export async function runEmailTests({ database: db, ids, people, request, ok, marker, base, jmap, notFoundPage, dnsFile, serverLogs }) {
  // The native app's API, called as the app calls it: the session cookie by hand and the app's scheme as origin.
  const rpc = async (path, input, who) => {
    const response = await fetch(`${base}/api/v1/${path.replaceAll(".", "/")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "expo-origin": "anuntech://", ...(who ? { Cookie: people[who].cookie } : {}) },
      body: JSON.stringify({ json: input }),
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body: body?.json ?? body };
  };
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
    // E-mail lives in Produtos and in Configurações › E-mail now, not in anyone's dock.
    const teamDock = await request("/painel", "admin");
    const clientDock = await request("/painel", "manager");
    ok(teamDock.status === 200 && !teamDock.text.includes('href="/email"') && clientDock.status === 200 && !clientDock.text.includes('href="/email"'), "Nem a equipe nem o cliente têm E-mail no dock");
    ok(page.text.includes('href="/configuracoes/email"'), "As caixas da Anuntech voltam para Configurações › E-mail");
    const teamSettings = await request("/conta", "admin");
    const clientSettings = await request("/conta", "manager");
    ok(teamSettings.text.includes('href="/configuracoes/email"') && !clientSettings.text.includes('href="/configuracoes/email"'), "Configurações › E-mail aparece só para a equipe");

    // Who gets in on anuntech.com: only the team; a client without a linked domain, assisted access and no session do not.
    ok(notFoundPage(await request("/email", "manager")), "Administrador sem domínio vinculado não abre /email");
    ok(notFoundPage(await request("/email", "support")), "Membro sem domínio vinculado não abre /email");
    ok(notFoundPage(await request("/email?dominio=anuntech.com", "manager")), "Administrador de cliente não abre anuntech.com");
    const assistedPage = await request("/email", "assisted");
    ok(assistedPage.text.includes("não abre no acesso assistido") && !assistedPage.text.includes("kauan@anuntech.com"), "No acesso assistido, /email explica e não lista caixas");
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
    // Fixture values the JMAP stand-in knows (jmap-mock.mjs), not credentials.
    const WEAK_FIXTURE = "senhafraca12345";
    const short = await call("/email", "admin", "createMailbox", { domain: "anuntech.com", local: `qa-curta-${marker}`, name: "", quota: "1", mode: "type", password: "curta" });
    ok(short.text.includes("Use pelo menos 12 caracteres") && !jmap.find(jmap.accounts, `qa-curta-${marker}`, anun), "Senha digitada curta é recusada antes do servidor");
    const weak = await call("/email", "admin", "createMailbox", { domain: "anuntech.com", local: `qa-fraca-${marker}`, name: "", quota: "1", mode: "type", password: WEAK_FIXTURE });
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
    ok(otherDomain.text.includes("não é gerenciado pelo Console"), "Caixa em outro domínio é recusada");
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

    // A client's domain: on the server already, managed only once the team links it to the company.
    const clientDomain = `cliente-${marker}.example`;
    const looseDomain = `solto-${marker}.example`;
    const clientDomainId = jmap.addDomain(clientDomain, {
      dnsZoneFile: `$ORIGIN ${clientDomain}.\n@ IN MX 10 mx1.anuntech.cloud.\n@ IN TXT "v=spf1 mx -all"\n_dmarc IN TXT "v=DMARC1; p=none"\n`,
    });
    const looseDomainId = jmap.addDomain(looseDomain);
    const contact = jmap.addAccount({ name: "contato", domainId: clientDomainId, description: "Contato", quota: 5 * GB, used: 0.5 * GB });
    jmap.addAccount({ name: `ninguem-${marker}`, domainId: looseDomainId });
    const companyA = (await one("select name from console_companies where id=$1", [ids.a])).name;
    const linkOf = (domain) => one("select id, company_id from console_mail_domains where domain=$1", [domain]);

    ok(notFoundPage(await request(`/email?dominio=${clientDomain}`, "admin")), "Domínio sem vínculo não abre em /email");
    const beforeLink = await call("/email", "admin", "createMailbox", { domain: clientDomain, local: `qa-${marker}`, name: "", quota: "1", mode: "generate" });
    const resetBeforeLink = await call("/email", "admin", "resetMailboxPassword", { id: contact, mode: "generate" });
    ok(
      beforeLink.text.includes("não é gerenciado pelo Console") && resetBeforeLink.text.includes("não é gerenciada pelo Console") && !sets(contact).length,
      "Sem vínculo, o Console não cria nem troca senha no domínio do cliente",
    );
    const oldDomains = await request("/email/dominios", "admin");
    ok([303, 307, 308].includes(oldDomains.status) && (oldDomains.headers.get("location") ?? "").endsWith("/configuracoes/email"), "O endereço antigo de Domínios leva a Configurações › E-mail");
    const domainsPage = await request("/configuracoes/email", "admin");
    // The sheet's choices travel in the page's data even while it is closed.
    ok(
      domainsPage.status === 200 && domainsPage.text.includes("Vincular domínio") && domainsPage.text.includes(clientDomain) && domainsPage.text.includes(looseDomain),
      "Domínios oferece para vincular os domínios do servidor que ainda não são de ninguém",
    );
    ok(!domainsPage.text.includes("teste.anuntech.cloud"), "O domínio da infraestrutura nunca aparece para vincular");
    for (const who of ["manager", "support", "assisted"]) ok(notFoundPage(await request("/configuracoes/email", who)), `Configurações › E-mail não abre para ${who}`);

    for (const [values, why, label] of [
      [{ companyId: ids.a, domain: "teste.anuntech.cloud" }, "não são vinculados a clientes", "domínio da infraestrutura"],
      [{ companyId: ids.a, domain: "anuntech.com" }, "não são vinculados a clientes", "domínio da Anuntech"],
      [{ companyId: ids.a, domain: `nao-existe-${marker}.example` }, "ainda não está no servidor", "domínio fora do servidor"],
      [{ companyId: ids.a, domain: "não é domínio" }, "Escolha um domínio", "texto que não é domínio"],
      [{ companyId: "00000000-0000-4000-8000-000000000000", domain: clientDomain }, "Escolha a empresa", "empresa inexistente"],
    ]) {
      const reply = await call("/configuracoes/email", "admin", "linkMailDomain", values);
      ok(reply.text.includes(why) && !(await linkOf(values.domain)), `Vincular é recusado: ${label}`);
    }
    for (const who of ["manager", "support", "assisted", undefined]) await call("/configuracoes/email", who, "linkMailDomain", { companyId: ids.a, domain: clientDomain });
    ok(!(await linkOf(clientDomain)), "Cliente, acesso assistido e quem não tem sessão não vinculam domínio");

    const linked = await call("/configuracoes/email", "admin", "linkMailDomain", { companyId: ids.a, domain: ` ${clientDomain.toUpperCase()}. ` });
    const link = await linkOf(clientDomain);
    ok(linked.text.includes(`vinculado a ${companyA}`) && link?.company_id === ids.a, "A equipe vincula o domínio do servidor à empresa");
    const linkAudit = await one("select company_id, details from console_audit_events where action='email.domain.linked' and entity_id=$1", [link.id]);
    ok(linkAudit?.company_id === ids.a && linkAudit.details.domain === clientDomain, "O vínculo fica na auditoria, na empresa");
    const twice = await call("/configuracoes/email", "admin", "linkMailDomain", { companyId: ids.b, domain: clientDomain });
    ok(twice.text.includes("já está vinculado") && (await linkOf(clientDomain)).company_id === ids.a, "Um domínio é de uma empresa só");
    const linkedList = await request("/configuracoes/email", "admin");
    ok(linkedList.text.includes(clientDomain) && linkedList.text.includes(companyA) && linkedList.text.includes("1 caixa"), "Vinculado, o domínio aparece em Domínios com a empresa e as caixas");

    // Linked: the team manages it like anuntech.com, one domain per page.
    const clientPage = await request(`/email?dominio=${clientDomain}`, "admin");
    ok(
      clientPage.status === 200 && clientPage.text.includes(`contato@${clientDomain}`) && clientPage.text.includes(companyA) && !clientPage.text.includes("kauan@anuntech.com"),
      "/email?dominio= mostra as caixas do domínio do cliente, com a empresa",
    );
    const ownPage = await request("/email", "admin");
    ok(
      ownPage.text.includes("kauan@anuntech.com") && !ownPage.text.includes(`contato@${clientDomain}`) && !ownPage.text.includes(`value="${clientDomain}"`),
      "Sem domínio escolhido, a equipe vê anuntech.com, e o seletor não mistura os domínios dos clientes",
    );
    ok(notFoundPage(await request(`/email?dominio=${looseDomain}`, "admin")), "Domínio do servidor que não é de ninguém continua fora de /email");
    const clientLocal = `qa-cliente-${marker}`;
    const clientCreated = await call(`/email?dominio=${clientDomain}`, "admin", "createMailbox", { domain: clientDomain, local: clientLocal, name: "Cliente QA", quota: "5", mode: "generate" });
    const clientNew = jmap.find(jmap.accounts, clientLocal, clientDomainId);
    shown.push(passwordIn(clientCreated));
    ok(clientCreated.text.includes(`${clientLocal}@${clientDomain} criada`) && clientNew?.domainId === clientDomainId, "A equipe cria caixa no domínio do cliente");
    const clientAudit = await one("select company_id from console_audit_events where action='email.mailbox.created' and entity_id=$1", [clientNew.id]);
    ok(clientAudit?.company_id === ids.a, "A caixa do cliente fica na auditoria da empresa");
    const contactReset = await call(`/email?dominio=${clientDomain}`, "admin", "resetMailboxPassword", { id: contact, mode: "generate" });
    shown.push(passwordIn(contactReset));
    ok(contactReset.text.includes("trocada") && jmap.secretOf(contact) === passwordIn(contactReset), "A equipe troca a senha de uma caixa do cliente");
    const badForward = await call("/email/redirecionamentos", "admin", "createForward", { domain: clientDomain, local: `vendas-${marker}`, name: "", recipients: `ninguem@${clientDomain}` });
    ok(badForward.text.includes("não existe") && !jmap.find(jmap.lists, `vendas-${marker}`, clientDomainId), "Redirecionamento para caixa inexistente do cliente é recusado");
    await call("/email/redirecionamentos", "admin", "createForward", { domain: clientDomain, local: `vendas-${marker}`, name: "Vendas", recipients: `contato@${clientDomain}` });
    const clientForward = jmap.find(jmap.lists, `vendas-${marker}`, clientDomainId);
    ok(!!clientForward && (await one("select company_id from console_audit_events where action='email.forward.created' and entity_id=$1", [clientForward.id]))?.company_id === ids.a, "Redirecionamento no domínio do cliente, na auditoria da empresa");
    const clientForwards = await request(`/email/redirecionamentos?dominio=${clientDomain}`, "admin");
    ok(clientForwards.status === 200 && clientForwards.text.includes(`vendas-${marker}@${clientDomain}`) && !clientForwards.text.includes("alessandro@anuntech.com"), "Redirecionamentos mostra só os do domínio escolhido");
    const clientDns = await request(`/email/dns?dominio=${clientDomain}`, "admin");
    ok(clientDns.status === 200 && clientDns.text.includes("Recebimento (MX)") && clientDns.text.includes(clientDomain), "Saúde do DNS do domínio do cliente");
    ok(notFoundPage(await request(`/email/dns?dominio=${looseDomain}`, "admin")), "DNS de domínio sem vínculo não abre");

    // Phase 2: the client manages its own domains, entering through the e-mail product in Produtos.
    // Company B has a domain of its own, for the refusals between companies.
    const companyBDomain = `outra-${marker}.example`;
    const companyBDomainId = jmap.addDomain(companyBDomain);
    const otherBox = jmap.addAccount({ name: "contato", domainId: companyBDomainId, description: "Outra empresa" });
    const otherList = jmap.addList({ name: "vendas", domainId: companyBDomainId, recipients: ["fora@example.invalid"] });
    await call("/configuracoes/email", "admin", "linkMailDomain", { companyId: ids.b, domain: companyBDomain });
    ok((await linkOf(companyBDomain))?.company_id === ids.b, "A empresa B tem o próprio domínio vinculado");
    // The Membro's mailbox: its address is one of the verified e-mails of their Console account.
    const memberLocal = `membro-${marker}`;
    const memberBox = jmap.addAccount({ name: memberLocal, domainId: clientDomainId, description: "Membro QA", quota: 5 * GB, used: 0.2 * GB });
    await db.query("insert into console_account_emails(id,user_id,email,verified_at) values($1,$2,$3,now())", [
      `qa-mail-member-${marker}`,
      people.support.id,
      `${memberLocal}@${clientDomain}`,
    ]);
    const mailItem = randomUUID();
    const mailProduct = randomUUID();
    await db.query("insert into console_catalog_items(id,kind,name,suspension_kind) values($1,'product',$2,'email')", [mailItem, `E-mail QA ${marker}`]);
    await db.query("insert into console_engagements(id,company_id,name,kind,catalog_item_id,url) values($1,$2,$3,'product',$4,$5)", [
      mailProduct,
      ids.a,
      `E-mail QA ${marker}`,
      mailItem,
      "https://webmail.example.invalid",
    ]);
    const entry = `/email?empresa=${ids.a}`;
    for (const who of ["admin", "manager", "support"]) {
      const listed = await request(`/produtos?q=${encodeURIComponent(`E-mail QA ${marker}`)}`, who);
      ok(listed.status === 200 && listed.text.includes(`href="${entry}"`) && !listed.text.includes('href="https://webmail.example.invalid'), `Em Produtos, o produto de e-mail abre as caixas da empresa no Console (${who})`);
    }
    const appProducts = await rpc("products.list", { search: `E-mail QA ${marker}` }, "manager");
    ok(appProducts.status === 200 && appProducts.body.rows[0]?.mailCompanyId === ids.a, "No app, o produto de e-mail traz a empresa das caixas (mailCompanyId)");

    // The Administrador: every mailbox of the company's domains, only them.
    const managerPage = await request(entry, "manager");
    ok(
      managerPage.status === 200 &&
        managerPage.text.includes(`contato@${clientDomain}`) &&
        managerPage.text.includes(`${memberLocal}@${clientDomain}`) &&
        managerPage.text.includes("Nova caixa") &&
        !managerPage.text.includes("kauan@anuntech.com"),
      "O card abre para o Administrador as caixas da empresa, com Nova caixa",
    );
    ok(!managerPage.text.includes(companyBDomain) && !managerPage.text.includes('value="anuntech.com"'), "O seletor do Administrador mostra só os domínios da empresa");
    ok((await request("/email", "manager")).text.includes(`contato@${clientDomain}`), "Sem parâmetro, /email abre o domínio da empresa do Administrador");
    for (const [path, label] of [
      [`/email?dominio=${companyBDomain}`, "o domínio de outra empresa"],
      [`/email?empresa=${ids.b}`, "o e-mail de outra empresa"],
      ["/email?empresa=nao-e-empresa", "uma empresa que não existe"],
      [`/email/redirecionamentos?dominio=${companyBDomain}`, "os redirecionamentos de outra empresa"],
      [`/email/dns?dominio=${companyBDomain}`, "o DNS de outra empresa"],
    ])
      ok(notFoundPage(await request(path, "manager")), `O Administrador não abre ${label}`);
    const managerForwards = await request(`/email/redirecionamentos?dominio=${clientDomain}`, "manager");
    const managerDns = await request(`/email/dns?dominio=${clientDomain}`, "manager");
    ok(
      managerForwards.status === 200 && managerForwards.text.includes(`vendas-${marker}@${clientDomain}`) && managerDns.status === 200 && managerDns.text.includes("Recebimento (MX)"),
      "O Administrador vê os redirecionamentos e a saúde do DNS do domínio",
    );
    const managerLocal = `qa-adm-${marker}`;
    const managerCreated = await call(entry, "manager", "createMailbox", { domain: clientDomain, local: managerLocal, name: "Criada pelo cliente", quota: "5", mode: "generate" });
    const managerNew = jmap.find(jmap.accounts, managerLocal, clientDomainId);
    shown.push(passwordIn(managerCreated));
    ok(
      managerCreated.text.includes(`${managerLocal}@${clientDomain} criada`) && !!passwordIn(managerCreated) && jmap.secretOf(managerNew?.id) === passwordIn(managerCreated),
      "O Administrador cria caixa no domínio da empresa, com a senha gerada mostrada uma vez",
    );
    const managerAudit = await one("select actor_id, company_id from console_audit_events where action='email.mailbox.created' and entity_id=$1", [managerNew.id]);
    ok(managerAudit?.company_id === ids.a && managerAudit.actor_id === people.manager.id, "A caixa criada pelo Administrador entra na atividade da empresa, com quem criou");
    const managerReset = await call(entry, "manager", "resetMailboxPassword", { id: contact, mode: "generate" });
    shown.push(passwordIn(managerReset));
    ok(managerReset.text.includes("trocada") && jmap.secretOf(contact) === passwordIn(managerReset), "O Administrador troca a senha de uma caixa da empresa");
    await call(entry, "manager", "updateMailbox", { id: managerNew.id, name: "Editada pelo cliente", quota: "10", alias: [`apelido-${marker}`] });
    current = jmap.accounts.get(managerNew.id);
    ok(current.description === "Editada pelo cliente" && current.quotas.maxDiskQuota === 10 * GB && current.aliases[0]?.name === `apelido-${marker}`, "O Administrador edita nome, espaço e apelidos");
    const forwardsPage = `/email/redirecionamentos?dominio=${clientDomain}`;
    // A destination on another client's domain is an outside address: nothing says whether the mailbox exists there.
    const crossForward = await call(forwardsPage, "manager", "createForward", { domain: clientDomain, local: `fora-${marker}`, name: "", recipients: `ninguem-${marker}@${companyBDomain}` });
    const crossList = jmap.find(jmap.lists, `fora-${marker}`, clientDomainId);
    ok(!crossForward.text.includes("não existe") && !!crossList, "Destino no domínio de outra empresa conta como de fora: ninguém descobre que caixas existem lá");
    await call(forwardsPage, "manager", "deleteForward", { id: crossList.id });
    ok(!jmap.lists.has(crossList.id), "O Administrador exclui um redirecionamento da empresa");
    const managerDeleted = await call(entry, "manager", "deleteMailbox", { id: managerNew.id, confirm: `${managerLocal}@${clientDomain}` });
    ok(managerDeleted.text.includes("excluída") && !jmap.accounts.has(managerNew.id), "O Administrador exclui uma caixa da empresa, digitando o endereço");

    // Another company's mailboxes, forwards and domain do not exist for the Administrador; anuntech.com neither.
    const crossCalls = jmap.calls.length;
    const crossCreates = [
      await call(entry, "manager", "createMailbox", { domain: companyBDomain, local: `qa-x-${marker}`, name: "", quota: "1", mode: "generate" }),
      await call(entry, "manager", "createMailbox", { domain: "anuntech.com", local: `qa-x-${marker}`, name: "", quota: "1", mode: "generate" }),
      await call(forwardsPage, "manager", "createForward", { domain: companyBDomain, local: `qa-x-${marker}`, name: "", recipients: "x@example.invalid" }),
    ];
    ok(crossCreates.every((r) => r.text.includes("não é gerenciado pelo Console")), "Criar caixa ou redirecionamento em outra empresa ou em anuntech.com responde como domínio que o Console não gerencia");
    for (const [id, label] of [
      [otherBox, "de outra empresa"],
      [kauan, "da Anuntech"],
    ]) {
      const replies = [
        await call(entry, "manager", "resetMailboxPassword", { id, mode: "generate" }),
        await call(entry, "manager", "updateMailbox", { id, name: "x", quota: "1" }),
        await call(entry, "manager", "deleteMailbox", { id, confirm: "x" }),
      ];
      ok(replies.every((r) => r.text.includes("não é gerenciada pelo Console") && !passwordIn(r)), `Caixa ${label}: trocar senha, editar e excluir respondem como caixa que não existe`);
    }
    const otherEdit = await call(forwardsPage, "manager", "updateForward", { id: otherList, name: "x", recipients: "y@example.invalid" });
    const otherDelete = await call(forwardsPage, "manager", "deleteForward", { id: otherList });
    ok(otherEdit.text.includes("não existe mais") && otherDelete.text.includes("não existe mais") && jmap.lists.has(otherList), "Redirecionamento de outra empresa não existe para o Administrador");
    ok(jmap.calls.slice(crossCalls).every((c) => !c.name.endsWith("/set")) && jmap.secretOf(otherBox) === INITIAL_FIXTURE, "Nenhuma recusa entre empresas mandou mudança ao servidor");
    const managerProfile = await request(`/api/email/perfil/${contact}`, "manager");
    const otherProfile = await request(`/api/email/perfil/${otherBox}`, "manager");
    ok(managerProfile.status === 200 && otherProfile.status === 404, "O Administrador baixa o perfil da Apple só das caixas da empresa");

    // A Membro: only the mailbox linked to them, with its password and the devices.
    const memberPage = await request(entry, "support");
    ok(
      memberPage.status === 200 &&
        memberPage.text.includes(`${memberLocal}@${clientDomain}`) &&
        !memberPage.text.includes(`contato@${clientDomain}`) &&
        !memberPage.text.includes("Nova caixa"),
      "O card abre para o Membro só a própria caixa, sem Nova caixa",
    );
    ok(notFoundPage(await request(forwardsPage, "support")) && notFoundPage(await request(`/email/dns?dominio=${clientDomain}`, "support")), "O Membro não abre redirecionamentos nem DNS");
    const memberReset = await call(entry, "support", "resetMailboxPassword", { id: memberBox, mode: "generate" });
    shown.push(passwordIn(memberReset));
    ok(memberReset.text.includes("trocada") && jmap.secretOf(memberBox) === passwordIn(memberReset), "O Membro troca a senha da própria caixa, mostrada uma vez");
    const memberAudit = await one("select actor_id, company_id from console_audit_events where action='email.mailbox.password_reset' and entity_id=$1", [memberBox]);
    ok(memberAudit?.actor_id === people.support.id && memberAudit.company_id === ids.a, "A troca do Membro entra na atividade da empresa");
    const contactSecret = jmap.secretOf(contact);
    const memberOther = await call(entry, "support", "resetMailboxPassword", { id: contact, mode: "generate" });
    ok(memberOther.text.includes("não é gerenciada pelo Console") && !passwordIn(memberOther) && jmap.secretOf(contact) === contactSecret, "O Membro não troca a senha de outra caixa: para ele, ela não existe");
    const memberRefusals = [
      await call(entry, "support", "updateMailbox", { id: memberBox, name: "x", quota: "20" }),
      await call(entry, "support", "deleteMailbox", { id: memberBox, confirm: `${memberLocal}@${clientDomain}` }),
      await call(entry, "support", "createMailbox", { domain: clientDomain, local: `qa-m-${marker}`, name: "", quota: "1", mode: "generate" }),
    ];
    await call(forwardsPage, "support", "createForward", { domain: clientDomain, local: `qa-mf-${marker}`, name: "", recipients: "x@example.invalid" });
    ok(
      memberRefusals.every((r) => r.text.includes("não tem permissão")) &&
        jmap.accounts.get(memberBox)?.quotas.maxDiskQuota === 5 * GB &&
        !jmap.find(jmap.accounts, `qa-m-${marker}`, clientDomainId) &&
        !jmap.find(jmap.lists, `qa-mf-${marker}`, clientDomainId),
      "O Membro não edita nem exclui a própria caixa, nem cria caixa ou redirecionamento",
    );
    ok((await request(`/api/email/perfil/${memberBox}`, "support")).status === 200 && (await request(`/api/email/perfil/${contact}`, "support")).status === 404, "O Membro baixa o perfil da própria caixa, e só dela");

    // Assisted access, no session and the team.
    const assistedEntry = await request(entry, "assisted");
    ok(assistedEntry.text.includes("não abre no acesso assistido") && !assistedEntry.text.includes(`contato@${clientDomain}`), "No acesso assistido, o card do e-mail explica e não lista caixas");
    const assistedReset = await call(entry, "assisted", "resetMailboxPassword", { id: contact, mode: "generate" });
    const assistedCreate = await call(entry, "assisted", "createMailbox", { domain: clientDomain, local: `qa-as-${marker}`, name: "", quota: "1", mode: "generate" });
    ok(
      assistedReset.text.includes("não tem permissão") && assistedCreate.text.includes("não tem permissão") && jmap.secretOf(contact) === contactSecret && !jmap.find(jmap.accounts, `qa-as-${marker}`, clientDomainId),
      "No acesso assistido, a equipe não troca senha nem cria caixa do cliente",
    );
    ok((await request(`/api/email/perfil/${contact}`, "assisted")).status === 404, "No acesso assistido, o perfil de uma caixa do cliente não baixa");
    const anonymousEntry = await request(entry);
    await call(entry, undefined, "resetMailboxPassword", { id: memberBox, mode: "generate" });
    ok(
      [303, 307, 308].includes(anonymousEntry.status) && (anonymousEntry.headers.get("location") ?? "").includes("/entrar") && jmap.secretOf(memberBox) === passwordIn(memberReset),
      "Sem sessão, o card manda entrar e nenhuma senha muda",
    );
    const teamEntry = await request(entry, "admin");
    ok(teamEntry.status === 200 && teamEntry.text.includes(`contato@${clientDomain}`) && !teamEntry.text.includes("kauan@anuntech.com"), "A equipe abre o e-mail do cliente pelo mesmo caminho do card");

    // The app: the same rules through mail.mailboxes and mail.resetPassword.
    const appManager = await rpc("mail.mailboxes", { companyId: ids.a }, "manager");
    ok(
      appManager.status === 200 &&
        appManager.body.role === "manager" &&
        appManager.body.domain === clientDomain &&
        appManager.body.mailboxes.some((m) => m.address === `contato@${clientDomain}`) &&
        !appManager.body.domains.includes(companyBDomain) &&
        appManager.body.setup.host === "mail.anuntech.com",
      "App: o Administrador recebe as caixas do domínio da empresa e os dados dos aparelhos",
    );
    const appMember = await rpc("mail.mailboxes", { companyId: ids.a }, "support");
    ok(
      appMember.status === 200 && appMember.body.role === "member" && appMember.body.mailboxes.length === 1 && appMember.body.mailboxes[0].id === memberBox && appMember.body.mailboxes[0].own,
      "App: o Membro recebe só a própria caixa",
    );
    ok((await rpc("mail.mailboxes", { companyId: ids.a }, "admin")).body?.role === "team", "App: a equipe vê as caixas do cliente pelo mesmo caminho");
    for (const [input, who, label] of [
      [{ companyId: ids.b }, "manager", "outra empresa"],
      [{ companyId: ids.a, domain: companyBDomain }, "manager", "um domínio de outra empresa"],
      [{ companyId: ids.a, domain: "anuntech.com" }, "manager", "anuntech.com"],
      [{ companyId: ids.a }, "outsider", "quem não é da empresa"],
    ])
      ok((await rpc("mail.mailboxes", input, who)).status === 404, `App: mail.mailboxes recusa ${label} como inexistente`);
    ok((await rpc("mail.mailboxes", { companyId: ids.a })).status === 401, "App: sem sessão, mail.mailboxes pede para entrar");
    const appReset = await rpc("mail.resetPassword", { id: memberBox, mode: "generate" }, "support");
    shown.push(appReset.body?.password);
    ok(
      appReset.status === 200 && !!appReset.body.password && jmap.secretOf(memberBox) === appReset.body.password && appReset.body.address === `${memberLocal}@${clientDomain}`,
      "App: o Membro troca a senha da própria caixa, mostrada uma vez",
    );
    const appTyped = `Frase-Do-App-Bem-Longa-${marker}`;
    shown.push(appTyped);
    const appTypedReset = await rpc("mail.resetPassword", { id: contact, mode: "type", password: appTyped }, "manager");
    ok(
      appTypedReset.status === 200 && !appTypedReset.body.password && jmap.secretOf(contact) === appTyped && !JSON.stringify(appTypedReset.body).includes(appTyped),
      "App: o Administrador troca por uma senha digitada, que não volta na resposta",
    );
    const appShort = await rpc("mail.resetPassword", { id: contact, mode: "type", password: "curta" }, "manager");
    ok(appShort.status === 400 && (appShort.body?.message ?? "").includes("12 caracteres") && jmap.secretOf(contact) === appTyped, "App: senha digitada curta volta com a explicação");
    for (const [id, who, label] of [
      [contact, "support", "a caixa de outra pessoa, pelo Membro"],
      [otherBox, "manager", "uma caixa de outra empresa"],
      [kauan, "manager", "uma caixa da Anuntech"],
      [contact, "outsider", "quem não é da empresa"],
    ])
      ok((await rpc("mail.resetPassword", { id, mode: "generate" }, who)).status === 404, `App: mail.resetPassword recusa ${label} como inexistente`);
    ok((await rpc("mail.resetPassword", { id: contact, mode: "generate" })).status === 401 && jmap.secretOf(contact) === appTyped && jmap.secretOf(otherBox) === INITIAL_FIXTURE, "App: sem sessão e nas recusas, nenhuma senha muda");

    // Unlinking: the typed domain, only the team; the server keeps everything.
    const wrongUnlink = await call("/configuracoes/email", "admin", "unlinkMailDomain", { id: link.id, confirm: "outro.example" });
    await call("/configuracoes/email", "manager", "unlinkMailDomain", { id: link.id, confirm: clientDomain });
    ok(wrongUnlink.text.includes("digite o domínio") && !!(await linkOf(clientDomain)), "Desvincular pede o domínio digitado e não é do cliente");
    const unlinked = await call("/configuracoes/email", "admin", "unlinkMailDomain", { id: link.id, confirm: clientDomain.toUpperCase() });
    ok(unlinked.text.includes("continuam no servidor") && !(await linkOf(clientDomain)), "A equipe desvincula o domínio");
    ok(jmap.accounts.has(contact) && jmap.accounts.has(clientNew.id) && jmap.lists.has(clientForward.id), "Desvincular não apaga nada no servidor");
    ok((await one("select company_id from console_audit_events where action='email.domain.unlinked' and entity_id=$1", [link.id]))?.company_id === ids.a, "O desvínculo fica na auditoria da empresa");
    const afterUnlink = await call("/email", "admin", "resetMailboxPassword", { id: contact, mode: "generate" });
    ok(afterUnlink.text.includes("não é gerenciada pelo Console") && notFoundPage(await request(`/email?dominio=${clientDomain}`, "admin")), "Desvinculado, o domínio sai do Console");

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
        jmap.secretOf(kauan) === INITIAL_FIXTURE &&
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
    ok(limitedReset.text.includes("limite de 20 trocas") && jmap.secretOf(finance) === INITIAL_FIXTURE, "Limite por hora de trocas de senha");

    // What never happened: reading mail, asking for secrets, passwords at rest.
    ok(jmap.calls.every((c) => c.name.startsWith("x:")), "O Console só usou os métodos de gestão (x:), nunca leu caixa nem mensagem");
    ok(!jmap.calls.some((c) => c.name.endsWith("/get") && (c.args.properties ?? ["credentials"]).includes("credentials")), "O Console nunca pediu as credenciais de volta");
    ok(jmap.requests.length > 0 && jmap.requests.every((r) => r.authorized), "Todo pedido ao servidor foi com a conta de serviço");
    const secrets = [...shown, typedSecret, typedReset].filter(Boolean);
    const stored = await db.query("select details::text as text from console_audit_events where action like 'email.%'");
    ok(stored.rowCount >= 8 && !stored.rows.some((r) => secrets.some((s) => r.text.includes(s))), "Nenhuma senha na auditoria");
    const logs = serverLogs();
    ok(!secrets.some((s) => logs.includes(s)), "Nenhuma senha no log do servidor");
  } finally {
    await db.query("delete from console_mail_domains where company_id=any($1::text[])", [[ids.a, ids.b]]);
    await db.query("delete from console_account_emails where id=any($1::text[])", [[`qa-mail-${marker}`, `qa-mail-member-${marker}`]]);
    await db.query("delete from console_engagements where name=$1 and company_id=$2", [`E-mail QA ${marker}`, ids.a]);
    await db.query("delete from console_catalog_items where name=$1", [`E-mail QA ${marker}`]);
    await db.query("delete from console_otp_limits where key=any($1::text[])", [[limitKey("mail-create"), limitKey("mail-password")]]);
  }
}
