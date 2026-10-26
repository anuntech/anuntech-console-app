/**
 * Every e-mail the Console sends, in the brand's layout (the same as the invoice e-mail in
 * lib/billing/billing-email-template.ts): logo, an optional eyebrow in violet, the title, the message,
 * the details in a grey box, one violet pill button and a footer that says why the message came.
 *
 * The plain text stays the source: each sender keeps writing its message as text (the text part of the
 * e-mail, read by clients without HTML) and `brandEmailHtml` lays the same words out:
 * - paragraphs split on blank lines; a paragraph of "Rótulo: valor" lines becomes the details box;
 *   a paragraph of "- item" lines becomes a list;
 * - the first link that ends a paragraph ("Abrir no Console: https://…") becomes the button; other
 *   links stay links;
 * - the closing signature ("Anuntech", "Console da Anuntech") moves to the footer.
 */
const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const URL_RE = /https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?]/g;
const SIGNATURE = /^(?:Equipe\s+)?(?:Console da\s+)?Anuntech\.?$/i;
const FACT = /^([^:\n]{1,40}):\s+(.+)$/;
/** "Rótulo: valor", where the label is words, not a link or a sentence. */
const isFact = (line: string) => {
  const match = FACT.exec(line);
  return !!match && !/https?:/.test(match[1]) && match[1].split(" ").length <= 5;
};
/** A button reads best short; a longer lead stays as a sentence above a generic button. */
const BUTTON_MAX = 34;

export type BrandEmailInput = {
  subject: string;
  text: string;
  /** Any Console URL: the logo is served from its origin. */
  url?: string;
  /** A short line above the title, in violet ("Novo orçamento"). */
  eyebrow?: string;
  /** Defaults to the subject. */
  title?: string;
  /** An access code shown large instead of the line that carries it. */
  code?: string;
  /** Clients see who the message is from; the team sees an internal notice. */
  audience?: "client" | "staff";
  /** A button for a link the text gives mid-sentence; it goes after the paragraph that has the link. */
  action?: { label: string; url: string };
};

const consoleOrigin = (url?: string) => {
  try {
    return new URL(url || process.env.BETTER_AUTH_URL || "https://console.anuntech.com").origin;
  } catch {
    return "https://console.anuntech.com";
  }
};

const linked = (value: string) => {
  let out = "";
  let last = 0;
  for (const match of value.matchAll(URL_RE)) {
    out += escape(value.slice(last, match.index));
    out += `<a href="${escape(match[0])}" style="color:#5b43f0;text-decoration:underline;word-break:break-all">${escape(match[0])}</a>`;
    last = match.index! + match[0].length;
  }
  return out + escape(value.slice(last));
};

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "facts"; rows: [string, string][] }
  | { kind: "list"; items: string[] }
  | { kind: "code"; code: string }
  | { kind: "button"; label: string; url: string };

/** The text's blocks, in order, with the button and the code pulled out. */
export function emailBlocks(text: string, code?: string) {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  while (paragraphs.length && SIGNATURE.test(paragraphs.at(-1)!)) paragraphs.pop();
  const blocks: Block[] = [];
  let button: { label: string; url: string } | null = null;
  for (const paragraph of paragraphs) {
    const lines = paragraph.split("\n").map((l) => l.trim());
    if (code && paragraph.includes(code)) {
      const rest = lines.filter((l) => !l.includes(code));
      const lead = lines.find((l) => l.includes(code))!.replace(code, "").replace(/[:\s]+$/, "");
      if (lead) blocks.push({ kind: "p", lines: [`${lead}:`] });
      blocks.push({ kind: "code", code });
      if (rest.length) blocks.push({ kind: "p", lines: rest });
      continue;
    }
    const item = (l: string) => /^[-•]\s+/.test(l) || /^… e mais/.test(l);
    // A list, or a heading line followed by its list ("Faturas em atraso:").
    const listFrom = lines.every(item) ? 0 : lines.length > 1 && !item(lines[0]) && lines.slice(1).every(item) ? 1 : -1;
    if (listFrom >= 0) {
      if (listFrom) blocks.push({ kind: "p", lines: [lines[0]] });
      blocks.push({ kind: "list", items: lines.slice(listFrom).map((l) => l.replace(/^[-•]\s+/, "")) });
      continue;
    }
    // A paragraph that ends with a link: the first becomes the button.
    const tail = lines.at(-1)!.match(/^(.*?)[:\s]+(https?:\/\/\S+)$/);
    if (!button && tail) {
      const lead = tail[1].trim();
      const before = lines.slice(0, -1);
      if (before.length && before.every(isFact)) blocks.push({ kind: "facts", rows: before.map((l) => FACT.exec(l)!.slice(1, 3) as [string, string]) });
      else if (before.length) blocks.push({ kind: "p", lines: before });
      const short = lead.length > 0 && lead.length <= BUTTON_MAX;
      if (!short && lead) blocks.push({ kind: "p", lines: [`${lead}.`.replace(/\.\.$/, ".")] });
      button = { label: short ? lead : "Abrir no Console", url: tail[2] };
      blocks.push({ kind: "button", ...button });
      continue;
    }
    if (lines.length > 1 && lines.every(isFact)) {
      blocks.push({ kind: "facts", rows: lines.map((l) => FACT.exec(l)!.slice(1, 3) as [string, string]) });
      continue;
    }
    blocks.push({ kind: "p", lines });
  }
  return { blocks, button };
}

