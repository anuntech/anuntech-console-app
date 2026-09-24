import assert from "node:assert/strict";
import test from "node:test";
import { splitTabs, type TabEntry } from "../src/lib/mobile-tabs";

type TabItem = TabEntry<null>;
const icon = null;
const all: TabItem[] = [
  { href: "/painel", label: "Visão geral", short: "Início", icon },
  { href: "/empresas", label: "Empresas", icon },
  { href: "/projetos", label: "Projetos", icon },
  { href: "/produtos", label: "Produtos e serviços", short: "Produtos", icon },
  { href: "/chamados", label: "Chamados", icon },
  { href: "/financeiro", label: "Financeiro", icon },
  { href: "/bookmarks", label: "Bookmarks", icon },
  { href: "/contratos", label: "Contratos", icon },
];
const hrefs = (items: TabItem[]) => items.map((i) => i.href);

test("Anuntech keeps companies, tickets and billing at hand; the rest goes under Mais", () => {
  const { primary, rest } = splitTabs(all, true);
  assert.deepEqual(hrefs(primary), ["/painel", "/empresas", "/chamados", "/financeiro"]);
  assert.deepEqual(hrefs(rest), ["/projetos", "/produtos", "/bookmarks", "/contratos"]);
});

test("a client manager gets products instead of companies", () => {
  const client = all.filter((i) => i.href !== "/empresas");
  const { primary, rest } = splitTabs(client, false);
  assert.deepEqual(hrefs(primary), ["/painel", "/produtos", "/chamados", "/financeiro"]);
  assert.deepEqual(hrefs(rest), ["/projetos", "/bookmarks", "/contratos"]);
});

test("a member without billing access still fills four tabs, in order", () => {
  const member = all.filter((i) => !["/empresas", "/financeiro", "/contratos"].includes(i.href));
  const { primary, rest } = splitTabs(member, false);
  assert.deepEqual(hrefs(primary), ["/painel", "/produtos", "/chamados", "/projetos"]);
  assert.deepEqual(hrefs(rest), ["/bookmarks"]);
});
