import PDFDocument from "pdfkit";
import path from "node:path";
import type { ContractPublication } from "@/db/schema";
import { APP_LOCALE, APP_TIME_ZONE } from "./dates";

export async function contractPdf(
  input: ContractPublication & {
    id: string;
    version: number;
    date: Date;
    draft: boolean;
  },
): Promise<Buffer> {
  const fonts = path.join(process.cwd(), "assets/fonts");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, bottom: 64, left: 54, right: 54 },
    bufferPages: true,
    font: path.join(fonts, "NotoSans-Regular.ttf"),
    info: {
      Title: input.title,
      Author: "Anuntech",
      Subject: input.draft
        ? "Rascunho de contrato"
        : "Contrato publicado na Console",
    },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont("Regular", path.join(fonts, "NotoSans-Regular.ttf"));
  doc.registerFont("Bold", path.join(fonts, "NotoSans-Bold.ttf"));
  const width = doc.page.width - 108;
  doc
    .font("Bold")
    .fontSize(9)
    .fillColor("#53637a")
    .text(
      input.draft
        ? "RASCUNHO - NÃO PUBLICADO"
        : `ANUNTECH CONSOLE | VERSÃO ${input.version}`,
    );
  doc
    .moveDown(1)
    .fontSize(20)
    .fillColor("#10233e")
    .text(input.title, { width });
  doc
    .moveDown(0.6)
    .font("Regular")
    .fontSize(10)
    .fillColor("#53637a")
    .text(`${input.companyName} | ${input.companyDocument}`, { width });
  doc.text(
    `${input.draft ? "Rascunho atualizado" : "Publicado"} em ${new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: APP_TIME_ZONE }).format(input.date)} (São Paulo)`,
    { width },
  );
  doc.moveDown(1.5).fontSize(11).fillColor("#202630");
  const paragraphs = input.body.split("\n\n");
  const options = { width, align: "left" as const, lineGap: 3 };
  for (let p = 0; p < paragraphs.length; p++) {
    const paragraph = paragraphs[p];
    const height = doc.heightOfString(paragraph || " ", options);
    // Keep normal paragraphs together and a short heading with the next lines.
    const nextLines =
      paragraph.length < 120 && p + 1 < paragraphs.length ? 40 : 0;
    if (
      height + nextLines < doc.page.height - 118 &&
      doc.y + height + nextLines > doc.page.height - 64
    )
      doc.addPage();
    doc.text(paragraph || " ", options);
    if (p < paragraphs.length - 1) doc.moveDown(0.6);
  }
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Footer uses the reserved margin; disable wrapping to avoid adding a page.
    doc
      .font("Regular")
      .fontSize(8)
      .fillColor("#687589")
      .text(
        `${input.draft ? "Rascunho" : `Versão ${input.version}`} | ${input.id}`,
        54,
        doc.page.height - 36,
        { lineBreak: false },
      );
    doc.text(
      `${i + 1} / ${range.count}`,
      doc.page.width - 90,
      doc.page.height - 36,
      { lineBreak: false },
    );
  }
  doc.end();
  return result;
}
