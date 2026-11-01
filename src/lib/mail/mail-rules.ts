/*
 * E-mail (phase 1): the pure rules of the team's webmail. No database, no
 * Next, no network: the page, the server actions, the routes and the tests
 * read the same answers. Who opens which mailbox, how folders are named and
 * ordered, how addresses are read, what a reply or a forward starts with.
 */

/** Domains whose mailboxes the Console opens. Shared mailboxes and clients come in phase 2. */
export const MAIL_DOMAINS = ["anuntech.com"] as const;

/** Messages per page in a folder. */
export const MAIL_PAGE_SIZE = 50;
/** One attachment per upload request: under Vercel's 4.5 MB request body. */
export const MAIL_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
/** Every attachment of one message, uploaded and forwarded together. */
export const MAIL_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** Attachments of one message. */
export const MAIL_MAX_ATTACHMENTS = 20;
/** Recipients of one message, To, Cc and Bcc together. */
export const MAIL_MAX_RECIPIENTS = 100;
/** Messages sent per person per rolling hour. */
export const MAIL_SENDS_PER_HOUR = 200;
/** Body text of a message written in the Console. */
export const MAIL_BODY_MAX = 200_000;

const normalize = (email: string) => email.trim().toLowerCase();

/** The domain of an address, lower case; "" when it has none. */
export function domainOf(address: string) {
  const at = address.lastIndexOf("@");
  return at > 0 ? normalize(address.slice(at + 1)) : "";
}

/**
 * The mailboxes a person opens: only the Anuntech team, and only its own
 * verified addresses (the primary e-mail and the verified extra ones) on a
 * domain the Console serves. Sorted, deduplicated, lower case.
 */
export function mailboxesFor(person: { admin: boolean; emails: readonly string[] }) {
  if (!person.admin) return [];
  const domains: readonly string[] = MAIL_DOMAINS;
  return [...new Set(person.emails.map(normalize))]
    .filter((email) => /^[^\s@]+@[^\s@]+$/.test(email) && domains.includes(domainOf(email)))
    .sort();
}

/** Whether `address` is one of the person's mailboxes. The server asks this on every read, write and download. */
export function canOpenMailbox(person: { admin: boolean; emails: readonly string[] }, address: string) {
  return mailboxesFor(person).includes(normalize(address));
}

/** JMAP ids (RFC 8620 §1.2): 1 to 255 URL-safe characters. */
export const JMAP_ID = /^[A-Za-z0-9_-]{1,255}$/;
export const isJmapId = (value: unknown): value is string => typeof value === "string" && JMAP_ID.test(value);

// Folders ---------------------------------------------------------------

/** The special folders first, in this order, with their Portuguese names. */
export const FOLDER_ROLES = ["inbox", "drafts", "sent", "archive", "junk", "trash"] as const;
export type FolderRole = (typeof FOLDER_ROLES)[number];
export const FOLDER_NAMES: Record<FolderRole, string> = {
  inbox: "Entrada",
  drafts: "Rascunhos",
  sent: "Enviados",
  archive: "Arquivo",
  junk: "Spam",
  trash: "Lixeira",
};

export type FolderLike = { id: string; name: string; role?: string | null; sortOrder?: number | null };

/** What a folder is called on screen: the role's name, or the folder's own. */
export function folderName(folder: FolderLike) {
  const role = folder.role as FolderRole | null | undefined;
  return role && role in FOLDER_NAMES ? FOLDER_NAMES[role] : folder.name;
}

/** Special folders in FOLDER_ROLES order, then the rest by sortOrder and name. */
export function sortFolders<T extends FolderLike>(folders: T[]): T[] {
  const rank = (folder: T) => {
    const index = (FOLDER_ROLES as readonly string[]).indexOf(folder.role ?? "");
    return index === -1 ? FOLDER_ROLES.length : index;
  };
  return [...folders].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      folderName(a).localeCompare(folderName(b), "pt-BR"),
  );
}

/** Where a move sends a message. "inbox" takes it back from Spam or the Lixeira. */
export const MOVE_TARGETS = ["inbox", "archive", "junk", "trash"] as const;
export type MoveTarget = (typeof MOVE_TARGETS)[number];
export const MOVED_TO: Record<MoveTarget, string> = {
  inbox: "Mensagem movida para a Entrada.",
  archive: "Mensagem arquivada.",
  junk: "Mensagem movida para o Spam.",
  trash: "Mensagem movida para a Lixeira.",
};

// The address bar --------------------------------------------------------

