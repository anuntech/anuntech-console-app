import PDFDocument from "pdfkit";
import type { ContractPublication } from "@/db/schema";
import { APP_LOCALE, APP_TIME_ZONE } from "../dates";
import { longDateLabel } from "../format";
import { PDF_COLORS, pdfFonts, pdfHeader, registerPdfFonts } from "../pdf-brand";
import { contractBlocks } from "./contract-text";

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

/** "de 1 de outubro de 2026 a 30 de setembro de 2027", or one side of it. */
export function termSentence(startsAt?: string | null, endsAt?: string | null) {
  if (startsAt && endsAt) return `de ${longDateLabel(startsAt)} a ${longDateLabel(endsAt)}`;
  if (startsAt) return `a partir de ${longDateLabel(startsAt)}`;
  if (endsAt) return `até ${longDateLabel(endsAt)}`;
  return null;
}

/**
 * The contract as a PDF: the text, then a signatures page with each party's
 * evidence and the document hash. A draft is marked as such on every page;
 * an earlier version is marked as superseded.
 */
export async function contractPdf(
  input: ContractPublication & {
    id: string;
    status: "draft" | "sent" | "in_review" | "signed" | "cancelled";
    date: Date;
    hash: string | null;
    signatures: ContractSignatureLine[];
    /** A version that was replaced by a later send. */
    superseded?: boolean;
    version?: number;
  },
): Promise<Buffer> {
  const draft = input.status === "draft";
  const amendment = input.kind === "amendment";
  const noun = amendment ? "TERMO ADITIVO" : "CONTRATO";
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, bottom: 64, left: 54, right: 54 },
    bufferPages: true,
    font: pdfFonts().regular,
    info: {
      Title: input.title,
      Author: "Anuntech",
      Subject: input.superseded
        ? "Versão substituída de contrato"
        : input.status === "signed"
          ? `${amendment ? "Aditivo" : "Contrato"} assinado eletronicamente`
          : draft
            ? `Rascunho de ${amendment ? "aditivo" : "contrato"}`
            : `${amendment ? "Aditivo" : "Contrato"} aguardando assinaturas`,
    },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  registerPdfFonts(doc);
  const width = doc.page.width - 108;
  const eyebrow = input.superseded
    ? `${noun} · VERSÃO ${input.version ?? ""} SUBSTITUÍDA, SEM EFEITO`.replace("  ", " ")
    : input.status === "signed"
      ? `${noun} ASSINADO ELETRONICAMENTE`
      : input.status === "sent"
        ? `${noun} AGUARDANDO ASSINATURAS`
        : input.status === "in_review"
          ? `${noun} EM REVISÃO, SEM VALIDADE PARA ASSINATURA`
        : input.status === "cancelled"
          ? `${noun} CANCELADO`
          : "RASCUNHO — SEM VALIDADE";
  pdfHeader(doc, 54, width);
  doc.font("Bold").fontSize(9).fillColor(PDF_COLORS.violet).text(eyebrow);
  doc.moveDown(1).fontSize(20).fillColor(PDF_COLORS.ink).text(input.title, { width });
  doc
    .moveDown(0.6)
    .font("Regular")
    .fontSize(10)
    .fillColor(PDF_COLORS.muted)
    .text(`${input.companyName} | ${input.companyDocument}`, { width });
  if (input.parentTitle)
    doc.text(
      `Aditivo ao contrato "${input.parentTitle}"${input.parentHash ? ` (hash ${input.parentHash.slice(0, 16)}…)` : ""}`,
      { width },
    );
  const term = termSentence(input.startsAt, input.endsAt);
  if (term) doc.text(`Vigência ${term}`, { width });
  doc.text(
    `${draft ? "Rascunho atualizado" : input.status === "signed" ? "Assinado" : "Enviado para assinatura"} em ${when(input.date)}`,
    { width },
  );
  doc.moveDown(1.5).fillColor(PDF_COLORS.text);
  const blocks = contractBlocks(input.body);
  const bottom = doc.page.height - 64;
  const body = { width, align: "left" as const, lineGap: 3 };
  const numberWidth = 40;
  /** Keeps a block (plus a heading's first lines) off the page edge. */
  const fit = (height: number, keepWith = 0) => {
    if (height + keepWith < doc.page.height - 118 && doc.y + height + keepWith > bottom) doc.addPage();
  };
  blocks.forEach((block, index) => {
    const left = 54;
    switch (block.type) {
      case "title": {
        doc.font("Bold").fontSize(13);
        fit(doc.heightOfString(block.text, { width }));
        doc.text(block.text, left, doc.y, { width, align: "center", characterSpacing: 0.4 });
        doc.moveDown(1.4);
        break;
      }
      case "heading": {
        doc.font("Bold").fontSize(10.5);
        if (index > 0) doc.moveDown(1.1);
        fit(doc.heightOfString(block.text, { width }), 48);
        doc.text(block.text, left, doc.y, { width, characterSpacing: 0.6 });
        doc.moveDown(0.5);
        break;
      }
      case "party": {
        doc.font("Regular").fontSize(11);
        const line = `${block.label}: ${block.text}`;
        fit(doc.heightOfString(line, body));
        doc.font("Bold").text(`${block.label}: `, left, doc.y, { ...body, continued: true });
        doc.font("Regular").text(block.text, body);
        doc.moveDown(0.5);
        break;
      }
      case "clause": {
        doc.font("Regular").fontSize(11);
        const textWidth = width - numberWidth;
        fit(doc.heightOfString(block.text, { ...body, width: textWidth }));
        const y = doc.y;
        doc.fillColor(PDF_COLORS.muted).text(block.number, left, y, { width: numberWidth, lineGap: 3 });
        doc.fillColor(PDF_COLORS.text).text(block.text, left + numberWidth, y, { ...body, width: textWidth });
        doc.moveDown(0.35);
        break;
      }
      default: {
        doc.font("Regular").fontSize(11);
        fit(doc.heightOfString(block.text, body));
        doc.text(block.text, left, doc.y, body);
        doc.moveDown(0.7);
      }
    }
  });

  if (!draft) {
    doc.addPage();
    doc.font("Bold").fontSize(9).fillColor(PDF_COLORS.muted).text("ASSINATURAS");
    doc.moveDown(1).fontSize(16).fillColor(PDF_COLORS.ink).text("Registro de assinaturas eletrônicas", { width });
    doc
      .moveDown(0.6)
      .font("Regular")
      .fontSize(10)
      .fillColor(PDF_COLORS.muted)
      .text(
        input.superseded
          ? "Esta versão foi substituída por um novo envio e não produz efeitos. As assinaturas abaixo, quando houver, referem-se apenas ao texto desta versão."
          : "Cada parte assinou este documento pelo Console da Anuntech, com identidade confirmada por código enviado ao e-mail ou WhatsApp cadastrado. O hash abaixo identifica exatamente o texto assinado.",
        { width },
      );
    for (const party of ["client", "anuntech"] as const) {
      const line = input.signatures.find((s) => s.party === party);
      doc.moveDown(1.4).font("Bold").fontSize(11).fillColor(PDF_COLORS.ink).text(
        party === "client" ? `Contratante — ${input.companyName}` : "Contratada — Anuntech",
        { width },
      );
      doc.font("Regular").fontSize(10).fillColor(PDF_COLORS.text);
      if (line) {
        doc.text(`${line.name} <${line.email}>`, { width });
        doc.text(`Assinado em ${when(line.signedAt)}`, { width });
        doc.fillColor(PDF_COLORS.muted).text(
          `Identidade: ${line.method === "otp_session" ? "acesso com código de verificação" : line.method}${line.ip ? ` · IP ${line.ip}` : ""}`,
          { width },
        );
      } else {
        doc.fillColor(PDF_COLORS.muted).text(input.superseded ? "Não assinou esta versão." : "Aguardando assinatura.", { width });
      }
    }
    if (input.hash) {
      doc.moveDown(1.6).font("Bold").fontSize(9).fillColor(PDF_COLORS.muted).text("HASH DO DOCUMENTO (SHA-256)");
      doc.font("Mono").fontSize(8.5).fillColor(PDF_COLORS.text).text(input.hash, { width });
      doc.font("Regular").fontSize(9);
      doc
        .moveDown(0.4)
        .fillColor(PDF_COLORS.muted)
        .text(`Identificador do contrato: ${input.id}${input.version ? ` · versão ${input.version}` : ""}`, { width });
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Regular")
      .fontSize(8)
      .fillColor(PDF_COLORS.faint)
      .text(
        `${draft ? "Rascunho" : input.superseded ? "Versão substituída" : input.hash ? `Hash ${input.hash.slice(0, 16)}…` : input.id}`,
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
