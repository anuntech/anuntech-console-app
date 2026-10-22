// Configurações in the native app (company, members, notifications): the
// web's rules through /api/v1, for the Administrador of exactly one company.
// Called from api-smoke.mjs with what it already has in scope; creates its own
// companies and people and removes them at the end.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * @param {{
 *   db: import("pg").Pool,
 *   rpc: (path: string, input: unknown, cookie?: string, headers?: Record<string, string>) => Promise<{ status: number, body: any }>,
 *   ok: (condition: unknown, message: string) => void,
 *   marker: string,
 *   emailSignIn: (email: string) => Promise<{ status: number, body: any, cookie: string }>,
 *   staff: string,
 *   mailFile?: string,
 * }} ctx
 */
export async function settingsChecks({ db, rpc, ok, marker, emailSignIn, staff, mailFile }) {
  const address = (name) => `api-settings-${name}-${marker}@example.invalid`;
  // 14 digits from a fresh UUID: unique per run, never a real CNPJ.
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "73917305829164").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const documents = { own: cnpj(), other: cnpj() };
  const userIds = [];
  const people = {};
  const engagements = { own: randomUUID(), other: randomUUID() };
  const mails = () => {
    if (!mailFile) return [];
    try {
      return readFileSync(mailFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
    } catch {
      return [];
    }
  };
  async function person(name, company, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Settings ${name}`, email]);
    userIds.push(id);
    const membership = randomUUID();
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [membership, company, email, role]);
    people[name] = { id, email, membership };
  }
  const membershipOf = async (company, email) =>
    (await db.query("select * from console_memberships where company_id=$1 and email=$2", [company, email])).rows[0];
  const refused = (r, message) => r.status === 400 && r.body?.message === message;

  try {
    for (const key of Object.keys(companies))
      await db.query(
        "insert into console_companies(id,name,document,billing_email,phone) values($1,$2,$3,$4,$5)",
        [companies[key], `API settings ${key} ${marker}`, documents[key], address(`billing-${key}`), "11988887777"],
      );
    await db.query(
      "insert into console_engagements(id,company_id,name,kind) values($1,$2,'Site institucional','product'),($3,$4,'Outro produto','product')",
      [engagements.own, companies.own, engagements.other, companies.other],
    );
    await person("admin", companies.own, "manager");
    await person("peer", companies.own, "manager");
    await person("membro", companies.own, "member");
    await person("elsewhere", companies.other, "manager");
    const admin = (await emailSignIn(people.admin.email)).cookie;
    const membro = (await emailSignIn(people.membro.email)).cookie;

    // Who reaches these screens: only the Administrador of exactly one company.
    const calls = [
      ["company.get", {}],
      ["company.update", { name: "X", document: documents.own, billingEmail: address("x"), phone: "11988887777", address: null }],
      ["company.lookupCep", { cep: "01310100" }],
      ["members.list", {}],
      ["members.save", { email: address("intruder"), role: "member" }],
      ["members.revoke", { memberId: people.peer.membership }],
      ["members.resendInvite", { memberId: people.peer.membership }],
      ["notifications.get", {}],
      ["notifications.save", { topic: "tickets", emails: [], phones: [], emailEnabled: false, whatsappEnabled: false }],
    ];
    const statuses = [];
    for (const [path, input] of calls) statuses.push((await rpc(path, input, membro)).status);
    ok(statuses.every((s) => s === 404), "A Membro gets 404 on every settings procedure");
    ok(
      (await rpc("company.get", {}, staff)).status === 404 && (await rpc("members.list", {}, staff)).status === 404,
      "The team's settings stay on the web: the app answers 404",
    );
    ok(
      (await membershipOf(companies.own, address("intruder"))) === undefined &&
        (await membershipOf(companies.own, people.peer.email)).active,
      "The refused calls changed nothing",
    );

    // Dados da empresa.
    let r = await rpc("company.get", {}, admin);
    ok(
      r.status === 200 &&
        r.body.id === companies.own &&
        r.body.document === documents.own &&
        r.body.phone === "11988887777" &&
        r.body.address === null,
      "An Administrador reads the company's registration",
    );
    const update = {
      name: `API settings own ${marker} novo`,
      document: documents.own,
      billingEmail: address("billing-new"),
      phone: "(11) 98888-7766",
      address: null,
    };
    r = await rpc("company.update", { ...update, document: "123" }, admin);
    ok(refused(r, "Informe CPF ou CNPJ com 11 ou 14 dígitos."), "A malformed CPF/CNPJ is refused with the web's message");
    r = await rpc("company.update", { ...update, document: documents.other }, admin);
    ok(refused(r, "Já existe uma empresa com este CPF/CNPJ."), "Another company's CPF/CNPJ is refused");
    const fullAddress = {
      cep: "01310-100",
      endereco: "Avenida Paulista",
      numero: "1000",
      complemento: "",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      uf: "SP",
      codigoMunicipio: "3550308",
    };
    r = await rpc("company.update", { ...update, address: { ...fullAddress, numero: "" } }, admin);
    ok(
      refused(r, "Complete o endereço do cliente: logradouro, número, bairro, cidade, UF e CEP válido. O código IBGE, se informado, deve ter 7 dígitos."),
      "An incomplete address is refused",
    );
    const newDocument = cnpj();
    r = await rpc("company.update", { ...update, document: newDocument, address: fullAddress }, admin);
    const [saved] = (await db.query("select * from console_companies where id=$1", [companies.own])).rows;
    const [updatedEvent] = (
      await db.query("select details from console_audit_events where company_id=$1 and action='company.updated' and actor_id=$2", [companies.own, people.admin.id])
    ).rows;
    ok(
      r.status === 200 &&
        r.body.message === "Dados da empresa atualizados." &&
        saved.name === update.name &&
        saved.document === newDocument &&
        saved.phone === "11988887766" &&
        saved.billing_address?.cep === "01310100" &&
        updatedEvent?.details?.source === "settings" &&
        updatedEvent.details.document?.before === documents.own,
      "The Administrador updates the company, with the audit record",
    );
    r = await rpc("company.get", {}, admin);
    ok(r.status === 200 && r.body.address?.cidade === "São Paulo" && r.body.address.complemento === "", "The saved address comes back");

    // CEP: the provider is out of reach in this suite, then the hourly limit.
    await db.query("delete from console_otp_limits");
    r = await rpc("company.lookupCep", { cep: "01310100" }, admin);
    ok(
      r.status === 502 && /consulta está indisponível/.test(r.body?.message ?? ""),
      "A CEP lookup the provider cannot answer says so",
    );
    for (let i = 0; i < 19; i++) await rpc("company.lookupCep", { cep: "01310100" }, admin);
    r = await rpc("company.lookupCep", { cep: "01310100" }, admin);
    ok(
      r.status === 429 && r.body?.message === "Muitas consultas na última hora. Preencha o endereço manualmente.",
      "CEP lookups stop at 20 an hour",
    );
    await db.query("delete from console_otp_limits");

    // Membros.
    r = await rpc("members.list", {}, admin);
    const self = r.body?.people?.find((p) => p.email === people.admin.email);
    const listedMembro = r.body?.people?.find((p) => p.email === people.membro.email);
    ok(
      r.status === 200 &&
        self?.self &&
        self.roleLabel === "Administrador" &&
        self.statusLabel === "Ativo" &&
        self.avatar?.kind === "initials" &&
        listedMembro?.role === "member" &&
        listedMembro.roleLabel === "Membro" &&
        listedMembro.scopeLabel === "Tudo da empresa" &&
        !r.body.people.some((p) => p.email === people.elsewhere.email) &&
        r.body.choices.some((c) => c.id === engagements.own && c.kindLabel === "Produto") &&
        !r.body.choices.some((c) => c.id === engagements.other),
      "The list shows the company's people with labels and only its own products",
    );
    ok(
      (await db.query("select 1 from console_user_milestones where user_id=$1 and company_id=$2 and key='members_reviewed'", [people.admin.id, companies.own])).rowCount === 1,
      "Reading the list counts as reviewing who has access",
    );
    ok(refused(await rpc("members.save", { email: "não é e-mail", role: "member" }, admin), "Informe um e-mail válido."), "An invalid e-mail is refused");
    const invitee = address("invitee");
    r = await rpc("members.save", { email: invitee, role: "member" }, admin);
    const invited = await membershipOf(companies.own, invitee);
    ok(
      r.status === 200 &&
        r.body.message ===
          (mailFile
            ? "Acesso liberado. Um e-mail de convite foi enviado."
            : "Acesso liberado, mas não foi possível enviar o e-mail de convite. Avise a pessoa manualmente.") &&
        invited?.active &&
        invited.role === "member" &&
        (await db.query("select 1 from console_audit_events where entity_id=$1 and action='membership.granted'", [invited.id])).rowCount === 1,
      "The Administrador invites a person from the app",
    );
    if (mailFile) ok(mails().some((m) => m.to === invitee), "The invite e-mail goes out");
    r = await rpc("members.list", {}, admin);
    const pendingRow = r.body?.people?.find((p) => p.email === invitee);
    ok(pendingRow?.pending && pendingRow.statusLabel === "Aguardando primeiro acesso" && pendingRow.memberId === invited.id, "The invitee shows as waiting for the first sign-in");
    r = await rpc("members.save", { email: invitee, role: "member", scope: { access: "selected", ids: [engagements.own] } }, admin);
    const scoped = (await db.query("select engagement_id from console_membership_engagements where membership_id=$1", [invited.id])).rows;
    ok(
      r.status === 200 &&
        r.body.message === "Acesso atualizado. A pessoa já tinha acesso a esta empresa." &&
        scoped.length === 1 &&
        scoped[0].engagement_id === engagements.own,
      "The Administrador chooses what a Membro sees",
    );
    r = await rpc("members.list", {}, admin);
    ok(r.body?.people?.find((p) => p.email === invitee)?.scopeLabel === "1 item", "The list sums up the Membro's scope");
    r = await rpc("members.save", { email: invitee, role: "member", scope: { access: "selected", ids: [engagements.other] } }, admin);
    ok(
      refused(r, "Um dos itens escolhidos não é desta empresa. Atualize a página e tente novamente.") &&
        (await db.query("select engagement_id from console_membership_engagements where membership_id=$1", [invited.id])).rows[0]?.engagement_id === engagements.own,
      "A product of another company is refused and the scope stays",
    );
    r = await rpc("members.save", { email: invitee, role: "manager" }, admin);
    ok(r.status === 200 && (await membershipOf(companies.own, invitee)).role === "manager", "The Administrador changes a person's role");
    r = await rpc("members.save", { email: invitee, role: "member" }, admin);
    ok(r.status === 200 && (await membershipOf(companies.own, invitee)).role === "member", "…and back");
    ok(
      refused(await rpc("members.save", { email: people.elsewhere.email, role: "member" }, admin), "Esta conta já pertence a outro ambiente. Remova o vínculo anterior antes de convidá-la."),
      "Someone of another company cannot be invited",
    );
    const selfMessage = "Você não pode revogar ou reduzir seu próprio acesso de administrador.";
    ok(refused(await rpc("members.save", { email: people.admin.email, role: "member" }, admin), selfMessage), "The Administrador cannot demote themselves");
    ok(
      (await rpc("members.revoke", { memberId: people.elsewhere.membership }, admin)).status === 404 &&
        (await rpc("members.resendInvite", { memberId: people.elsewhere.membership }, admin)).status === 404 &&
        (await rpc("members.revoke", { memberId: randomUUID() }, admin)).status === 404,
      "A membership of another company (or none) answers 404",
    );
    ok((await membershipOf(companies.other, people.elsewhere.email)).active, "Another company's access is untouched");

    // Resend: once a week per access.
    r = await rpc("members.resendInvite", { memberId: invited.id }, admin);
    const claims = () =>
      db.query("select 1 from console_automation_events where kind='invite.resend' and entity_id like $1", [`${invited.id}:%`]).then((q) => q.rowCount);
    if (mailFile) {
      ok(r.status === 200 && r.body.message === `Convite reenviado para ${invitee}.`, "The Administrador resends the invite");
      r = await rpc("members.resendInvite", { memberId: invited.id }, admin);
      ok(refused(r, "O convite já foi reenviado esta semana. Confira o e-mail com a pessoa.") && (await claims()) === 1, "The invite goes again only once a week");
    } else
      ok(
        refused(r, "Não foi possível reenviar o convite agora. Tente de novo em instantes.") && (await claims()) === 0,
        "A resend that could not go out frees the week's slot",
      );

    // Removing access, and keeping an Administrador.
    r = await rpc("members.revoke", { memberId: invited.id }, admin);
    ok(
      r.status === 200 &&
        r.body.message === "Acesso à empresa revogado. Outros vínculos foram preservados." &&
        !(await membershipOf(companies.own, invitee)).active &&
        (await db.query("select 1 from console_membership_engagements where membership_id=$1", [invited.id])).rowCount === 0,
      "The Administrador removes an access and its scope",
    );
    r = await rpc("members.save", { email: people.peer.email, role: "member" }, admin);
    ok(r.status === 200 && (await membershipOf(companies.own, people.peer.email)).role === "member", "The Administrador demotes the other Administrador");
    ok(
      refused(await rpc("members.revoke", { memberId: people.admin.membership }, admin), selfMessage) &&
        (await membershipOf(companies.own, people.admin.email)).active,
      "The last Administrador cannot remove themselves: the company keeps one",
    );

    // Notificações.
    r = await rpc("notifications.get", {}, admin);
    const billing = r.body?.topics?.find((t) => t.topic === "billing");
    const tickets = r.body?.topics?.find((t) => t.topic === "tickets");
    ok(
      r.status === 200 &&
        billing?.title === "Financeiro" &&
        billing.description === "Novas cobranças, vencimentos e lembretes." &&
        billing.emails[0] === address("billing-new") &&
        billing.phones[0] === "11988887766" &&
        billing.emailEnabled &&
        billing.whatsappEnabled &&
        tickets?.title === "Chamados" &&
        tickets.description === "Abertura, respostas e atualizações." &&
        !tickets.emailEnabled &&
        !tickets.whatsappEnabled,
      "Notifications show both subjects with the company's contacts by default",
    );
    ok(
      (await db.query("select 1 from console_user_milestones where user_id=$1 and company_id=$2 and key='notices_reviewed'", [people.admin.id, companies.own])).rowCount === 1,
      "Opening notifications counts as the first step",
    );
    const notices = { topic: "tickets", emails: [], phones: [], emailEnabled: false, whatsappEnabled: false };
    ok(refused(await rpc("notifications.save", { ...notices, emails: ["nada"] }, admin), "Informe um e-mail válido."), "An invalid notice e-mail is refused");
    ok(refused(await rpc("notifications.save", { ...notices, phones: ["123"] }, admin), "Informe telefone com DDD e 10 ou 11 dígitos."), "An invalid notice phone is refused");
    ok(refused(await rpc("notifications.save", { ...notices, emailEnabled: true }, admin), "Adicione um e-mail ou desative esse canal."), "E-mail on needs an address");
    ok(refused(await rpc("notifications.save", { ...notices, whatsappEnabled: true }, admin), "Adicione um telefone ou desative esse canal."), "WhatsApp on needs a phone");
    r = await rpc(
      "notifications.save",
      { topic: "tickets", emails: [address("tickets"), ` ${address("tickets").toUpperCase()} `], phones: ["(11) 97777-6655"], emailEnabled: true, whatsappEnabled: true },
      admin,
    );
    const [preference] = (await db.query("select * from console_notification_preferences where key=$1", [`${companies.own}:tickets`])).rows;
    ok(
      r.status === 200 &&
        r.body.message === "Preferências de notificações atualizadas." &&
        preference?.emails?.length === 1 &&
        preference.phones?.[0] === "11977776655" &&
        preference.email_enabled &&
        (await db.query("select 1 from console_audit_events where entity_id=$1 and action='notifications.preferences_updated'", [preference.key])).rowCount === 1,
      "The Administrador saves who receives ticket notices",
    );
    r = await rpc("notifications.get", {}, admin);
    const savedTickets = r.body?.topics?.find((t) => t.topic === "tickets");
    ok(savedTickets?.emails?.[0] === address("tickets") && savedTickets.phones[0] === "11977776655" && savedTickets.whatsappEnabled, "The saved contacts come back");
  } finally {
    const ids = Object.values(companies);
    const memberships = (await db.query("select id from console_memberships where company_id=any($1::text[])", [ids])).rows.map((m) => m.id);
    for (const [statement, values] of [
      ["delete from console_membership_engagements where membership_id=any($1::text[])", [memberships]],
      ["delete from console_email_deliveries where membership_id=any($1::text[])", [memberships]],
      ["delete from console_automation_events where company_id=any($1::text[])", [ids]],
      ["delete from console_automation_events where kind='ops-mail' and details->>'subject' like $1", [`%${marker}%`]],
      ["delete from console_notification_preferences where company_id=any($1::text[])", [ids]],
      ["delete from console_audit_events where company_id=any($1::text[]) or actor_id=any($2::text[])", [ids, userIds]],
      ["delete from console_user_milestones where user_id=any($1::text[])", [userIds]],
      ["delete from console_session where user_id=any($1::text[])", [userIds]],
      ["delete from console_account where user_id=any($1::text[])", [userIds]],
      ["delete from console_memberships where company_id=any($1::text[])", [ids]],
      ["delete from console_engagements where company_id=any($1::text[])", [ids]],
      ["delete from console_companies where id=any($1::text[])", [ids]],
      ["delete from console_user where id=any($1::text[])", [userIds]],
    ])
      await db.query(statement, values);
  }
}
