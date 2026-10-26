import assert from "node:assert/strict";
import test from "node:test";
import { brandEmailHtml, emailBlocks } from "../src/lib/email/brand-email";

const url = "https://console.anuntech.com/chamados/1";

test("details become a box, the closing link the button, and the signature leaves", () => {
  const { blocks, button } = emailBlocks(`Algo mudou.\n\nEmpresa: Hipermais\nChamado: Erro no login\n\nAcompanhe e responda no Console: ${url}\n\nAnuntech`);
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["p", "facts", "button"],
  );
  assert.deepEqual(button, { label: "Acompanhe e responda no Console", url });
});

test("a long lead stays as a sentence above a generic button", () => {
  const { blocks } = emailBlocks(`Veja o detalhamento do orçamento e responda pelo Console: ${url}`);
  assert.deepEqual(blocks[0], { kind: "p", lines: ["Veja o detalhamento do orçamento e responda pelo Console."] });
  assert.deepEqual(blocks[1], { kind: "button", label: "Abrir no Console", url });
});

test("a heading and its items become a list", () => {
  const { blocks } = emailBlocks("Faturas em atraso:\n- Uma\n- Duas\n… e mais 3");
  assert.deepEqual(blocks, [
    { kind: "p", lines: ["Faturas em atraso:"] },
    { kind: "list", items: ["Uma", "Duas", "… e mais 3"] },
  ]);
});

test("the access code shows large, once", () => {
  const html = brandEmailHtml({ subject: "Código", title: "Seu código de acesso", code: "482913", text: "Seu código de acesso: 482913\n\nVale por 5 minutos.\n\nAnuntech" });
  assert.equal(html.split("482913").length - 1, 1);
  assert.ok(!html.includes(">Seu código de acesso:<"));
});

test("the text is escaped and the opening line does not repeat the title", () => {
  const html = brandEmailHtml({ subject: "Nova resposta", text: `Nova resposta\n\n<script>alert(1)</script>\n\nAbrir: ${url}` });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(/<h1[^>]*>Nova resposta<\/h1>/.test(html));
  assert.ok(!/<p[^>]*>Nova resposta/.test(html));
});

test("a link given mid-sentence gets the requested button after its paragraph", () => {
  const login = "https://console.anuntech.com/entrar";
  const html = brandEmailHtml({ subject: "Acesso", text: `Liberado.\n\nPara entrar, abra ${login} e use este e-mail.\n\nAnuntech`, action: { label: "Entrar no Console", url: login } });
  assert.ok(html.indexOf("Entrar no Console") > html.indexOf("Para entrar"));
});

test("the team's e-mails say they are internal; the client's offer help", () => {
  assert.ok(brandEmailHtml({ subject: "x", text: "y", audience: "staff" }).includes("Aviso interno"));
  assert.ok(brandEmailHtml({ subject: "x", text: "y" }).includes("Fale com a nossa equipe"));
});
