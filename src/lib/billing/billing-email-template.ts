import { currency, dateLabel } from "../format";
import { daysOverdue, type BillingNoticeKind } from "./billing-notice-rules";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function billingEmailTemplate(data: {
  name: string;
  description: string;
  amountCents: number;
  dueDate: string;
  /** The boleto's date when it differs from the due date (a debt brought in past due). */
  payUntil?: string;
  url: string;
  kind?: BillingNoticeKind;
  today?: string;
  issuerDocument?: string;
}) {
  const amount = currency(data.amountCents),
    due = dateLabel(data.dueDate),
    payUntil = data.payUntil && data.payUntil !== data.dueDate ? dateLabel(data.payUntil) : null,
    kind = data.kind || "initial";
  const overdue = kind.startsWith("overdue_");
  const heading = overdue
    ? "Sua fatura está em aberto"
    : kind === "due"
      ? "Sua fatura vence hoje"
      : "Sua fatura está disponível";
  const subject = `Anuntech | ${overdue ? "Fatura em aberto" : kind === "due" ? "Vence hoje" : "Nova fatura"} · ${data.description}`;
  const message = overdue
    ? `A fatura de ${data.description} está em aberto há ${daysOverdue(data.dueDate, data.today!)} dias.`
    : kind === "due"
      ? `A fatura de ${data.description} vence hoje.`
      : `A fatura de ${data.description} já está disponível.`;
  const closing = overdue
    ? "Você pode pagar pelo link abaixo. Se precisar de outra data, fale com a nossa equipe."
    : kind === "due"
      ? "Pague por Pix ou boleto pelo link abaixo. Se já pagou, pode ignorar esta mensagem."
      : "Veja os detalhes e pague por Pix ou boleto.";
  const amountLabel = overdue ? "Valor atualizado" : "Valor da fatura";
  const domain = new URL(data.url).hostname;
  const logo = new URL("/brand/logo/lockup-preto.png", data.url).href;
  const issuer = /^\d{14}$/.test(data.issuerDocument || "")
    ? data.issuerDocument!.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5",
      )
    : null;
  const footer = `Anuntech${issuer ? ` · CNPJ ${issuer}` : ""}`;
  const supportUrl = "https://wa.me/551151073435";
  const text = `Olá, ${data.name}.\n\n${message}\n\nProduto ou serviço: ${data.description}\n${amountLabel}: ${amount}\nVencimento: ${due}${payUntil ? ` (em atraso)\nPague até: ${payUntil} com este boleto ou Pix` : ""}\n\n${closing}\n\nPagar agora: ${data.url}\n\nO link abre a fatura no Console da Anuntech (${domain}), sem precisar entrar.\n\nPrecisa de ajuda? Fale com nossa equipe: ${supportUrl}\n\n${footer}`;
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f6;color:#0d0d0d;font-family:Geist,Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(data.description)} · ${escape(amount)} · Vencimento ${escape(due)}. Pague por Pix ou boleto no Console da Anuntech.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px">
<tr><td style="background:#fff;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:32px 32px 0"><img src="${escape(logo)}" width="132" height="29" alt="Anuntech" style="display:block;border:0"></td></tr>
<tr><td style="padding:32px 32px 28px">
<p style="margin:0 0 12px;font-size:13px;line-height:20px;color:#5b43f0;font-weight:600">${overdue ? "Lembrete de pagamento" : kind === "due" ? "Vencimento hoje" : "Nova fatura"}</p>
<h1 style="margin:0 0 20px;font-size:26px;line-height:32px;font-weight:500;letter-spacing:-.5px">${escape(heading)}</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:24px">Olá, ${escape(data.name)}.</p>
<p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#4a4a4a">${escape(message)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;border-radius:12px">
<tr><td style="padding:20px 22px 16px"><p style="margin:0 0 4px;font-size:13px;line-height:20px;color:#6b6b6b">Produto ou serviço</p><p style="margin:0;font-size:17px;line-height:24px;font-weight:600">${escape(data.description)}</p></td></tr>
<tr><td style="padding:0 22px"><div style="border-top:1px solid #e5e5e5;height:1px;line-height:1px">&nbsp;</div></td></tr>
<tr><td style="padding:16px 22px 22px"><p style="margin:0 0 4px;font-size:13px;line-height:20px;color:#6b6b6b">${amountLabel}</p><p style="margin:0 0 12px;font-size:32px;line-height:38px;letter-spacing:-1px;font-weight:600">${escape(amount)}</p><p style="margin:0;font-size:14px;line-height:22px;color:#4a4a4a">Vencimento: <strong style="color:#0d0d0d;font-weight:600">${escape(due)}</strong>${payUntil ? ` · <span style="color:#b42318">em atraso</span><br>Pague até: <strong style="color:#0d0d0d;font-weight:600">${escape(payUntil)}</strong> com este boleto ou Pix` : ""}</p></td></tr>
</table>
<p style="margin:24px 0;font-size:15px;line-height:24px;color:#4a4a4a">${escape(closing)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#6e56ff" style="border-radius:999px"><a href="${escape(data.url)}" style="display:block;border:1px solid #6e56ff;border-radius:999px;padding:15px 20px;color:#fff;text-decoration:none;font-size:16px;line-height:22px;font-weight:600">Pagar agora</a></td></tr></table>
<p style="margin:12px 0 0;text-align:center;font-size:13px;line-height:20px;color:#6b6b6b">Pix ou boleto, sem precisar entrar</p>
</td></tr>
<tr><td style="padding:22px 32px;border-top:1px solid #e5e5e5">
<p style="margin:0 0 6px;font-size:14px;line-height:22px;font-weight:600">Cobrança enviada pela Anuntech.</p>
<p style="margin:0;font-size:13px;line-height:21px;color:#6b6b6b">O botão abre sua fatura em <strong style="color:#0d0d0d;font-weight:600">${escape(domain)}</strong>. Precisa de ajuda? <a href="${supportUrl}" style="color:#5b43f0;text-decoration:underline">Fale com a nossa equipe</a>.</p>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:24px 20px"><p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#6b6b6b">${escape(footer)}</p><p style="margin:0 0 12px;font-size:12px;line-height:20px;color:#6b6b6b">Mensagem automática sobre os produtos e serviços da sua empresa com a Anuntech.</p><p style="margin:0;font-size:11px;line-height:18px;color:#8a8a8a;word-break:break-all">Se o botão não abrir, copie este endereço:<br><a href="${escape(data.url)}" style="color:#6b6b6b;text-decoration:underline;word-break:break-all">${escape(data.url)}</a></p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
export function billingEmailFrom(configured: string) {
  const email = configured.match(/<([^>]+)>/)?.[1] || configured.trim();
  return `Anuntech · Financeiro <${email}>`;
}
