import { createPublicKey, randomUUID, verify } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Apps inside the Console (CMS, Roteiro Digital, Base Pendente): the public
 * key, who opens which app, the pass the action signs (checked here the way
 * an app checks it), the audit and the links that now stay in the Console.
 */
export async function runAppsTests({ database: db, ids, people, request, ok, marker, base, notFoundPage, passKeyId }) {
  const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
  // The regression revoked the Member to test revocation; this suite needs one again.
  await db.query("update console_memberships set active=true where email=$1 and company_id=$2", [people.support.email, ids.a]);
  // Names starting with "0" come first in the dashboard's five products.
  const products = {
    cms: ["0 CMS", "https://www.espacoabsolut.com/admin", "active", ids.a],
    roteiro: ["0 Roteiro", "https://brastemp-roteiro-digital.vercel.app/", "active", ids.a],
    site: ["0 Site", "https://www.espacoabsolut.com/", "active", ids.a],
    paused: ["0 CMS pausado", "https://mulheresfm.com.br/admin", "paused", ids.a],
    base: ["0 Base", "https://brastemp-base-pendente.vercel.app/", "active", ids.a],
    other: ["0 CMS outra empresa", "https://www.mulheresfm.com.br/admin", "active", ids.b],
  };
  const app = {};
  for (const [key, [name, url, status, company]] of Object.entries(products)) {
    app[key] = randomUUID();
    await db.query("insert into console_engagements(id,company_id,name,kind,status,url) values($1,$2,$3,'product',$4,$5)", [
      app[key],
      company,
      `${name} ${marker}`,
      status,
      url,
    ]);
  }

  // The public key: no session, cached, nothing private in it.
  const jwksResponse = await fetch(`${base}/.well-known/jwks.json`);
  const jwks = await jwksResponse.json();
  ok(
    jwksResponse.status === 200 &&
      /public, max-age=300/.test(jwksResponse.headers.get("cache-control") ?? "") &&
      jwks.keys?.length === 1 &&
      jwks.keys[0].kty === "RSA" &&
      jwks.keys[0].alg === "RS256" &&
      jwks.keys[0].use === "sig" &&
      jwks.keys[0].kid === passKeyId &&
      !("d" in jwks.keys[0]) &&
      !("p" in jwks.keys[0]),
    "A JWKS do passe é pública, em cache por 5 minutos e só com a chave pública",
  );

  // openApp is called by the page on mount, with the product id as its only argument.
  const actionId = Object.entries(
    JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node,
  ).find(([, action]) => action.exportedName === "openApp")?.[0];
  ok(!!actionId, "Ação openApp encontrada no build");
  const open = async (key, who) => {
    const r = await fetch(`${base}/apps/${app[key]}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        ...(who ? { Cookie: people[who].cookie } : {}),
        "Next-Action": actionId,
        Accept: "text/x-component",
        "Content-Type": "text/plain;charset=UTF-8",
        Origin: base,
      },
      body: JSON.stringify([app[key]]),
    });
    const text = await r.text();
    // A refreshed session cookie makes Next send the page tree too; the pass is the one src with it.
    const src = text.match(/"src":"(https?:[^"]*console_pass=[^"]*)"/)?.[1] ?? null;
    return { status: r.status, text, src, pass: src ? new URL(src).searchParams.get("console_pass") : null };
  };
  // What an app does with the pass: RS256 only, the published key, its own audience.
  const verifyPass = (pass, aud) => {
    const [h, p, s] = pass.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const jwk = jwks.keys.find((key) => key.kid === header.kid);
    if (header.alg !== "RS256" || !jwk) return null;
    const key = createPublicKey({ key: jwk, format: "jwk" });
    if (!verify("sha256", Buffer.from(`${h}.${p}`), key, Buffer.from(s, "base64url"))) return null;
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== "https://console.anuntech.com" || claims.aud !== aud) return null;
    if (claims.exp < now || claims.nbf > now + 30 || claims.exp - claims.iat !== 120) return null;
    return claims;
  };

  // An Administrator opens the CMS: the page has no pass in it, the action signs one.
  const page = await request(`/apps/${app.cms}`, "manager");
  ok(
    page.status === 200 && page.text.includes(`0 CMS ${marker}`) && !page.text.includes("console_pass"),
    "O Administrador abre a página do CMS e o passe não vem no HTML",
  );
  const before = Number((await one("select count(*)::int n from console_audit_events where action='app.opened' and entity_id=$1", [app.cms])).n);
  const managerOpen = await open("cms", "manager");
  const managerClaims = managerOpen.pass && verifyPass(managerOpen.pass, "espaco-absolut-cms");
  ok(
    managerOpen.src?.startsWith("https://www.espacoabsolut.com/admin?console_pass=") &&
      managerClaims?.sub === people.manager.id &&
      managerClaims.email === people.manager.email &&
      managerClaims.company === ids.a &&
      managerClaims.role === "manager" &&
      !("tenant" in managerClaims) &&
      !!managerClaims.jti,
    "O passe do Administrador é RS256, verificável pela JWKS, com 2 minutos e os claims do contrato",
  );
  ok(!verifyPass(managerOpen.pass, "mulheresfm-cms"), "O passe de um app não serve para outro");
  const audit = await one(
    "select actor_id, company_id, details from console_audit_events where action='app.opened' and entity_id=$1 order by created_at desc limit 1",
    [app.cms],
  );
  ok(
    audit?.actor_id === people.manager.id &&
      audit.company_id === ids.a &&
      audit.details?.app === "espaco-absolut-cms" &&
      audit.details?.engagement === app.cms,
    "Abrir o app fica na auditoria (app.opened)",
  );
  const again = await open("cms", "manager");
  ok(
    !!again.pass && again.pass !== managerOpen.pass &&
      Number((await one("select count(*)::int n from console_audit_events where action='app.opened' and entity_id=$1", [app.cms])).n) === before + 2,
    "Recarregar pede um passe novo",
  );

  // The team opens every app as staff.
  const staffClaims = verifyPass((await open("cms", "admin")).pass ?? "", "espaco-absolut-cms");
  ok(staffClaims?.role === "staff" && staffClaims.sub === people.admin.id, "A equipe abre o CMS com papel staff");

  // A Member opens the member apps, never the CMS.
  const memberPage = await request(`/apps/${app.cms}`, "support");
  ok(memberPage.text.includes("Só o Administrador da empresa abre este app"), "Membro vê por que não abre o CMS");
  const memberCms = await open("cms", "support");
  ok(!memberCms.pass && memberCms.text.includes("Só o Administrador da empresa abre este app"), "Membro não recebe passe do CMS");
  const memberRoteiro = verifyPass((await open("roteiro", "support")).pass ?? "", "brastemp-roteiro-digital");
  ok(memberRoteiro?.role === "member" && memberRoteiro.company === ids.a, "Membro abre o Roteiro Digital");

  // Outside the company, nothing exists; without a session, nothing opens.
  ok(notFoundPage(await request(`/apps/${app.cms}`, "outsider")), "Quem não é da empresa não vê o app");
  ok(!(await open("cms", "outsider")).pass, "Quem não é da empresa não recebe passe");
  ok(notFoundPage(await request(`/apps/${app.other}`, "manager")), "Administrador de A não vê o app da empresa B");
  ok(!(await open("other", "manager")).pass, "Administrador de A não recebe passe do app da empresa B");
  const anonymous = await request(`/apps/${app.cms}`);
  ok(anonymous.status >= 300 && anonymous.status < 400, "Sem sessão, a página do app pede login");
  ok(!(await open("cms")).pass, "Sem sessão, nenhum passe");
  ok(notFoundPage(await request(`/apps/${randomUUID()}`, "manager")), "Produto inexistente responde 404");

  // Products that are not an app, paused, or without the company's tenant say why.
  ok((await request(`/apps/${app.site}`, "manager")).text.includes("Este produto abre fora do Console"), "O site público não abre como app");
  ok((await request(`/apps/${app.paused}`, "manager")).text.includes("está pausado"), "Produto pausado não abre");
  ok(!(await open("paused", "manager")).pass, "Produto pausado não recebe passe");
  ok((await request(`/apps/${app.base}`, "admin")).text.includes("ainda não foi liberado"), "Base Pendente sem tenant da empresa não abre");
  ok(!(await open("base", "admin")).pass, "Base Pendente sem tenant não recebe passe");

  // Lists send apps to /apps and leave other products as plain links.
  const list = await request("/produtos?status=all&q=" + encodeURIComponent(marker), "manager");
  ok(
    list.text.includes(`href="/apps/${app.cms}"`) &&
      list.text.includes(`href="/apps/${app.roteiro}"`) &&
      !list.text.includes('href="https://www.espacoabsolut.com/admin"') &&
      list.text.includes('href="https://www.espacoabsolut.com/"'),
    "Produtos leva os apps para dentro do Console e mantém o site como link",
  );
  const dashboard = await request("/painel", "manager");
  ok(dashboard.text.includes(`href="/apps/${app.cms}"`) && !dashboard.text.includes('href="https://www.espacoabsolut.com/admin"'), "O painel abre o CMS dentro do Console");
}
