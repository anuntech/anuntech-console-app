import { request as httpRequest } from "node:http";

/**
 * workspace.anuntech.com points at the Console: every path on that host goes
 * to its page in the Console with a temporary redirect and no query string,
 * and the Console's own host answers exactly as before (src/proxy.ts,
 * lib/http/workspace-redirect.ts).
 */
export async function runWorkspaceDomainTests({ people, ok, base, notFoundPage, passKeyId }) {
  const consoleOrigin = "https://console.anuntech.com";
  const ownHost = new URL(base).host;
  // fetch() keeps its own Host header, so these go through node:http.
  const send = (path, host, { method = "GET", who, body } = {}) =>
    new Promise((resolve, reject) => {
      const url = new URL(path, base);
      const req = httpRequest(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers: {
            Host: host,
            ...(who ? { Cookie: people[who].cookie } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
        },
        (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (text += chunk));
          res.on("end", () =>
            resolve({ status: res.statusCode, location: res.headers.location ?? null, cache: res.headers["cache-control"] ?? "", text }),
          );
        },
      );
      req.on("error", reject);
      req.end(body);
    });

  // Specific before generic; the query string never goes along.
  const map = [
    ["/apps/1e9b1689-4f40-452d-992d-914eadad3cd0", "/abrir/brastemp-base-pendente"],
    ["/apps/1e9b1689-4f40-452d-992d-914eadad3cd0/embed?token=velho", "/abrir/brastemp-base-pendente"],
    ["/apps/app_mulheresfm", "/abrir/mulheresfm-cms"],
    ["/apps/app_mulheresfm/view?token=velho", "/abrir/mulheresfm-cms"],
    ["/apps", "/produtos"],
    ["/apps/outro-app/embed", "/produtos"],
    ["/support/new", "/chamados/novo"],
    ["/support", "/chamados"],
    ["/support/abc", "/chamados"],
    ["/shortcuts", "/bookmarks"],
    ["/shortcuts/x/view", "/bookmarks"],
    ["/login?callbackUrl=%2Fadmin", "/entrar"],
    ["/register", "/entrar"],
    ["/forgot-password", "/entrar"],
    ["/reset-password?token=velho", "/entrar"],
    ["/accept-invite/abc", "/entrar"],
    ["/admin", "/painel"],
    ["/admin/apps", "/painel"],
    ["/", "/painel"],
    ["/dashboard", "/painel"],
    ["/notes/x", "/painel"],
    ["/files", "/painel"],
    ["/folders/x", "/painel"],
    ["/api/auth/get-session", "/painel"],
    ["/.well-known/jwks.json", "/painel"],
    ["/favicon.ico", "/painel"],
    ["/abrir/mulheresfm-cms", "/painel"],
  ];
  for (const [path, to] of map) {
    const r = await send(path, "workspace.anuntech.com");
    ok(
      r.status === 307 && r.location === `${consoleOrigin}${to}` && /no-store/.test(r.cache),
      `workspace.anuntech.com${path} vai para ${to} no Console (307)`,
    );
  }
  const webhook = await send("/api/webhooks/asaas", "workspace.anuntech.com", { method: "POST", body: '{"event":"PAYMENT_RECEIVED"}' });
  ok(webhook.status === 307 && webhook.location === `${consoleOrigin}/painel`, "POST no webhook antigo do Workspace também vai para o Console");
  const signedIn = await send("/painel", "workspace.anuntech.com", { who: "admin" });
  ok(signedIn.status === 307 && signedIn.location === `${consoleOrigin}/painel`, "Com sessão, o domínio do Workspace nunca mostra o Console");
  const variant = await send("/support/new", "WORKSPACE.anuntech.com:443");
  ok(variant.status === 307 && variant.location === `${consoleOrigin}/chamados/novo`, "O host do Workspace vale com maiúsculas e porta");

  // The Console's host answers as before: same status and Location as the host the suite uses.
  for (const host of ["console.anuntech.com", "localhost"]) {
    for (const [path, who] of [
      ["/painel", undefined],
      ["/painel", "admin"],
      ["/abrir/mulheresfm-cms", undefined],
      ["/apps/app_mulheresfm", "admin"],
      ["/login", undefined],
      ["/support/new", "admin"],
      ["/", undefined],
    ]) {
      const [mine, before] = [await send(path, host, { who }), await send(path, ownHost, { who })];
      ok(
        mine.status === before.status && mine.location === before.location && !mine.location?.startsWith(consoleOrigin),
        `${host}${path} (${who ?? "sem sessão"}) responde como antes: ${mine.status}${mine.location ? ` ${mine.location}` : ""}`,
      );
    }
    const panel = await send("/painel", host, { who: "admin" });
    ok(panel.status === 200 && !panel.location, `${host}/painel abre o painel com sessão`);
    const jwks = await send("/.well-known/jwks.json", host);
    ok(jwks.status === 200 && JSON.parse(jwks.text).keys?.[0]?.kid === passKeyId, `${host}/.well-known/jwks.json continua publicando a chave`);
    const open = await send("/abrir/mulheresfm-cms", host);
    ok(open.status === 307 && open.location === "/entrar?volta=/abrir/mulheresfm-cms", `${host}/abrir/<app> continua pedindo login com volta`);
    const unknown = await send("/abrir/x", host, { who: "admin" });
    ok(notFoundPage(unknown) && !unknown.location, `${host}/abrir/x continua 404`);
  }
}
