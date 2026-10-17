import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { imageFormatOf } from "../src/lib/images/image-format";
import { normalizeTicketFile } from "../src/lib/tickets/ticket-files";

const picture = () => sharp({ create: { width: 640, height: 480, channels: 3, background: "#1a428a" } });
const refused = /Envie um PDF ou uma imagem PNG, JPEG ou WebP válida/;

test("o formato da imagem vem dos primeiros bytes, não do nome nem do tipo enviado", async () => {
  assert.equal(imageFormatOf(await picture().png().toBuffer()), "png");
  assert.equal(imageFormatOf(await picture().jpeg().toBuffer()), "jpeg");
  assert.equal(imageFormatOf(await picture().webp().toBuffer()), "webp");
  assert.equal(imageFormatOf(await picture().tiff().toBuffer()), null);
  assert.equal(imageFormatOf(await picture().gif().toBuffer()), null);
  assert.equal(imageFormatOf(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(imageFormatOf(Buffer.from("RIFF")), null);
  assert.equal(imageFormatOf(Buffer.alloc(0)), null);
});

test("anexo de chamado: PNG, JPEG e WebP viram WebP; PDF passa como está", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const file = await normalizeTicketFile(await picture().toFormat(format).toBuffer(), `tela.${format}`);
    assert.equal(file.mime, "image/webp");
    assert.equal(file.name, "tela.webp");
    assert.equal((await sharp(file.content).metadata()).format, "webp");
  }
  const pdf = Buffer.from("%PDF-1.7\n%%EOF\n");
  assert.deepEqual(await normalizeTicketFile(pdf, "nota.pdf"), { content: pdf, name: "nota.pdf", size: pdf.length, mime: "application/pdf" });
});

test("anexo de chamado: SVG, TIFF, GIF e imagem truncada são recusados antes de decodificar", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  await assert.rejects(normalizeTicketFile(svg, "logo.svg"), refused);
  await assert.rejects(normalizeTicketFile(svg, "logo.png"), refused);
  await assert.rejects(normalizeTicketFile(await picture().tiff().toBuffer(), "scan.tiff"), refused);
  await assert.rejects(normalizeTicketFile(await picture().gif().toBuffer(), "anim.gif"), refused);
  const png = await picture().png().toBuffer();
  await assert.rejects(normalizeTicketFile(png.subarray(0, 64), "cortada.png"), refused);
});