const P = "margin:0 0 16px;font-size:16px;line-height:24px;color:#4a4a4a";

function blockHtml(block: Block, first: boolean) {
  switch (block.kind) {
    case "p":
      return `<p style="${first ? P.replace("#4a4a4a", "#0d0d0d") : P}">${block.lines.map(linked).join("<br>")}</p>`;
    case "list":
      return `<ul style="margin:0 0 16px;padding:0 0 0 20px;font-size:15px;line-height:24px;color:#4a4a4a">${block.items
        .map((item) => `<li style="margin:0 0 6px">${linked(item)}</li>`)
        .join("")}</ul>`;
    case "facts":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;background:#f6f6f6;border-radius:12px">${block.rows
        .map(
          ([label, value], i) =>
            `<tr><td style="padding:${i ? "0" : "18px"} 22px ${i === block.rows.length - 1 ? "18px" : "12px"}"><p style="margin:0 0 2px;font-size:13px;line-height:20px;color:#6b6b6b">${escape(label)}</p><p style="margin:0;font-size:16px;line-height:24px;font-weight:600;color:#0d0d0d">${linked(value)}</p></td></tr>`,
        )
        .join("")}</table>`;
    case "code":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 24px;background:#f6f6f6;border-radius:12px"><tr><td align="center" style="padding:22px"><p style="margin:0;font-size:36px;line-height:44px;letter-spacing:10px;font-weight:600;color:#0d0d0d;font-family:'Geist Mono',ui-monospace,Menlo,Consolas,monospace">${escape(block.code)}</p></td></tr></table>`;
    case "button":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr><td align="center" bgcolor="#6e56ff" style="border-radius:999px"><a href="${escape(block.url)}" style="display:block;border:1px solid #6e56ff;border-radius:999px;padding:15px 20px;color:#ffffff;text-decoration:none;font-size:16px;line-height:22px;font-weight:600">${escape(block.label)}</a></td></tr></table>`;
  }
}

/** The text of the e-mail, laid out in the brand's HTML. */
export function brandEmailHtml(input: BrandEmailInput) {
  const origin = consoleOrigin(input.url);
  const parsed = emailBlocks(input.text, input.code);
  const blocks = parsed.blocks;
  let button = parsed.button;
  if (!button && input.action) {
    button = input.action;
    const at = blocks.findIndex((b) => b.kind === "p" && b.lines.some((l) => l.includes(input.action!.url)));
    blocks.splice(at < 0 ? blocks.length : at + 1, 0, { kind: "button", ...input.action });
  }
  const title = input.title ?? input.subject;
  // The title says it already: the text's opening line ("Nova resposta") does not repeat under it.
  const opening = blocks[0];
  const same = (a: string, b: string) => a.replace(/[.!:]+$/, "").trim().toLowerCase() === b.replace(/[.!:]+$/, "").trim().toLowerCase();
  if (opening?.kind === "p" && same(opening.lines[0], title)) {
    opening.lines.shift();
    if (!opening.lines.length) blocks.shift();
  }
  const staff = input.audience === "staff";
  const preheader = blocks.find((b) => b.kind === "p")?.lines.join(" ") ?? title;
  const body = blocks.map((b, i) => blockHtml(b, i === 0)).join("\n");
  const domain = new URL(origin).hostname;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f6;color:#0d0d0d;font-family:Geist,Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(preheader.slice(0, 160))}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px">
<tr><td style="background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:32px 32px 0"><img src="${escape(`${origin}/brand/logo/lockup-preto.png`)}" width="132" height="29" alt="Anuntech" style="display:block;border:0"></td></tr>
<tr><td style="padding:32px 32px 12px">
${input.eyebrow ? `<p style="margin:0 0 12px;font-size:13px;line-height:20px;color:#5b43f0;font-weight:600">${escape(input.eyebrow)}</p>` : ""}
<h1 style="margin:0 0 20px;font-size:26px;line-height:32px;font-weight:500;letter-spacing:-.5px;color:#0d0d0d">${escape(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:22px 32px;border-top:1px solid #e5e5e5">
<p style="margin:0;font-size:13px;line-height:21px;color:#6b6b6b">${
    staff
      ? "Aviso interno do Console da Anuntech."
      : `Enviado pelo Console da Anuntech (<strong style="color:#0d0d0d;font-weight:600">${escape(domain)}</strong>). Precisa de ajuda? <a href="https://wa.me/551151073435" style="color:#5b43f0;text-decoration:underline">Fale com a nossa equipe</a>.`
  }</p>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:24px 20px"><p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#6b6b6b">Anuntech</p>${
    button
      ? `<p style="margin:0;font-size:11px;line-height:18px;color:#8a8a8a;word-break:break-all">Se o botão não abrir, copie este endereço:<br><a href="${escape(button.url)}" style="color:#6b6b6b;text-decoration:underline;word-break:break-all">${escape(button.url)}</a></p>`
      : ""
  }</td></tr>
</table></td></tr></table></body></html>`;
}
