import assert from "node:assert/strict";
import test from "node:test";
import { consolePath, consoleTarget, type AppReach } from "../mobile/src/lib/console-paths";
import { safeHandoffPath } from "../src/lib/auth/handoff-path";
import { APP_LINK_PATHS } from "../src/lib/api/app-links";

const manager: AppReach = { finance: true, managed: true };
const member: AppReach = { finance: false, managed: false };
const id = "0b6c3f4e-8f1a-4c2d-9e7b-1a2b3c4d5e6f";
const app = (href: string) => ({ kind: "app", href });
const web = (path: string) => ({ kind: "web", path });

test("Início, Ajuda and Como trabalhamos open in the app", () => {
  assert.deepEqual(consoleTarget("/painel", member), app("/"));
  assert.deepEqual(consoleTarget("/painel#banco-de-horas-abc", member), app("/"));
  assert.deepEqual(consoleTarget("/", member), app("/"));
  assert.deepEqual(consoleTarget("/ajuda", member), app("/ajuda"));
  assert.deepEqual(consoleTarget("/ajuda/avisos-de-cobranca", member), { kind: "article", slug: "avisos-de-cobranca" });
  assert.deepEqual(consoleTarget("/como-trabalhamos", member), app("/como-trabalhamos"));
});

test("areas and their records open in the app, keeping the filter of the link", () => {
  for (const area of ["chamados", "contratos", "orcamentos", "projetos", "produtos"]) {
    assert.deepEqual(consoleTarget(`/${area}`, member), app(`/${area}`));
    assert.deepEqual(consoleTarget(`/${area}/${id}`, member), app(`/${area}/${id}`));
  }
  assert.deepEqual(consoleTarget("/chamados?status=waiting_customer", member), app("/chamados?status=waiting_customer"));
  assert.deepEqual(consoleTarget(`/chamados?status=active&company=${id}&x=1`, member), app(`/chamados?status=active&company=${id}`));
  assert.deepEqual(consoleTarget("/orcamentos?status=sent", member), app("/orcamentos?status=sent"));
  assert.deepEqual(consoleTarget("/contratos/", member), app("/contratos"));
});

test("only a real id opens a record; web-only pages stay on the web", () => {
  assert.deepEqual(consoleTarget("/projetos/novo", manager), web("/projetos/novo"));
  assert.deepEqual(consoleTarget("/produtos/novo", manager), web("/produtos/novo"));
  assert.deepEqual(consoleTarget(`/contratos/novo?parentId=${id}`, manager), web(`/contratos/novo?parentId=${id}`));
  assert.deepEqual(consoleTarget("/empresas", manager), web("/empresas"));
});

test("a new ticket keeps its kind, company and product", () => {
  assert.deepEqual(consoleTarget("/chamados/novo", member), app("/chamados/novo"));
  assert.deepEqual(consoleTarget("/chamados/novo?tipo=novo-projeto", member), app("/chamados/novo?kind=novo-projeto"));
  assert.deepEqual(
    consoleTarget(`/chamados/novo?tipo=acesso&companyId=${id}&engagementId=${id}`, member),
    app(`/chamados/novo?kind=acesso&companyId=${id}&engagementId=${id}`),
  );
});

test("products, apps and boards open their screens", () => {
  assert.deepEqual(consoleTarget(`/apps/${id}`, member), app(`/produtos/app/${id}`));
  assert.deepEqual(consoleTarget("/bookmarks", member), app("/bookmarks"));
  assert.deepEqual(consoleTarget(`/bookmarks/${id}/lousa`, member), app(`/bookmarks/${id}/lousa`));
});

test("Financeiro only for who has the tab", () => {
  assert.deepEqual(consoleTarget("/financeiro", manager), app("/financeiro"));
  assert.deepEqual(consoleTarget(`/financeiro/${id}?status=overdue`, manager), app(`/financeiro/${id}?status=overdue`));
  assert.deepEqual(consoleTarget("/financeiro", member).kind, "web");
});

test("account and settings go to Conta; company pages only for the company's Administrador", () => {
  assert.deepEqual(consoleTarget("/conta", member), app("/conta"));
  assert.deepEqual(consoleTarget("/configuracoes", member), app("/conta"));
  assert.deepEqual(consoleTarget("/configuracoes/aparencia", member), app("/conta/aparencia"));
  assert.deepEqual(consoleTarget("/configuracoes/seguranca", member), app("/conta/seguranca"));
  assert.deepEqual(consoleTarget("/configuracoes/membros", manager), app("/conta/membros"));
  assert.deepEqual(consoleTarget("/configuracoes/membros", member), web("/configuracoes/membros"));
  assert.deepEqual(consoleTarget("/configuracoes/integracoes", manager), web("/configuracoes/integracoes"));
});

test("links from outside: the Console path of an address", () => {
  assert.equal(consolePath("https://console.anuntech.com/painel#banco-de-horas-x"), "/painel#banco-de-horas-x");
  assert.equal(consolePath("/chamados?status=x"), "/chamados?status=x");
  assert.equal(consolePath("anuntech://chamados"), null);
  assert.equal(consolePath("//evil.com/x"), null);
});

test("every e-mail area that is an app link has a screen in the app", () => {
  for (const pattern of APP_LINK_PATHS) {
    const path = pattern.replace("/*", `/${id}`);
    assert.equal(consoleTarget(path, manager).kind, "app", path);
  }
});

test("the session hand-off only lands on a page of this Console", () => {
  assert.equal(safeHandoffPath(`/bookmarks/${id}/lousa`), `/bookmarks/${id}/lousa`);
  assert.equal(safeHandoffPath("/chamados?status=x#y"), "/chamados?status=x#y");
  assert.equal(safeHandoffPath("/a/../painel"), "/painel");
  for (const bad of [
    "",
    "painel",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/",
    "javascript:alert(1)",
    "/painel\n",
    "/ painel",
    "/api/auth/sign-out",
    "/API/v1/me",
    "/api",
    `/${"a".repeat(1100)}`,
    null,
    42,
  ])
    assert.equal(safeHandoffPath(bad), null, String(bad));
});

test("Android's link paths are the same areas the Console serves (app.config.ts)", async () => {
  const { readFileSync } = await import("node:fs");
  const config = readFileSync(new URL("../mobile/app.config.ts", import.meta.url), "utf8");
  const block = config.match(/const linkPaths = \[([^\]]*)\]/)![1];
  const android = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  const served = [...new Set(APP_LINK_PATHS.map((p) => p.replace("/*", "")))].sort();
  assert.deepEqual(android, served);
});
