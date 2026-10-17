import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { PROTECTED_APPS } from "../src/lib/apps/registry";
import { config, proxy } from "../src/proxy";
import {
  CONSOLE_ORIGIN,
  isWorkspaceHost,
  workspaceDestination,
  workspaceRedirect,
} from "../src/lib/http/workspace-redirect";

test("each Workspace path goes to its page in the Console, specific before generic", () => {
  const map: [string, string][] = [
    ["/apps/1e9b1689-4f40-452d-992d-914eadad3cd0", "/abrir/brastemp-base-pendente"],
    ["/apps/1e9b1689-4f40-452d-992d-914eadad3cd0/embed", "/abrir/brastemp-base-pendente"],
    ["/apps/1e9b1689-4f40-452d-992d-914eadad3cd0/view/a/b", "/abrir/brastemp-base-pendente"],
    ["/apps/app_mulheresfm", "/abrir/mulheresfm-cms"],
    ["/apps/app_mulheresfm/view", "/abrir/mulheresfm-cms"],
    ["/apps/app_mulheresfm/embed", "/abrir/mulheresfm-cms"],
    ["/apps", "/produtos"],
    ["/apps/outro-app", "/produtos"],
    ["/apps/outro-app/embed", "/produtos"],
    ["/apps/app_mulheresfmx", "/produtos"],
    ["/apps/1E9B1689-4F40-452D-992D-914EADAD3CD0", "/produtos"],
    ["/support/new", "/chamados/novo"],
    ["/support", "/chamados"],
    ["/support/123", "/chamados"],
    ["/support/new/x", "/chamados"],
    ["/shortcuts", "/bookmarks"],
    ["/shortcuts/x", "/bookmarks"],
    ["/shortcuts/x/view", "/bookmarks"],
    ["/login", "/entrar"],
    ["/register", "/entrar"],
    ["/forgot-password", "/entrar"],
    ["/reset-password", "/entrar"],
    ["/accept-invite", "/entrar"],
    ["/accept-invite/abc", "/entrar"],
    ["/accept-invite/abc/def", "/entrar"],
    ["/admin", "/painel"],
    ["/admin/apps", "/painel"],
    ["/", "/painel"],
    ["", "/painel"],
    ["/dashboard", "/painel"],
    ["/notes/x", "/painel"],
    ["/files", "/painel"],
    ["/folders/x/y", "/painel"],
    ["/api/webhooks/asaas", "/painel"],
    ["/api/auth/session", "/painel"],
    ["/.well-known/jwks.json", "/painel"],
    ["/login/x", "/painel"],
    ["/painel", "/painel"],
    ["/abrir/mulheresfm-cms", "/painel"],
  ];
  for (const [from, to] of map) assert.equal(workspaceDestination(from), to, from);
});

test("names that are not Workspace apps never pick an app by accident", () => {
  for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"])
    assert.equal(workspaceDestination(`/apps/${name}`), "/produtos", name);
});

test("the app links point at apps the Console registry knows", () => {
  const ids = new Set(PROTECTED_APPS.map((app) => app.id));
  for (const path of ["/apps/1e9b1689-4f40-452d-992d-914eadad3cd0", "/apps/app_mulheresfm"]) {
    const app = workspaceDestination(path).replace("/abrir/", "");
    assert.ok(ids.has(app), app);
  }
});

test("only the Workspace host redirects, always to the fixed Console origin", () => {
  assert.equal(CONSOLE_ORIGIN, "https://console.anuntech.com");
  for (const host of ["workspace.anuntech.com", "WORKSPACE.anuntech.com", "workspace.anuntech.com:443"])
    assert.equal(workspaceRedirect(host, "/support/new"), "https://console.anuntech.com/chamados/novo", host);
  for (const host of [
    "console.anuntech.com",
    "localhost",
    "localhost:3100",
    "127.0.0.1:3101",
    "anuntech.com",
    "workspace.anuntech.com.evil.com",
    "evil.com.workspace.anuntech.com",
    "workspaceXanuntechXcom",
    "",
    null,
    undefined,
  ]) {
    assert.equal(isWorkspaceHost(host), false, String(host));
    assert.equal(workspaceRedirect(host, "/support/new"), null, String(host));
  }
});

test("the proxy answers the Workspace host with a temporary redirect and no query", () => {
  const request = new NextRequest("http://127.0.0.1:3100/apps/app_mulheresfm/view?token=old&x=1", {
    headers: { host: "workspace.anuntech.com" },
  });
  const response = proxy(request);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://console.anuntech.com/abrir/mulheresfm-cms");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("the proxy leaves the Console host as it was", () => {
  for (const host of ["console.anuntech.com", "localhost:3100"]) {
    const response = proxy(new NextRequest("http://127.0.0.1:3100/conta", { headers: { host } }));
    assert.equal(response.headers.get("location"), null, host);
    assert.equal(response.headers.get("x-middleware-next"), "1", host);
  }
});

test("the proxy runs on every path of the Workspace host and keeps its old paths", () => {
  assert.deepEqual(config.matcher, [
    "/conta",
    "/configuracoes/:path*",
    { source: "/:path*", has: [{ type: "host", value: "workspace.anuntech.com" }] },
  ]);
});
