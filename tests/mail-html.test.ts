import assert from "node:assert/strict";
import test from "node:test";
import { cleanEmailHtml, hasRemoteImages, htmlToText } from "../src/lib/mail/mail-html";
import { MAIL_FRAME_SANDBOX, mailDocument, mailPolicy } from "../src/lib/mail/mail-document";

const hostile = `<html><head><title>Título</title><meta http-equiv="refresh" content="0;url=https://evil.example">
<base href="https://evil.example/"><style>p{color:red}</style></head>
<body onload="steal()"><script>alert(1)</script>
<p onclick="x()" style="color:blue">Oi <a href="javascript:alert(1)">clique</a> <a href="https://ok.example">site</a> <a href="//evil.example">rel</a></p>
<form action="https://evil.example"><input name="senha"><button>Entrar</button></form>
<iframe src="https://evil.example">fallback</iframe><object data="x.swf"></object><embed src="x.swf">
<svg><script>alert(2)</script></svg><img src="x" onerror="alert(3)"><img src="data:text/html;base64,PHNjcmlwdD4=">
<a href="JaVaScRiPt:alert(4)">j</a><table background="javascript:alert(5)"><tr><td>c</td></tr></table></body></html>`;

test("the HTML loses scripts, handlers, javascript: links, forms, frames, objects, embeds and meta refresh", () => {
  const { html } = cleanEmailHtml(hostile);
  for (const bad of ["<script", "alert(", "onload", "onclick", "onerror", "javascript:", "<form", "<input", "<iframe", "<object", "<embed", "<meta", "<base", "refresh", "evil.example", "<svg", "data:text/html", "Título"])
    assert.ok(!html.toLowerCase().includes(bad.toLowerCase()), `${bad} saiu: ${html}`);
  // What a message needs stays: text, styles and real links, which open in a new tab.
  assert.match(html, /<style>p\{color:red\}<\/style>/);
  assert.match(html, /<p style="color:blue">Oi /);
  assert.match(html, /<a href="https:\/\/ok\.example" target="_blank" rel="noopener noreferrer">site<\/a>/);
  assert.match(html, /<td>c<\/td>/);
});

test("cid: images become the data: URIs the server inlined; unknown ones lose their source", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const { html, remoteImages } = cleanEmailHtml('<img src="cid:Logo@Mail"><img src="cid:outro@mail"><img src="data:image/png;base64,AAAA">', { "logo@mail": png });
  assert.match(html, new RegExp(`<img src="${png.replace(/[+/.]/g, "\\$&")}" />`));
  assert.match(html, /<img \/>/);
  assert.match(html, /data:image\/png;base64,AAAA/);
  assert.equal(remoteImages, false);
});

test("remote images are detected so the page can offer Mostrar imagens", () => {
  assert.equal(cleanEmailHtml('<img src="https://tracker.example/p.gif">').remoteImages, true);
  assert.equal(cleanEmailHtml('<td style="background:url(https://x.example/bg.png)">a</td>').remoteImages, true);
  assert.equal(hasRemoteImages("<p>sem imagens</p>"), false);
});

test("the frame: sandbox without scripts or same origin, a policy that loads nothing, links in a new tab", () => {
  assert.equal(MAIL_FRAME_SANDBOX, "allow-popups allow-popups-to-escape-sandbox");
  assert.ok(!MAIL_FRAME_SANDBOX.includes("allow-scripts") && !MAIL_FRAME_SANDBOX.includes("allow-same-origin"));
  assert.equal(mailPolicy(false), "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  assert.equal(mailPolicy(true), "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:");
  const doc = mailDocument("<p>oi</p>");
  // The policy comes before anything that could load.
  assert.ok(doc.indexOf("Content-Security-Policy") < doc.indexOf("<style>"));
  assert.ok(doc.indexOf("Content-Security-Policy") < doc.indexOf("<p>oi</p>"));
  assert.match(doc, /<base target="_blank">/);
  assert.match(mailDocument("", { remoteImages: true }), /img-src data: https:/);
});

test("a text version for quoting an HTML-only message", () => {
  assert.equal(htmlToText("<style>p{}</style><p>Oi&nbsp;Ana,</p><div>linha<br>dois &amp; três &lt;ok&gt;</div>"), "Oi Ana,\nlinha\ndois & três <ok>");
});
