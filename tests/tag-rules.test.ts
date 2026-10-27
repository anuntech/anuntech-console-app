import { test } from "node:test";
import assert from "node:assert/strict";
import { TAGS, TAG_SLUGS, isTag, suggestTag, tagLabels } from "../src/lib/drive/tag-rules";
import { TAG_SLUGS as CONTRACT_TAGS } from "../src/lib/api/contract";

const tag = (title: string, fileName: string, text?: string) => suggestTag({ title, fileName, text });

test("the name says most", () => {
  assert.equal(tag("Contrato Espaço Absolut", "contrato-assinado.pdf"), "contrato");
  assert.equal(tag("NF outubro", "nf_123.pdf"), "nota-fiscal");
  assert.equal(tag("Relatório mensal", "relatorio.docx"), "relatorio");
  assert.equal(tag("Proposta", "Orçamento site.pdf"), "proposta");
  assert.equal(tag("Apresentação", "pitch.pdf"), "apresentacao");
  assert.equal(tag("RG do sócio", "rg-frente.jpg"), "documento-pessoal");
  assert.equal(tag("Comprovante de residência", "conta-luz.pdf"), "documento-pessoal");
});

test("a logo is a drawing, not a photo or a sheet", () => {
  assert.equal(tag("Logo horizontal", "anuntech-logo.svg"), "marca");
  assert.equal(tag("Logotipo", "logo.png"), "marca");
  assert.equal(tag("Marcas vendidas", "marcas.xlsx"), "planilha");
});

test("the start of the text, when the name says nothing", () => {
  assert.equal(tag("Documento", "scan001.pdf", "DANFE - Documento Auxiliar da Nota Fiscal Eletrônica"), "nota-fiscal");
  assert.equal(tag("Arquivo", "doc.pdf", "CONTRATO DE PRESTAÇÃO DE SERVIÇOS. Pelo presente, a CONTRATANTE..."), "contrato");
  assert.equal(tag("Arquivo", "doc.pdf", "Banco Inter. Linha digitável 0779..."), "boleto");
  assert.equal(tag("Arquivo", "doc.pdf", "Comprovante de Pix enviado"), "comprovante");
  assert.equal(tag("Arquivo", "doc.docx", "Ata da reunião de 20/10"), "ata");
});

test("by kind, last; nothing when nothing fits", () => {
  assert.equal(tag("Números", "q3.xlsx"), "planilha");
  assert.equal(tag("Deck", "x.key"), "apresentacao");
  assert.equal(tag("Vitrine", "IMG_2041.HEIC"), "foto");
  assert.equal(tag("Gravação", "call.mov"), "video");
  assert.equal(tag("Notas", "notas.txt", "lista de compras"), null);
  assert.equal(tag("Programa", "setup.zip"), null);
});

test("every tag has a label and a valid slug", () => {
  for (const t of TAGS) assert.ok(isTag(t.slug) && tagLabels[t.slug] === t.label);
  assert.ok(!isTag("outro") && !isTag(null));
});

test("the app's contract lists the same tags", () => {
  assert.deepEqual([...CONTRACT_TAGS], [...TAG_SLUGS]);
});
