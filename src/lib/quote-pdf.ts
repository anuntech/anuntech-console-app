import PDFDocument from "pdfkit";
import path from "node:path";
import { APP_LOCALE, APP_TIME_ZONE } from "./dates";
import { currency, longDateLabel } from "./format";
import { hoursLabel, quoteTotals, taskCode, type QuotePublication, type QuoteStatus } from "./quote-model";

export type QuoteDecisionLine = {
  status: "accepted" | "declined";
  party: "client" | "anuntech";
  name: string;
  email: string | null;
  at: Date;
  ip: string | null;
  note: string | null;
};

const when = (date: Date) =>
  `${new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: APP_TIME_ZONE }).format(date)} (São Paulo)`;
const day = (date: Date) => new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "short", timeZone: APP_TIME_ZONE }).format(date);

const INK = "#10233e";
const TEXT = "#202630";
const MUTED = "#53637a";
const LINE = "#e3e8ef";
const SOFT = "#f3f5f9";

/**
 * The proposal as a PDF, in the layout Kauan writes them: the headline
 * numbers, the financial split, the stack, a phase summary, every task,
 * and the total. A draft is marked as such; a decided proposal carries the
 * answer and the document hash on its last page.
 */
export async function quotePdf(
  input: QuotePublication & {
    id: string;
    status: QuoteStatus;
    date: Date;
    hash: string | null;
    decision: QuoteDecisionLine | null;
    /** A version that was replaced by a later send. */
    superseded?: boolean;
  },
): Promise<Buffer> {
  const fonts = path.join(process.cwd(), "assets/fonts");
  const draft = input.status === "draft";
  const totals = quoteTotals(input);
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 54, bottom: 64, left: 54, right: 54 },
    bufferPages: true,
    font: path.join(fonts, "NotoSans-Regular.ttf"),
    info: {
      Title: `Orçamento ${input.number} — ${input.title}`,
      Author: "Anuntech",
      Subject: input.superseded
        ? "Versão substituída de orçamento"
        : draft
          ? "Rascunho de orçamento"
          : `Orçamento ${input.number}`,
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
  const left = 54;
  const width = doc.page.width - 108;
  const bottom = doc.page.height - 64;
  /** Starts a new page when a block of this height would not fit. */
  const fit = (height: number) => {
    if (doc.y + height > bottom) doc.addPage();
  };

  /* ---------- head ---------- */
  const marker = input.superseded
    ? `VERSÃO ${input.version} SUBSTITUÍDA, SEM EFEITO`
    : draft
      ? "RASCUNHO — SEM VALIDADE"
      : input.status === "accepted"
        ? "ACEITO PELO CLIENTE"
        : input.status === "declined"
          ? "RECUSADO"
          : input.status === "cancelled"
            ? "CANCELADO"
            : "AGUARDANDO RESPOSTA";
  doc.font("Bold").fontSize(9).fillColor(MUTED).text("BACKLOG TÉCNICO · PROPOSTA COMERCIAL", left, doc.y, { width: width - 200, continued: false });
  doc.text(marker, left + width - 200, doc.y - doc.currentLineHeight(), { width: 200, align: "right" });
  doc.moveDown(1).fontSize(20).fillColor(INK).text(input.title, left, doc.y, { width });
  doc
    .moveDown(0.5)
    .font("Regular")
    .fontSize(10)
    .fillColor(MUTED)
    .text(`Orçamento nº ${input.number} · ${input.companyName} | ${input.companyDocument}`, { width });
  if (input.summary) doc.moveDown(0.8).fontSize(11).fillColor(TEXT).text(input.summary, { width, lineGap: 2 });

  /* ---------- headline numbers ---------- */
  const box = (x: number, y: number, w: number, value: string, label: string, valueSize = 14) => {
    doc.roundedRect(x, y, w, 52, 6).fill(SOFT);
    doc.font("Bold").fontSize(valueSize).fillColor(INK).text(value, x + 12, y + 10, { width: w - 24, lineBreak: false });
    doc.font("Regular").fontSize(8.5).fillColor(MUTED).text(label, x + 12, y + 32, { width: w - 24, lineBreak: false });
  };
  const stats = [
    [hoursLabel(totals.hoursMin, totals.hoursMax), "Esforço estimado"],
    [`${currency(input.hourlyRateCents)}/h`, "Taxa/hora"],
    [String(totals.phases), totals.phases === 1 ? "Fase" : "Fases"],
    [String(totals.tasks), totals.tasks === 1 ? "Tarefa" : "Tarefas"],
  ];
  doc.moveDown(1.2);
  fit(52);
  let y = doc.y;
  const statWidth = (width - 24) / 4;
  stats.forEach(([value, label], i) => box(left + i * (statWidth + 8), y, statWidth, value, label));
  doc.y = y + 52;

  doc.moveDown(1.4);
  fit(80);
  doc.font("Bold").fontSize(9).fillColor(MUTED).text("PROPOSTA FINANCEIRA", left, doc.y, { width });
  doc.moveDown(0.6);
  y = doc.y;
  const finWidth = (width - 16) / 3;
  [
    [currency(totals.totalCents), "Valor total"],
    [currency(totals.upfrontCents), `Entrada (${input.upfrontPercent}%)`],
    [currency(totals.balanceCents), `Saldo (${100 - input.upfrontPercent}%)`],
  ].forEach(([value, label], i) => box(left + i * (finWidth + 8), y, finWidth, value, label, 15));
  doc.y = y + 52;

  /* ---------- stack ---------- */
  if (input.stack.length) {
    doc.moveDown(1.4);
    fit(40);
    doc.font("Bold").fontSize(9).fillColor(MUTED).text("STACK", left, doc.y, { width });
    doc.moveDown(0.5).font("Regular").fontSize(10.5).fillColor(TEXT).text(input.stack.join("  ·  "), { width, lineGap: 2 });
  }

  /* ---------- phase summary ---------- */
  if (input.phases.length) {
    doc.moveDown(1.4);
    fit(60);
    doc.font("Bold").fontSize(9).fillColor(MUTED).text("RESUMO POR FASE", left, doc.y, { width });
    doc.moveDown(0.6);
    const col = { tasks: 70, hours: 96 };
    const nameWidth = width - col.tasks - col.hours;
    const row = (name: string, tasks: string, hours: string, bold = false, last = false) => {
      doc.font(bold ? "Bold" : "Regular").fontSize(10);
      const height = Math.max(doc.heightOfString(name, { width: nameWidth - 12 }), 14) + 10;
      fit(height);
      const top = doc.y;
      doc.fillColor(bold ? INK : TEXT).text(name, left, top + 5, { width: nameWidth - 12 });
      doc.text(tasks, left + nameWidth, top + 5, { width: col.tasks, align: "right" });
      doc.text(hours, left + nameWidth + col.tasks, top + 5, { width: col.hours, align: "right" });
      doc.y = top + height;
      if (!last) doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.5).strokeColor(LINE).stroke();
    };
    doc.font("Bold").fontSize(8.5).fillColor(MUTED);
    const head = doc.y;
    doc.text("FASE", left, head, { width: nameWidth });
    doc.text("TAREFAS", left + nameWidth, head, { width: col.tasks, align: "right" });
    doc.text("HH ESTIMADO", left + nameWidth + col.tasks, head, { width: col.hours, align: "right" });
    doc.y = head + 14;
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.8).strokeColor(INK).stroke();
    input.phases.forEach((phase) =>
      row(phase.name, String(phase.tasks.length), hoursLabel(phase.hoursMin, phase.hoursMax)),
    );
    row("Total", String(totals.tasks), hoursLabel(totals.hoursMin, totals.hoursMax), true, true);
  }

  /* ---------- tasks ---------- */
  if (input.phases.some((phase) => phase.tasks.length || phase.description)) {
    doc.moveDown(1.6);
    fit(60);
    doc.font("Bold").fontSize(9).fillColor(MUTED).text("TAREFAS DETALHADAS", left, doc.y, { width });
    input.phases.forEach((phase, phaseIndex) => {
      doc.moveDown(phaseIndex === 0 ? 0.8 : 1.3);
      fit(48);
      doc.font("Bold").fontSize(11.5).fillColor(INK).text(phase.name, left, doc.y, { width: width - 150, continued: false });
      doc
        .font("Regular")
        .fontSize(9)
        .fillColor(MUTED)
        .text(
          `${phase.tasks.length} ${phase.tasks.length === 1 ? "tarefa" : "tarefas"} · ${hoursLabel(phase.hoursMin, phase.hoursMax)}`,
          left + width - 150,
          doc.y - doc.currentLineHeight() - 2,
          { width: 150, align: "right" },
        );
      if (phase.description) doc.moveDown(0.2).fontSize(10).fillColor(MUTED).text(phase.description, left, doc.y, { width, lineGap: 1.5 });
      phase.tasks.forEach((task, taskIndex) => {
        doc.font("Bold").fontSize(10);
        const titleHeight = doc.heightOfString(task.title, { width: width - 48 });
        doc.font("Regular").fontSize(9.5);
        const descHeight = task.description ? doc.heightOfString(task.description, { width: width - 48, lineGap: 1 }) : 0;
        doc.moveDown(0.55);
        fit(titleHeight + descHeight + 6);
        const top = doc.y;
        doc.font("Bold").fontSize(8.5).fillColor(MUTED).text(taskCode(phaseIndex, taskIndex), left, top + 1.5, { width: 44 });
        doc.font("Bold").fontSize(10).fillColor(TEXT).text(task.title, left + 48, top, { width: width - 48 });
        if (task.description)
          doc.font("Regular").fontSize(9.5).fillColor(MUTED).text(task.description, left + 48, doc.y, { width: width - 48, lineGap: 1 });
      });
      doc.moveDown(0.5);
      fit(16);
      doc
        .font("Regular")
        .fontSize(9)
        .fillColor(MUTED)
        .text(`Subtotal ${phase.name}: ${hoursLabel(phase.hoursMin, phase.hoursMax)}`, left, doc.y, { width, align: "right" });
    });
  }

  /* ---------- total ---------- */
  doc.moveDown(1.6);
  fit(70);
  y = doc.y;
  doc.roundedRect(left, y, width, 64, 8).fill(INK);
  doc.font("Regular").fontSize(8.5).fillColor("#c8d2e0").text("TOTAL ESTIMADO DO PROJETO", left + 16, y + 12, { width: width / 2 });
  doc.font("Bold").fontSize(16).fillColor("#ffffff").text(hoursLabel(totals.hoursMin, totals.hoursMax), left + 16, y + 28, { width: width / 2 });
  doc
    .font("Regular")
    .fontSize(8.5)
    .fillColor("#c8d2e0")
    .text(`${totals.hoursMax}h × ${currency(input.hourlyRateCents)}/h`, left + width / 2, y + 12, { width: width / 2 - 16, align: "right" });
  doc.font("Bold").fontSize(18).fillColor("#ffffff").text(currency(totals.totalCents), left + width / 2, y + 26, { width: width / 2 - 16, align: "right" });
  doc.y = y + 64;

  doc.moveDown(1);
  doc
    .font("Regular")
    .fontSize(9)
    .fillColor(MUTED)
    .text(
      `Proposta preparada pela Anuntech · ${day(input.date)}${input.validUntil ? ` · válida até ${longDateLabel(input.validUntil)}` : ""}`,
      left,
      doc.y,
      { width },
    );
  if (input.notes) doc.moveDown(0.3).text(input.notes, { width, lineGap: 1.5 });

  /* ---------- answer and hash ---------- */
  if (!draft) {
    doc.moveDown(1.6);
    fit(120);
    doc.font("Bold").fontSize(9).fillColor(MUTED).text("REGISTRO", left, doc.y, { width });
    doc.moveDown(0.5).font("Regular").fontSize(10).fillColor(TEXT);
    if (input.decision) {
      const verb = input.decision.status === "accepted" ? "Aceito" : "Recusado";
      const by =
        input.decision.party === "client"
          ? `por ${input.decision.name}${input.decision.email ? ` <${input.decision.email}>` : ""}, por ${input.companyName}`
          : `registrado pela Anuntech (${input.decision.name}) a pedido do cliente`;
      doc.text(`${verb} ${by} em ${when(input.decision.at)}.`, { width });
      if (input.decision.party === "client")
        doc
          .fillColor(MUTED)
          .text(
            `Identidade confirmada pelo acesso ao Anuntech Console (código enviado ao e-mail ou WhatsApp cadastrado)${input.decision.ip ? ` · IP ${input.decision.ip}` : ""}.`,
            { width },
          );
      if (input.decision.note) doc.fillColor(TEXT).text(`Observação: ${input.decision.note}`, { width });
    } else {
      doc.fillColor(MUTED).text(
        input.superseded
          ? "Esta versão foi substituída por um novo envio e não produz efeitos."
          : input.status === "cancelled"
            ? "Orçamento cancelado pela Anuntech."
            : `Enviado em ${when(input.date)}. Aguardando a resposta do cliente pelo Console.`,
        { width },
      );
    }
    if (input.hash) {
      doc.moveDown(0.8).font("Bold").fontSize(9).fillColor(MUTED).text("HASH DO DOCUMENTO (SHA-256)");
      doc.font("Regular").fontSize(9).fillColor(TEXT).text(input.hash, { width });
      doc.moveDown(0.3).fillColor(MUTED).text(`Identificador: ${input.id} · versão ${input.version}`, { width });
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
        draft ? "Rascunho" : input.superseded ? "Versão substituída" : input.hash ? `Orçamento ${input.number} · hash ${input.hash.slice(0, 16)}…` : `Orçamento ${input.number}`,
        left,
        doc.page.height - 36,
        { lineBreak: false },
      );
    doc.text(`${i + 1} / ${range.count}`, doc.page.width - 90, doc.page.height - 36, { lineBreak: false });
  }
  doc.end();
  return result;
}
