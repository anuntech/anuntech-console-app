import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { ACCENTED, PLAIN, TEXT_MAX_CHARS, decodeEntities, documentText, htmlText, textKindOf, tidyText } from "../src/lib/drive/text-rules";
import { MARK_CLOSE, MARK_OPEN, excerptPieces } from "../src/lib/drive/text-excerpt";

const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])));

test("the kinds with text, by extension", () => {
  assert.equal(textKindOf("Contrato.PDF"), "pdf");
  assert.equal(textKindOf("proposta.docx"), "docx");
  assert.equal(textKindOf("deck.pptx"), "pptx");
  assert.equal(textKindOf("planilha.xlsx"), "xlsx");
  assert.equal(textKindOf("ata.odt"), "odf");
  assert.equal(textKindOf("notas.md"), "plain");
  assert.equal(textKindOf("foto.png"), null);
  assert.equal(textKindOf("semextensao"), null);
});

test("the search drops the same accents on both sides", () => {
  assert.equal([...ACCENTED].length, [...PLAIN].length);
  assert.ok(ACCENTED.includes("ç") && ACCENTED.includes("Ã"));
});

test("a Word document: paragraphs, tabs and entities, no field codes", () => {
  const docx = zip({
    "word/document.xml":
      '<w:document><w:body><w:p><w:r><w:t>Contrato de prestação</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Valor: </w:t><w:tab/><w:t>R$ 1.000 &amp; juros</w:t></w:r><w:r><w:instrText>PAGE</w:instrText></w:r></w:p></w:body></w:document>',
    "word/footer1.xml": "<w:ftr><w:p><w:r><w:t>Anuntech</w:t></w:r></w:p></w:ftr>",
  });
  assert.equal(documentText(docx, "docx"), "Contrato de prestação\nValor: R$ 1.000 & juros\n\nAnuntech");
});

test("slides in order, and a sheet with shared and inline strings", () => {
  const pptx = zip({
    "ppt/slides/slide10.xml": "<p:sld><a:p><a:r><a:t>Dez</a:t></a:r></a:p></p:sld>",
    "ppt/slides/slide2.xml": "<p:sld><a:p><a:r><a:t>Dois</a:t></a:r></a:p></p:sld>",
  });
  assert.equal(documentText(pptx, "pptx"), "Dois\n\nDez");
  const xlsx = zip({
    "xl/sharedStrings.xml": "<sst><si><t>Cliente</t></si><si><r><t>Espaço </t></r><r><t>Absolut</t></r></si></sst>",
    "xl/worksheets/sheet1.xml":
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Total</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>1500.5</v></c></row><row r="3"><c r="A3"/></row></sheetData></worksheet>',
  });
  assert.equal(documentText(xlsx, "xlsx"), "Cliente Total\nEspaço Absolut 1500.5");
});

test("OpenDocument, HTML and plain text", () => {
  const odt = zip({ "content.xml": "<office:document-content><text:h>Ata</text:h><text:p>Reunião de <text:span>outubro</text:span></text:p></office:document-content>" });
  assert.equal(documentText(odt, "odf"), "Ata\nReunião de outubro");
  assert.equal(tidyText(htmlText("<html><style>p{}</style><script>alert(1)</script><p>Olá&nbsp;mundo</p><div>fim</div></html>")), "Olá mundo\nfim");
  assert.equal(documentText(strToU8("linha 1\r\n\r\n\r\n\r\nlinha\u0000 2"), "plain"), "linha 1\n\nlinha 2");
});

test("text is cut at the limit and entities decode", () => {
  assert.equal(tidyText("a".repeat(TEXT_MAX_CHARS + 50)).length, TEXT_MAX_CHARS);
  assert.equal(decodeEntities("&lt;b&gt; &#225; &#xe7; &bogus;"), "<b> á ç &bogus;");
});

test("a broken zip throws, so the routine tries again", () => {
  assert.throws(() => documentText(strToU8("isto não é um zip"), "docx"));
});

test("the excerpt splits into highlighted pieces", () => {
  assert.deepEqual(excerptPieces(`o ${MARK_OPEN}contrato${MARK_CLOSE} da ${MARK_OPEN}Absolut${MARK_CLOSE}.`), [
    { text: "o ", hit: false },
    { text: "contrato", hit: true },
    { text: " da ", hit: false },
    { text: "Absolut", hit: true },
    { text: ".", hit: false },
  ]);
});