export type MailQuery = { caixa: string; pasta: string; msg: string; q: string; pagina: number };
type Params = Record<string, string | string[] | undefined>;
const one = (params: Params, key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");

/** The page's state from its URL: mailbox, folder, open message, search and page. */
export function mailQuery(params: Params): MailQuery {
  const page = Number(one(params, "pagina"));
  return {
    caixa: normalize(one(params, "caixa")).slice(0, 254),
    pasta: isJmapId(one(params, "pasta")) ? one(params, "pasta") : "",
    msg: isJmapId(one(params, "msg")) ? one(params, "msg") : "",
    q: one(params, "q").trim().slice(0, 160),
    pagina: Number.isSafeInteger(page) && page > 1 ? Math.min(page, 10_000) : 1,
  };
}

/** `/email?…` for a state, leaving defaults out. `caixa` stays out when the person has a single mailbox. */
export function mailHref(query: Partial<MailQuery>, { single = false } = {}) {
  const params = new URLSearchParams();
  if (query.caixa && !single) params.set("caixa", query.caixa);
  if (query.pasta) params.set("pasta", query.pasta);
  if (query.q) params.set("q", query.q);
  if (query.pagina && query.pagina > 1) params.set("pagina", String(query.pagina));
  if (query.msg) params.set("msg", query.msg);
  const text = params.toString();
  return text ? `/email?${text}` : "/email";
}

// Addresses ---------------------------------------------------------------

export type Address = { name?: string | null; email: string };

const EMAIL = /^[^\s@<>(),;:"[\]\\]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export const isEmailAddress = (value: string) => value.length <= 254 && EMAIL.test(value);

/**
 * A recipients field: addresses separated by commas or semicolons, each
 * either `email` or `Name <email>`. Returns the addresses, or the first piece
 * that is not one (to point at it in the error).
 */
export function parseAddressList(text: string): { ok: true; addresses: Address[] } | { ok: false; invalid: string } {
  const addresses: Address[] = [];
  const seen = new Set<string>();
  // Commas inside a quoted name ("Silva, Ana" <ana@x.com>) do not split.
  const pieces = text.match(/(?:"[^"]*"|[^,;])+/g) ?? [];
  for (const raw of pieces) {
    const piece = raw.trim();
    if (!piece) continue;
    const named = /^([\s\S]*)<([^<>]+)>$/.exec(piece);
    const email = (named ? named[2] : piece).trim();
    // No line breaks or control characters in a display name: they belong to no header.
    const name = named ? named[1].replace(/[\u0000-\u001f\u007f]+/g, " ").trim().replace(/^"(.*)"$/, "$1").trim() : "";
    if (!isEmailAddress(email)) return { ok: false, invalid: piece.slice(0, 80) };
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(name ? { name: name.slice(0, 120), email } : { email });
  }
  return { ok: true, addresses };
}

/** `Name <email>`, or the bare address, for a recipients field. */
export function formatAddress(address: Address) {
  const name = address.name?.trim();
  if (!name) return address.email;
  return /[,;"<>]/.test(name) ? `"${name.replace(/"/g, "")}" <${address.email}>` : `${name} <${address.email}>`;
}
export const formatAddressList = (list: readonly Address[] | null | undefined) => (list ?? []).map(formatAddress).join(", ");

/** Who a message is from, as a list shows it: the name, or the address. */
export const senderLabel = (list: readonly Address[] | null | undefined) =>
  list?.[0] ? list[0].name?.trim() || list[0].email : "(sem remetente)";

// Replies and forwards --------------------------------------------------------

export type ComposeMode = "new" | "reply" | "replyAll" | "forward";

/** "Re: " or "Enc: " once, whatever the other client wrote before ("RE:", "Fwd:", "ENC:"). */
export function prefixedSubject(subject: string | null | undefined, mode: "reply" | "forward") {
  const base = (subject ?? "").trim();
  const pattern = mode === "reply" ? /^(re|res|resp)\s*:/i : /^(enc|fwd?|tr)\s*:/i;
  if (pattern.test(base)) return base;
  return `${mode === "reply" ? "Re" : "Enc"}: ${base}`.trim();
}

export type OriginalMessage = {
  from?: Address[] | null;
  to?: Address[] | null;
  cc?: Address[] | null;
  replyTo?: Address[] | null;
  subject?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  messageId?: string[] | null;
  references?: string[] | null;
  /** The original's text, for the quote. */
  text: string;
};

export type ComposeDraft = {
  mode: ComposeMode;
  to: string;
  cc: string;
  subject: string;
  body: string;
  inReplyTo: string[];
  references: string[];
};

const quoteDate = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
        .format(new Date(iso))
        .replace(", ", " às ")
    : "";

/** "Em 31/10/2026 às 14:05, Ana escreveu:" and the original, each line quoted with "> ". */
export function quoteFor(original: OriginalMessage) {
  const who = senderLabel(original.from);
  const when = quoteDate(original.sentAt ?? original.receivedAt);
  const lines = original.text.replace(/\r\n?/g, "\n").trimEnd().split("\n");
  return `${when ? `Em ${when}, ` : ""}${who} escreveu:\n${lines.map((line) => (line ? `> ${line}` : ">")).join("\n")}`;
}

function forwardHeader(original: OriginalMessage) {
  return [
    "---------- Mensagem encaminhada ----------",
    `De: ${formatAddressList(original.from)}`,
    `Data: ${quoteDate(original.sentAt ?? original.receivedAt)}`,
    `Assunto: ${original.subject ?? ""}`,
    `Para: ${formatAddressList(original.to)}`,
    ...(original.cc?.length ? [`Cc: ${formatAddressList(original.cc)}`] : []),
  ].join("\n");
}

/**
 * What the compose sheet starts with for a reply, reply-all or forward of
 * `original`, read from the mailbox `me`. A reply goes to Reply-To (or From);
 * replying to one's own sent message goes to its recipients again. Reply-all
 * copies the other recipients, never `me`.
 */
export function composeDraft(mode: Exclude<ComposeMode, "new">, original: OriginalMessage, me: string): ComposeDraft {
  const mine = (a: Address) => a.email.toLowerCase() === me.toLowerCase();
  const thread = {
    inReplyTo: mode === "forward" ? [] : (original.messageId ?? []).slice(0, 1),
    references: mode === "forward" ? [] : [...(original.references ?? []), ...(original.messageId ?? [])].slice(-20),
  };
  if (mode === "forward")
    return {
      mode,
      to: "",
      cc: "",
      subject: prefixedSubject(original.subject, "forward"),
      body: `\n\n${forwardHeader(original)}\n\n${original.text.replace(/\r\n?/g, "\n").trimEnd()}`,
      ...thread,
    };
  const fromMe = (original.from ?? []).some(mine);
  const primary = fromMe ? (original.to ?? []) : original.replyTo?.length ? original.replyTo : (original.from ?? []);
  const seen = new Set(primary.map((a) => a.email.toLowerCase()));
  const others =
    mode === "replyAll"
      ? [...(fromMe ? [] : (original.to ?? [])), ...(original.cc ?? [])].filter((a) => {
          const key = a.email.toLowerCase();
          if (mine(a) || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
      : [];
  return {
    mode,
    to: formatAddressList(primary.filter((a) => !mine(a) || fromMe)),
    cc: formatAddressList(others),
    subject: prefixedSubject(original.subject, "reply"),
    body: `\n\n${quoteFor(original)}`,
    ...thread,
  };
}

// Reading -----------------------------------------------------------------------

export type TextPiece = { text: string } | { text: string; href: string };

/** Plain text with its links clickable: http(s) addresses and e-mail addresses. Nothing else becomes a link. */
export function linkify(text: string): TextPiece[] {
  const pieces: TextPiece[] = [];
  const pattern = /\bhttps?:\/\/[^\s<>"']+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    let found = match[0];
    // A sentence's closing punctuation is not part of the link.
    const trail = /[.,;:!?)\]]+$/.exec(found);
    if (trail) found = found.slice(0, -trail[0].length);
    if (!found) continue;
    const start = match.index;
    if (start > last) pieces.push({ text: text.slice(last, start) });
    pieces.push({ text: found, href: found.includes("://") ? found : `mailto:${found}` });
    last = start + found.length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last) });
  return pieces;
}

/** A message's time in a list: the hour today, "ontem", the day this year, the date before that. São Paulo time. */
export function listDateLabel(iso: string, now: Date = new Date()) {
  const zone = "America/Sao_Paulo";
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(date);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (day(date) === day(now))
    return new Intl.DateTimeFormat("pt-BR", { timeZone: zone, timeStyle: "short" }).format(date);
  if (day(date) === day(new Date(now.getTime() - 86_400_000))) return "ontem";
  if (day(date).slice(0, 4) === day(now).slice(0, 4))
    return new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "numeric", month: "short" })
      .format(date)
      .replace(" de ", " ")
      .replace(".", "");
  return new Intl.DateTimeFormat("pt-BR", { timeZone: zone, dateStyle: "short" }).format(date);
}

/** The full date of a message being read: "31/10/2026 às 14:05". São Paulo time. */
export const fullDateLabel = (iso: string | null | undefined) => quoteDate(iso);

/** A file name safe for Content-Disposition and the download URL: no path, no control characters. */
export function safeFileName(name: string | null | undefined) {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 180);
  return clean && clean !== "." && clean !== ".." ? clean : "anexo";
}
