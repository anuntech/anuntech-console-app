import PDFDocument from "pdfkit";
import path from "node:path";
import type { ContractPublication } from "@/db/schema";
import { APP_LOCALE, APP_TIME_ZONE } from "./dates";

export type ContractSignatureLine = {
  party: "client" | "anuntech";
  name: string;
  email: string;
  signedAt: Date;
  ip: string | null;
  method: string;
};

const when = (date: Date) =>
  `${new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: APP_TIME_ZONE }).format(date)} (São Paulo)`;

/**
 * The contract as a PDF: the text, then a signatures page with each party's
 * evidence and the document hash. A draft is marked as such on every page.
 */
export async function contractPdf(
  input: ContractPublication & {
    id: string;
    status: "draft" | "sent" | "signed" | "cancelled";
    date: Date;
    hash: string | null;
    signatures: ContractSignatureLine[];
  },
): Promise<Buffer> {
  const fonts = path.join(process.cwd(), "assets/fonts");
  const draft = input.status === "draft";
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, bottom: 64, left: 54, right: 54 },
    bufferPages: true,
    font: path.join(fonts, "NotoSans-Regular.ttf"),
    info: {
      Title: input.title,
      Author: "Anuntech",
      Subject:
        input.status === "signed"
          ? "Contrato assinado eletronicamente"
          : draft
            ? "Rascunho de contrato"
            : "Contrato aguardando assinaturas",
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
  const eyebrow =
    input.status === "signed"
      ? "CONTRATO ASSINADO ELETRONICAMENTE"
      : input.status === "sent"
        ? "CONTRATO AGUARDANDO ASSINATURAS"
        : input.status === "cancelled"
          ? "CONTRATO CANCELADO"
          : "RASCUNHO — SEM VALIDADE";
  doc.font("Bold").fontSize(9).fillColor("#53637a").text(eyebrow);
  doc.moveDown(1).fontSize(20).fillColor("#10233e").text(input.title, { width });
  doc
    .moveDown(0.6)
    .font("Regular")
    .fontSize(10)
    .fillColor("#53637a")
    .text(`${input.companyName} | ${input.companyDocument}`, { width });
  doc.text(
    `${draft ? "Rascunho atualizado" : input.status === "signed" ? "Assinado" : "Enviado para assinatura"} em ${when(input.date)}`,
    { width },
  );
  doc.moveDown(1.5).fontSize(11).fillColor("#202630");
  const paragraphs = input.body.split("\n\n");
  const options = { width, align: "left" as const, lineGap: 3 };
  for (let p = 0; p < paragraphs.length; p++) {
    const paragraph = paragraphs[p];
    const height = doc.heightOfString(paragraph || " ", options);
    const nextLines = paragraph.length < 120 && p + 1 < paragraphs.length ? 40 : 0;
    if (height + nextLines < doc.page.height - 118 && doc.y + height + nextLines > doc.page.height - 64)
      doc.addPage();
    doc.text(paragraph || " ", options);
    if (p < paragraphs.length - 1) doc.moveDown(0.6);
  }

  if (!draft) {
    doc.addPage();
    doc.font("Bold").fontSize(9).fillColor("#53637a").text("ASSINATURAS");
    doc.moveDown(1).fontSize(16).fillColor("#10233e").text("Registro de assinaturas eletrônicas", { width });
    doc
      .moveDown(0.6)
      .font("Regular")
      .fontSize(10)
      .fillColor("#53637a")
      .text(
        "Cada parte assinou este documento pelo Anuntech Console, com identidade confirmada por código enviado ao e-mail ou WhatsApp cadastrado. O hash abaixo identifica exatamente o texto assinado.",
        { width },
      );
    for (const party of ["client", "anuntech"] as const) {
      const line = input.signatures.find((s) => s.party === party);
      doc.moveDown(1.4).font("Bold").fontSize(11).fillColor("#10233e").text(
        party === "client" ? `Contratante — ${input.companyName}` : "Contratada — Anuntech",
        { width },
      );
      doc.font("Regular").fontSize(10).fillColor("#202630");
      if (line) {
        doc.text(`${line.name} <${line.email}>`, { width });
        doc.text(`Assinado em ${when(line.signedAt)}`, { width });
        doc.fillColor("#53637a").text(
          `Identidade: ${line.method === "otp_session" ? "acesso com código de verificação" : line.method}${line.ip ? ` · IP ${line.ip}` : ""}`,
          { width },
        );
      } else {
        doc.fillColor("#53637a").text("Aguardando assinatura.", { width });
      }
    }
    if (input.hash) {
      doc.moveDown(1.6).font("Bold").fontSize(9).fillColor("#53637a").text("HASH DO DOCUMENTO (SHA-256)");
      doc.font("Regular").fontSize(9).fillColor("#202630").text(input.hash, { width });
      doc.moveDown(0.4).fillColor("#53637a").text(`Identificador do contrato: ${input.id}`, { width });
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Regular")
      .fontSize(8)
      .fillColor("#687589")
      .text(
        `${draft ? "Rascunho" : input.hash ? `Hash ${input.hash.slice(0, 16)}…` : input.id}`,
        54,
        doc.page.height - 36,
        { lineBreak: false },
      );
    doc.text(`${i + 1} / ${range.count}`, doc.page.width - 90, doc.page.height - 36, {
      lineBreak: false,
    });
  }
  doc.end();
  return result;
}
