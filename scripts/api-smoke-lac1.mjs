// Lacunas L4 of the native app: the session hand-off that opens the web
// Console already signed in (account.openWeb → /api/auth/app-handoff).
// Single use, two minutes, bound to the person and the app session, and only
// to a page of this Console. Called from api-smoke.mjs with what it already
// has in scope; creates its own company and people and removes them at the end.
import { createHash, randomUUID } from "node:crypto";

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
export async function lac1Checks({ db, rpc, ok, marker, emailSignIn, base }) {
  const address = (name) => `api-lac1-${name}-${marker}@example.invalid`;
  const company = randomUUID();
  const userIds = [];
  const people = {};
  async function person(name, role) {
    const id = randomUUID(),
      email = address(name);
    await db.query("insert into console_user(id,name,email,email_verified) values($1,$2,$3,true)", [id, `Lac1 ${name}`, email]);
    userIds.push(id);
    await db.query("insert into console_memberships(id,company_id,email,role) values($1,$2,$3,$4)", [randomUUID(), company, email, role]);
    people[name] = { id, email };
  }
  /** What the app's browser does: open the address, not follow the redirect, keep the cookies it sets. */
  async function open(path, cookie) {
    const response = await fetch(`${base}${path}`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
    const set = response.headers.getSetCookie().map((h) => h.split(";")[0]).filter((pair) => /(session_token|dont_remember)=./.test(pair));
    return { status: response.status, location: response.headers.get("location") || "", cookie: set.join("; "), cache: response.headers.get("cache-control") };
  }
  const tokenOf = (path) => new URL(path, base).searchParams.get("t");
  const hashOf = (token) => createHash("sha256").update(token).digest("base64url");
  const sessions = async (userId) => Number((await db.query("select count(*) from console_session where user_id=$1", [userId])).rows[0].count);

  try {
    await db.query("insert into console_companies(id,name,document,billing_email) values($1,$2,$3,$4)", [
      company,
      `API lac1 ${marker}`,
      company.replaceAll("-", "").slice(0, 14),
      address("billing"),
    ]);
    await person("ana", "manager");
    await person("bia", "member");
    const ana = (await emailSignIn(people.ana.email)).cookie;
    const bia = (await emailSignIn(people.bia.email)).cookie;
    const board = `/bookmarks/${randomUUID()}/lousa`;

    ok((await rpc("account.openWeb", { next: board })).status === 401, "Without a session there is no hand-off");

    const invalid = ["//evil.example", "https://evil.example/", "/\\evil.example", "javascript:alert(1)", "/api/auth/sign-out", "painel", ""];
    const statuses = [];
    for (const next of invalid) statuses.push((await rpc("account.openWeb", { next }, ana)).status);
    ok(statuses.every((s) => s === 400), "A hand-off only goes to a relative page of this Console (no other site, no /api)");

    let r = await rpc("account.openWeb", { next: `${board}?v=1#topo` }, ana);
    ok(
      r.status === 200 && /^\/api\/auth\/app-handoff\?t=[A-Za-z0-9_-]{43}$/.test(r.body.path) &&
        Math.abs(new Date(r.body.expiresAt).getTime() - Date.now() - 120_000) < 10_000,
      "The app gets a single-use address that lasts two minutes",
    );
    const first = r.body.path;
    const stored = (await db.query("select identifier, value from console_verification where identifier like 'app-handoff:%' and value like $1", [`{"userId":"${people.ana.id}"%`])).rows;
    ok(
      stored.length === 1 && stored[0].identifier === `app-handoff:${hashOf(tokenOf(first))}` && !stored[0].value.includes(tokenOf(first)),
      "The Console keeps only the token's hash, bound to the person",
    );

    // Someone else signed in on that browser is never swapped for the link's person.
    const biaBefore = await sessions(people.bia.id);
    const anaBefore = await sessions(people.ana.id);
    let opened = await open(first, bia);
    ok(
      opened.status === 302 && opened.location.endsWith("/painel") && !opened.cookie && (await sessions(people.ana.id)) === anaBefore,
      "Another person's browser cannot use the token: no session is created",
    );
    ok(
      (await db.query("select 1 from console_verification where identifier=$1", [`app-handoff:${hashOf(tokenOf(first))}`])).rowCount === 0 &&
        (await sessions(people.bia.id)) === biaBefore,
      "A token tried by someone else is spent, and that person's session stays",
    );

    r = await rpc("account.openWeb", { next: `${board}?v=1#topo` }, ana);
    const second = r.body.path;
    opened = await open(second);
    ok(
      opened.status === 302 && opened.location === `${base}${board}?v=1#topo` && /session_token=/.test(opened.cookie) && /dont_remember=/.test(opened.cookie) && opened.cache === "no-store",
      "Opening the address signs the browser in and lands on the page",
    );
    const created = (await db.query("select * from console_session where user_id=$1 order by created_at desc limit 1", [people.ana.id])).rows[0];
    ok(created.expires_at.getTime() - Date.now() <= 86_400_000 + 5_000, "The web session lasts a day at most, without a lasting cookie");
    const me = await rpc("me.get", undefined, opened.cookie);
    ok(
      me.status === 200 && me.body.email === people.ana.email &&
        (await db.query("select expires_at from console_session where id=$1", [created.id])).rows[0].expires_at.getTime() - Date.now() <= 86_400_000 + 5_000,
      "The web session is the app's person, and using it does not stretch it",
    );
    const audit = (await db.query("select * from console_audit_events where actor_id=$1 and action in ('account.session.handoff','account.session.started') and entity_id=$2", [people.ana.id, created.id])).rows;
    ok(
      audit.some((a) => a.action === "account.session.handoff" && a.details.from === "app" && a.details.next === board) &&
        audit.some((a) => a.action === "account.session.started"),
      "The hand-off is audited and shows in the sign-in history",
    );

    const before = await sessions(people.ana.id);
    opened = await open(second);
    ok(opened.status === 302 && opened.location.endsWith("/entrar") && !opened.cookie && (await sessions(people.ana.id)) === before, "The address works once");

    r = await rpc("account.openWeb", { next: board }, ana);
    await db.query("update console_verification set expires_at=now()-interval '1 second' where identifier=$1", [`app-handoff:${hashOf(tokenOf(r.body.path))}`]);
    opened = await open(r.body.path);
    ok(opened.status === 302 && opened.location.endsWith("/entrar") && !opened.cookie, "An expired address is refused");

    opened = await open(`/api/auth/app-handoff?t=${"A".repeat(43)}`);
    ok(opened.status === 302 && opened.location.endsWith("/entrar") && !opened.cookie, "A made-up token is refused");

    // The app session that asked must still be valid when the browser opens it.
    const later = (await emailSignIn(people.ana.email)).cookie;
    r = await rpc("account.openWeb", { next: board }, later);
    const value = JSON.parse((await db.query("select value from console_verification where identifier=$1", [`app-handoff:${hashOf(tokenOf(r.body.path))}`])).rows[0].value);
    await db.query("delete from console_session where id=$1", [value.sessionId]);
    opened = await open(r.body.path);
    ok(opened.status === 302 && opened.location.endsWith("/entrar") && !opened.cookie, "A hand-off from an app session that ended is refused");

    // An address already opened by this person on the web just goes there.
    r = await rpc("account.openWeb", { next: "/chamados?status=waiting_customer" }, ana);
    const web = (await open((await rpc("account.openWeb", { next: board }, ana)).body.path)).cookie;
    const count = await sessions(people.ana.id);
    opened = await open(r.body.path, web);
    ok(
      opened.status === 302 && opened.location === `${base}/chamados?status=waiting_customer` && (await sessions(people.ana.id)) === count,
      "A browser already signed in as the person is not given another session",
    );
  } finally {
    await db.query("delete from console_verification where identifier like 'app-handoff:%' and (value like $1 or value like $2)", [
      `{"userId":"${people.ana?.id}"%`,
      `{"userId":"${people.bia?.id}"%`,
    ]);
    await db.query("delete from console_audit_events where actor_id=any($1::text[])", [userIds]);
    await db.query("delete from console_session where user_id=any($1::text[])", [userIds]);
    await db.query("delete from console_memberships where company_id=$1", [company]);
    await db.query("delete from console_user where id=any($1::text[])", [userIds]);
    await db.query("delete from console_companies where id=$1", [company]);
  }
}
