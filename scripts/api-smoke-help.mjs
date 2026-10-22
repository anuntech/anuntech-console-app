// Ajuda, Como trabalhamos and Primeiros passos in the native app: the web's
// /ajuda, /como-trabalhamos and the overview's checklist through /api/v1.
// Called from api-smoke.mjs with what it already has in scope; creates its own
// companies, people and conditions and removes them at the end.
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
export async function helpChecks({ db, rpc, ok, marker, emailSignIn, staff }) {
  const address = (name) => `api-help-${name}-${marker}@example.invalid`;
  const cnpj = () => (randomUUID().replace(/\D/g, "") + "73917305829164").slice(0, 14);
  const companies = { own: randomUUID(), other: randomUUID() };
  const engagements = { seen: randomUUID(), hidden: randomUUID() };
  const userIds = [];
  const people = {};
  async function person(name, company, role, selected) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Help ${name}`, email]);
    userIds.push(id);
    const membership = randomUUID();
    await db.query("insert into console_memberships(id,company_id,email,role,engagement_access) values($1,$2,$3,$4,$5)", [
      membership,
      company,
      email,
      role,
      selected ? "selected" : "all",
    ]);
    for (const engagement of selected ?? [])
      await db.query("insert into console_membership_engagements(membership_id,engagement_id) values($1,$2)", [membership, engagement]);
    people[name] = { id, email, membership };
  }
  const policy = (minutes, extra = {}) =>
    JSON.stringify({
      levels: false,
      response: { normal: { firstResponseMinutes: minutes } },
      pausesWhileWaiting: false,
      tacitAcceptance: false,
      outOfHours: "unspecified",
      includesDevelopment: false,
      clauses: {},
      ...extra,
    });
  const milestone = async (userId, key, companyId = "") =>
    (await db.query("select 1 from console_user_milestones where user_id=$1 and key=$2 and company_id=$3", [userId, key, companyId])).rowCount === 1;

  try {
    for (const key of Object.keys(companies))
      await db.query("insert into console_companies(id,name,document,billing_email,phone) values($1,$2,$3,$4,$5)", [
        companies[key],
        `API help ${key} ${marker}`,
        cnpj(),
        address(`billing-${key}`),
        "11988887777",
      ]);
    await db.query(
      "insert into console_engagements(id,company_id,name,kind) values($1,$2,'Produto visto','product'),($3,$2,'Produto oculto','product')",
      [engagements.seen, companies.own, engagements.hidden],
    );
    // Company-wide conditions with what the contract asks, a product's own conditions (out of the Membro's selection)
    // and conditions not yet published.
    await db.query(
      `insert into console_service_terms(id,company_id,engagement_id,basis,preset,label,policy,publish_at,verified_at)
       values ($1,$2,null,'external_contract','suporte','Suporte',$3::jsonb,now() - interval '1 day',now()),
              ($4,$2,$5,'external_contract','suporte','Produto oculto',$6::jsonb,now() - interval '1 day',now()),
              ($7,$2,null,'external_contract','suporte','Futuro',$8::jsonb,now() + interval '30 days',now())`,
      [
        randomUUID(),
        companies.own,
        policy(540, { clientResponseDays: 5 }),
        randomUUID(),
        engagements.hidden,
        policy(1080),
        randomUUID(),
        policy(1620),
      ],
    );
    await person("admin", companies.own, "manager");
    await person("membro", companies.own, "member", [engagements.seen]);
    await person("elsewhere", companies.other, "manager");
    const admin = (await emailSignIn(people.admin.email)).cookie;
    const membro = (await emailSignIn(people.membro.email)).cookie;

    // Signed out: nothing.
    ok(
      (await rpc("help.home", {})).status === 401 && (await rpc("guide.get", {})).status === 401 && (await rpc("guide.firstSteps", {})).status === 401,
      "Help and the guide need a session",
    );

    // Ajuda.
    let r = await rpc("help.home", {}, membro);
    const stub = (body, slug) => body?.categories?.flatMap((c) => c.articles).find((a) => a.slug === slug);
    ok(
      r.status === 200 &&
        r.body.categories.length > 0 &&
        r.body.tutorials.length > 0 &&
        r.body.faq.length > 0 &&
        r.body.canOpenTicket &&
        stub(r.body, "relatorio-de-horas")?.adminOnly === true &&
        stub(r.body, "pagar-uma-fatura")?.adminOnly === false,
      "The help home lists subjects, videos and questions, marking the Administrador's articles for a Membro",
    );
    r = await rpc("help.home", {}, admin);
    ok(r.status === 200 && stub(r.body, "relatorio-de-horas")?.adminOnly === false, "An Administrador sees no Administrador mark");
    r = await rpc("help.get", { slug: "relatorio-de-horas" }, membro);
    ok(
      r.status === 200 && r.body.adminOnly && r.body.readsAsMember && r.body.sections.length > 0 && r.body.updatedAt,
      "A Membro reads an Administrador's article with the notice",
    );
    r = await rpc("help.get", { slug: "relatorio-de-horas" }, admin);
    ok(r.status === 200 && r.body.adminOnly && !r.body.readsAsMember, "An Administrador reads it without the notice");
    r = await rpc("help.get", { slug: "abrir-um-chamado" }, membro);
    ok(
      r.status === 200 && r.body.tutorial?.src?.startsWith("/ajuda/videos/") && r.body.tutorial.chapters.length > 0 && r.body.tutorial.transcript.length > 0,
      "An article with a video carries its chapters and transcript",
    );
    ok((await rpc("help.get", { slug: `nao-existe-${marker}` }, membro)).status === 404, "An unknown article answers 404");
    r = await rpc("help.search", { q: "boleto" }, membro);
    ok(
      r.status === 200 &&
        r.body.length > 0 &&
        r.body.every((x) => Object.keys(x).sort().join() === "slug,summary,title") &&
        r.body.some((x) => x.slug === "pagar-uma-fatura"),
      "The help search answers slug, title and summary",
    );
    r = await rpc("help.search", { q: "" }, membro);
    ok(r.status === 200 && r.body.length === 0, "An empty search finds nothing");

    // Como trabalhamos.
    r = await rpc("guide.get", {}, membro);
    const membroTerms = r.body?.terms ?? [];
    const titles = membroTerms.flatMap((c) => c.items.map((i) => i.title));
    ok(
      r.status === 200 &&
        r.body.sections.length === 5 &&
        !r.body.staff &&
        titles.includes("Suporte") &&
        !titles.includes("Produto oculto") &&
        !titles.includes("Futuro") &&
        membroTerms[0].items.find((i) => i.title === "Suporte").promises.some((p) => p.text.startsWith("Primeira resposta em até")) &&
        membroTerms[0].items.find((i) => i.title === "Suporte").asks.some((a) => a.text.includes("5 dias úteis")),
      "The guide shows the published conditions the Membro sees, never another product's or unpublished ones",
    );
    r = await rpc("guide.get", {}, admin);
    ok(r.status === 200 && r.body.terms.flatMap((c) => c.items.map((i) => i.title)).includes("Produto oculto"), "The Administrador sees every product's conditions");
    r = await rpc("guide.get", {}, staff);
    ok(r.status === 200 && r.body.staff && r.body.terms.length === 0, "The team reads the guide without terms");

    // Primeiros passos.
    r = await rpc("guide.firstSteps", {}, membro);
    let steps = r.body?.steps;
    ok(
      r.status === 200 &&
        steps?.companyId === companies.own &&
        !steps.forced &&
        steps.steps.map((s) => s.key).join() === "profile,guide" &&
        steps.steps.find((s) => s.key === "guide")?.done === false,
      "A Membro gets the profile and the guide",
    );
    r = await rpc("guide.firstSteps", {}, admin);
    ok(
      r.status === 200 && r.body.steps?.steps.map((s) => s.key).join() === "members,notices,guide",
      "An Administrador gets members, notices and the guide",
    );
    ok((await rpc("guide.markRead", {}, membro)).status === 200 && (await milestone(people.membro.id, "guide_read_v1")), "Reading the guide is recorded");
    r = await rpc("guide.firstSteps", {}, membro);
    ok(r.body?.steps?.steps.find((s) => s.key === "guide")?.done === true, "The guide step is done after reading");
    ok((await rpc("guide.markStep", { companyId: companies.other, key: "first_steps_hidden" }, membro)).status === 404, "Another company answers 404");
    ok(!(await milestone(people.membro.id, "first_steps_hidden", companies.other)), "Nothing is recorded for another company");
    ok((await rpc("guide.markStep", { companyId: companies.own, key: "whatever" }, membro)).status === 400, "An unknown step is refused");
    r = await rpc("guide.markStep", { companyId: companies.own, key: "first_steps_hidden" }, membro);
    ok(r.status === 200 && (await milestone(people.membro.id, "first_steps_hidden", companies.own)), "Hiding the card is recorded");
    r = await rpc("guide.firstSteps", {}, membro);
    ok(r.status === 200 && r.body.steps === null, "The hidden card stays hidden");
    r = await rpc("guide.markStep", { companyId: companies.own, key: "members_reviewed" }, admin);
    ok(r.status === 200 && (await milestone(people.admin.id, "members_reviewed", companies.own)), "An Administrador marks a step by hand");
    r = await rpc("guide.firstSteps", {}, staff);
    ok(r.status === 200 && r.body.steps === null, "The team has no first steps");
  } finally {
    const ids = Object.values(companies);
    const memberships = (await db.query("select id from console_memberships where company_id=any($1::text[])", [ids])).rows.map((m) => m.id);
    for (const [statement, values] of [
      ["delete from console_membership_engagements where membership_id=any($1::text[])", [memberships]],
      ["delete from console_service_terms where company_id=any($1::text[])", [ids]],
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
