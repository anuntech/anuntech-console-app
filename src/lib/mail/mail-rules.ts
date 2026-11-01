/*
 * E-mail management, the pure part: who manages what, which domains, the address
 * and password rules, the quota choices, the password generator, the Apple
 * profile and the DNS comparison. No server, no Next, no database: the
 * screens, the actions and tests/mail-rules.test.ts all read this file.
 *
 * The Console never reads or sends mail (docs/memory.md, 31/10/2026): people
 * use their own apps, and this area only manages the mailboxes on the Stalwart
 * server (lib/mail/mail-admin.ts).
 */

/**
 * Anuntech's own domains, always managed. A client's domain is managed once
 * the team links it to the company (console_mail_domains, E-mail › Domínios).
 */
export const MAIL_DOMAINS = ["anuntech.com"] as const;

export const isOwnMailDomain = (value: unknown) =>
  typeof value === "string" && (MAIL_DOMAINS as readonly string[]).includes(value.trim().toLowerCase());

/**
 * Anuntech's domains and the mail infrastructure's (anuntech.cloud holds the
 * server's name, its admin and the service account): never a client's.
 */
const ANUNTECH_ROOTS = ["anuntech.com", "anuntech.cloud"];
export const isAnuntechDomain = (domain: string) => ANUNTECH_ROOTS.some((root) => domain === root || domain.endsWith(`.${root}`));

/** The part of a person's access the e-mail rules read: the team flag, assisted access and the company roles. */
export type MailActor = {
  admin: boolean;
  assisting?: unknown;
  grants: readonly { company: { id: string }; role: "manager" | "member" }[];
};
export type MailRole = "team" | "manager" | "member";

/**
 * Who someone is for a managed domain's mail (companyId null: Anuntech's own):
 * "team" (the Anuntech team, every managed domain), "manager" (a client's
 * Administrador, the domains linked to the company), "member" (a Membro of
 * the company: only the mailbox linked to them, see ownsMailbox) or null.
 * Assisted access shows the company as its client sees it but never touches
 * its mailboxes: the team manages them with its own access.
 */
export function mailRole(actor: MailActor, companyId: string | null): MailRole | null {
  if (actor.assisting) return null;
  if (actor.admin) return "team";
  if (!companyId) return null;
  const roles = actor.grants.filter((grant) => grant.company.id === companyId).map((grant) => grant.role);
  return roles.includes("manager") ? "manager" : roles.includes("member") ? "member" : null;
}

/** Creates, edits and deletes mailboxes and forwards and reads the DNS: the team, and a client's Administrador on the company's domains. */
export function canManageMail(actor: MailActor, companyId: string | null) {
  const role = mailRole(actor, companyId);
  return role === "team" || role === "manager";
}

/** Whether someone manages any mail at all: the actions refuse everyone else before asking the server anything. */
export const managesAnyMail = (actor: MailActor) => !actor.assisting && (actor.admin || actor.grants.some((grant) => grant.role === "manager"));

/**
 * The mailbox linked to a Membro: its own address is one of the e-mails of
 * the person's Console account. The address only, never an alias: an alias
 * is often shared (contato@), and reading it must not hand over the mailbox.
 */
export const ownsMailbox = (address: string, emails: readonly string[]) => emails.includes(address.toLowerCase());

/**
 * What someone may do with one mailbox: "manage" (everything), "own" (a
 * Membro's own: the password, the space used and the devices) or null, when
 * for them it does not exist.
 */
export function mailboxAccess(actor: MailActor, mailbox: { companyId: string | null; address: string }, emails: readonly string[]) {
  const role = mailRole(actor, mailbox.companyId);
  if (role === "team" || role === "manager") return "manage" as const;
  return role === "member" && ownsMailbox(mailbox.address, emails) ? ("own" as const) : null;
}

/**
 * The domain a page of the area shows (`?dominio=`): the one asked for when
 * it is managed, otherwise undefined (the page answers 404); with nothing
 * asked, Anuntech's own, or the first one. Null when there is none at all.
 */
export function pickDomain<T extends { domain: string }>(choices: T[], asked: unknown): T | null | undefined {
  if (typeof asked === "string" && asked.trim()) {
    const domain = normalizeMailDomain(asked);
    return choices.find((choice) => choice.domain === domain);
  }
  return choices.find((choice) => isOwnMailDomain(choice.domain)) ?? choices[0] ?? null;
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * A domain as the server and the database keep it: lower case, without the
 * final dot or a leading @, and an accented one in punycode ("açaí.com.br" →
 * "xn--aa-4iaz.com.br", what the URL standard does in Node and the browser
 * alike). Null when it is not a domain name with a letter TLD.
 */
export function normalizeMailDomain(raw: string) {
  const value = raw.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  if (!value || value.length > 253 || /[\s/\\:@?#[\]%]/.test(value)) return null;
  let ascii: string;
  try {
    ascii = new URL(`http://${value}`).hostname;
  } catch {
    return null;
  }
  const labels = ascii.split(".");
  if (ascii.length > 253 || labels.length < 2 || !labels.every((label) => LABEL.test(label))) return null;
  return /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels.at(-1) ?? "") ? ascii : null;
}

/** What the mail apps connect to (the server itself is mx1.anuntech.cloud). */
export const MAIL_CLIENT_HOST = "mail.anuntech.com";
export const MAIL_PORTS = {
  imap: { port: 993, security: "SSL/TLS" },
  smtp: { port: 465, security: "SSL/TLS" },
  smtpStarttls: { port: 587, security: "STARTTLS" },
} as const;

// Addresses -------------------------------------------------------------

/** The server's own addresses: reports and bounces go to them. */
export const RESERVED_LOCAL_PARTS = ["postmaster", "abuse", "mailer-daemon"];
const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
export const LOCAL_PART_MAX = 64;

/** Lower case, trimmed, and "joao@anuntech.com" typed in full becomes "joao". */
export function normalizeLocalPart(raw: string, domain: string = MAIL_DOMAINS[0]) {
  const value = raw.trim().toLowerCase();
  const suffix = `@${domain.toLowerCase()}`;
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}

/** What is wrong with a local part (the part before the @), or null. */
export function localPartProblem(local: string) {
  if (!local) return "Digite a parte antes do @.";
  if (local.length > LOCAL_PART_MAX) return `Use até ${LOCAL_PART_MAX} caracteres antes do @.`;
  if (local.includes("@")) return "Digite só a parte antes do @.";
  if (!LOCAL_PART.test(local) || /[._-]{2}/.test(local))
    return "Use letras sem acento, números, ponto, hífen ou sublinhado, começando e terminando com letra ou número.";
  if (RESERVED_LOCAL_PARTS.includes(local)) return "Esse endereço é do próprio servidor de e-mail. Escolha outro.";
  return null;
}

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** A full address someone typed as a forward's destination, lower case, or null when it is not one. */
export function normalizeAddress(raw: string) {
  const value = raw.trim().toLowerCase();
  return value.length <= 254 && EMAIL.test(value) && !value.includes("..") ? value : null;
}

/** "a@x.com, b@y.com" or one per line → the addresses, without repeats, and the pieces that were not addresses. */
export function parseRecipients(raw: string) {
  const parts = raw
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    const address = normalizeAddress(part);
    if (!address) invalid.push(part);
    else if (!valid.includes(address)) valid.push(address);
  }
  return { valid, invalid };
}

export const FORWARD_RECIPIENTS_MAX = 20;
export const MAILBOX_ALIASES_MAX = 20;

export const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase();
export const localOf = (address: string) => address.slice(0, address.lastIndexOf("@")).toLowerCase();

// Quota -----------------------------------------------------------------

export const QUOTA_OPTIONS_GB = [1, 5, 10, 20] as const;
export type QuotaGb = (typeof QUOTA_OPTIONS_GB)[number];
/** Stalwart counts in bytes and its own guide writes 5 GB as 5 × 2³⁰. */
export const GIB = 1024 ** 3;
export const DEFAULT_QUOTA_GB: QuotaGb = 5;

export const quotaBytes = (gb: QuotaGb) => gb * GIB;

/** The form's "5" → bytes; anything outside the four choices → null. */
export function parseQuota(value: unknown) {
  const gb = Number(value);
  return (QUOTA_OPTIONS_GB as readonly number[]).includes(gb) && String(gb) === String(value).trim()
    ? quotaBytes(gb as QuotaGb)
    : null;
}

/** The choice a quota in bytes matches, or null (no limit, or a size set elsewhere). */
export function quotaChoice(bytes: number | null | undefined): QuotaGb | null {
  return QUOTA_OPTIONS_GB.find((gb) => quotaBytes(gb) === bytes) ?? null;
}

/** "320 MB", "1,4 GB", "5 GB": the sizes people compare, in the binary units the server uses. */
export function storageLabel(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < GIB) return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
  const gb = bytes / GIB;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1).replace(".", ",")} GB`;
}

/** How full a mailbox is: the bar's width and when it asks for attention. */
export function quotaUse(used: number, max: number | null) {
  if (!max || max <= 0) return { percent: null, tone: "normal" as const };
  const percent = Math.min(100, Math.max(0, Math.round((used / max) * 100)));
  return { percent, tone: percent >= 95 ? ("full" as const) : percent >= 80 ? ("warning" as const) : ("normal" as const) };
}

// Passwords -------------------------------------------------------------

/** Typed passwords: the server's policy is 8 to 128 and zxcvbn 3; the Console asks for 12 at least. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** What is wrong with a typed password, or null. The server checks its strength again. */
export function passwordProblem(password: string, context: { local?: string } = {}) {
  if (password.length < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `Use no máximo ${PASSWORD_MAX} caracteres.`;
  if (password !== password.trim()) return "Tire os espaços do começo e do fim da senha.";
  if (/[\u0000-\u001f\u007f]/.test(password)) return "A senha tem um caractere que os aplicativos de e-mail não aceitam.";
  if (new Set(password).size < 6) return "A senha repete demais os mesmos caracteres. Gere uma ou use uma frase.";
  const local = context.local?.toLowerCase();
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) return "A senha não pode conter o endereço da caixa.";
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((kind) => kind.test(password)).length;
  if (password.length < 16 && kinds < 2) return "Com menos de 16 caracteres, misture letras com números ou símbolos.";
  return null;
}

/** No 0/O, 1/l/I: the password may be read aloud or typed on a phone. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const GENERATED_GROUPS = 4;
export const GENERATED_GROUP_LENGTH = 6;

/** A uniform integer in [0, max), from the Web Crypto API (Node and the browser alike). */
export function secureRandomInt(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

/**
 * A strong password for a new mailbox or a reset: four groups of six
 * ("Hq7mTz-…"), 24 random characters (about 140 bits) with upper case, lower
 * case and digits, far past the server's zxcvbn 3.
 */
export function generatePassword(random: (max: number) => number = secureRandomInt) {
  for (;;) {
    const chars = Array.from({ length: GENERATED_GROUPS * GENERATED_GROUP_LENGTH }, () => ALPHABET[random(ALPHABET.length)]);
    const text = chars.join("");
    if (!/[A-Z]/.test(text) || !/[a-z]/.test(text) || !/[0-9]/.test(text)) continue;
    const groups: string[] = [];
    for (let i = 0; i < chars.length; i += GENERATED_GROUP_LENGTH) groups.push(text.slice(i, i + GENERATED_GROUP_LENGTH));
    return groups.join("-");
  }
}

// The Apple profile -----------------------------------------------------

const xml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The profile's file name: "email-kauan-anuntech-com.mobileconfig". */
export const mobileconfigFileName = (address: string) =>
  `email-${address.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.mobileconfig`;

/**
 * An Apple Configuration Profile with one mail account
 * (`com.apple.mail.managed`): IMAP on 993 and SMTP on 465, both over SSL,
 * the full address as the user name and no password, which the iPhone or
 * the Mac asks for when the profile is installed. The identifier comes from
 * the address, so installing it again replaces the old one.
 */
export function mobileconfig({
  address,
  name,
  uuids,
  host = MAIL_CLIENT_HOST,
}: {
  address: string;
  /** The sender's name in the apps; the address when the mailbox has none. */
  name?: string | null;
  /** Two random UUIDs: the profile's and the account's. */
  uuids: [string, string];
  host?: string;
}) {
  if (!normalizeAddress(address)) throw new Error("mobileconfig: invalid address");
  if (!uuids.every((uuid) => UUID.test(uuid))) throw new Error("mobileconfig: invalid uuid");
  const id = `com.anuntech.console.mail.${address.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const display = (name ?? "").trim() || address;
  const entry = (key: string, value: string | number | boolean) =>
    `\t\t\t<key>${key}</key>\n\t\t\t${
      typeof value === "boolean" ? `<${value}/>` : typeof value === "number" ? `<integer>${value}</integer>` : `<string>${xml(value)}</string>`
    }`;
  const account = [
    entry("EmailAccountDescription", address),
    entry("EmailAccountName", display),
    entry("EmailAccountType", "EmailTypeIMAP"),
    entry("EmailAddress", address),
    entry("IncomingMailServerAuthentication", "EmailAuthPassword"),
    entry("IncomingMailServerHostName", host),
    entry("IncomingMailServerPortNumber", MAIL_PORTS.imap.port),
    entry("IncomingMailServerUseSSL", true),
    entry("IncomingMailServerUsername", address),
    entry("OutgoingMailServerAuthentication", "EmailAuthPassword"),
    entry("OutgoingMailServerHostName", host),
    entry("OutgoingMailServerPortNumber", MAIL_PORTS.smtp.port),
    entry("OutgoingMailServerUseSSL", true),
    entry("OutgoingMailServerUsername", address),
    entry("OutgoingPasswordSameAsIncomingPassword", true),
    entry("PayloadDescription", `Conta de e-mail ${address}`),
    entry("PayloadDisplayName", address),
    entry("PayloadIdentifier", `${id}.account`),
    entry("PayloadType", "com.apple.mail.managed"),
    entry("PayloadUUID", uuids[1].toUpperCase()),
    entry("PayloadVersion", 1),
  ].join("\n");
  const top = (key: string, value: string | number | boolean) => entry(key, value).replace(/^\t\t/gm, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>PayloadContent</key>
\t<array>
\t\t<dict>
${account}
\t\t</dict>
\t</array>
${[
  top("PayloadDescription", `Configura a caixa ${address} no app Mail. A senha é pedida na instalação.`),
  top("PayloadDisplayName", `E-mail ${address}`),
  top("PayloadIdentifier", id),
  top("PayloadOrganization", "Anuntech"),
  top("PayloadRemovalDisallowed", false),
  top("PayloadType", "Configuration"),
  top("PayloadUUID", uuids[0].toUpperCase()),
  top("PayloadVersion", 1),
].join("\n")}
</dict>
</plist>
`;
}

// Domain ownership ------------------------------------------------------

/**
 * A client proves a domain is theirs before the server gets it: otherwise
 * anyone could create mailboxes on someone else's domain and send mail in its
 * name to the other clients of the same server (docs/plano-email.md, Fase 4).
 */
export const OWNERSHIP_LABEL = "_anuntech";
const OWNERSHIP_PREFIX = "anuntech-verificacao=";
export const OWNERSHIP_TOKEN_LENGTH = 24;
/** Domains a company may have waiting for the proof at once. */
export const MAIL_CLAIMS_MAX = 5;

/** The token the TXT record carries: random, from the password alphabet (it is typed or read aloud sometimes). */
export function ownershipToken(random: (max: number) => number = secureRandomInt) {
  return Array.from({ length: OWNERSHIP_TOKEN_LENGTH }, () => ALPHABET[random(ALPHABET.length)]).join("");
}

/** The record to publish: TXT `_anuntech.<domain>` = `anuntech-verificacao=<token>`. */
export const ownershipRecord = (domain: string, token: string) => ({
  type: "TXT",
  name: `${OWNERSHIP_LABEL}.${domain}`,
  value: `${OWNERSHIP_PREFIX}${token}`,
});

/** What is wrong with a domain a client wants to add, or null. The server and the links are asked afterwards. */
export function addableDomainProblem(domain: string | null) {
  if (!domain) return "Digite o domínio, como empresa.com.br, sem www nem @.";
  if (isAnuntechDomain(domain)) return "Os domínios da Anuntech não são usados por clientes.";
  return null;
}

// The client's own setup ----------------------------------------------

/** Where a company's e-mail product stands: what contracting and adding a domain read. */
export type MailProductState = "none" | "active" | "paused" | "suspended";

/**
 * Why the company cannot contract the e-mail product now, or null. Only
 * whoever manages the company's mail (its Administrador, or the team); a
 * company in good standing only (no overdue invoice, no open suspension),
 * since the product starts at once and the team bills it afterwards
 * (Kauan, 01/11/2026); one e-mail product per company.
 */
export function mailContractRefusal(c: { role: MailRole | null; archived: boolean; product: MailProductState; overdue: number; suspended: boolean }) {
  if (c.role !== "team" && c.role !== "manager") return "Só o Administrador da empresa contrata o e-mail.";
  if (c.archived) return "A empresa está arquivada. Fale com a equipe.";
  if (c.product !== "none") return "A empresa já tem o e-mail da Anuntech. Abra pelo card do e-mail em Produtos.";
  if (c.overdue)
    return `A empresa tem ${c.overdue === 1 ? "uma fatura vencida" : `${c.overdue} faturas vencidas`}. Pague em Financeiro e contrate depois que o pagamento for confirmado.`;
  if (c.suspended) return "A empresa tem um produto suspenso. Fale com a equipe antes de contratar.";
  return null;
}

/**
 * Why the company cannot add a domain now, or null: its Administrador needs
 * the e-mail product active; the team adds one for any company not archived.
 */
export function domainAddRefusal(c: { role: MailRole | null; archived: boolean; product: MailProductState; pending: number }) {
  if (c.role !== "team" && c.role !== "manager") return "Só o Administrador da empresa adiciona domínio.";
  if (c.archived) return "A empresa está arquivada. Fale com a equipe.";
  if (c.role === "manager" && c.product === "none") return "Contrate o e-mail em Produtos antes de adicionar o domínio.";
  if (c.role === "manager" && c.product !== "active") return "O e-mail da empresa não está ativo. Fale com a equipe.";
  if (c.pending >= MAIL_CLAIMS_MAX) return `A empresa já tem ${MAIL_CLAIMS_MAX} domínios esperando a confirmação. Conclua ou remova um antes.`;
  return null;
}

/** DNS stages: the proof first; then what can go up at once without touching today's mail; then the switch. */
export type DnsStage = "proof" | "now" | "switch";

/** The proof as one check of the guide: found when one of the TXT records is exactly the expected value. */
export function ownershipCheck(domain: string, token: string, answer: DnsAnswer<string[]>): DnsCheck {
  const record = ownershipRecord(domain, token);
  const base = {
    key: "ownership",
    stage: "proof" as const,
    title: "Prova de que o domínio é da empresa",
    purpose: "Um registro só para a Anuntech conferir que quem cuida do DNS de verdade pediu o domínio. Pode apagar depois da confirmação.",
  };
  if (answer.status === "error") return { ...base, status: "unknown", found: [], fix: null, record };
  const found = answer.status === "found" ? answer.records.map((parts) => parts.join("").trim()) : [];
  const ok = found.includes(record.value);
  return {
    ...base,
    status: ok ? "ok" : "missing",
    found: found.length && !ok ? found : [],
    fix: ok ? null : found.length ? `O TXT de ${record.name} não tem o valor certo. Troque pelo valor abaixo.` : `Crie um registro TXT com o nome ${record.name} e o valor abaixo.`,
    record,
  };
}

// DNS health ------------------------------------------------------------

export type ZoneRecord = { name: string; type: string; value: string };

/** Splits a zone line into tokens, keeping quoted strings (with escapes) whole. */
function tokens(line: string) {
  const out: { text: string; quoted: boolean }[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === ";") break;
    if (c === '"') {
      let text = "";
      i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === "\\" && i + 1 < line.length) i++;
        text += line[i++];
      }
      i++;
      out.push({ text, quoted: true });
      continue;
    }
    let text = "";
    while (i < line.length && !" \t;\"".includes(line[i])) text += line[i++];
    out.push({ text, quoted: false });
  }
  return out;
}

const RECORD_TYPES = new Set(["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "TLSA", "NS", "PTR"]);
const CLASSES = new Set(["IN", "CH", "HS"]);

/**
 * The records of a zone file as the server writes it (`x:Domain/get`'s
 * dnsZoneFile): absolute or relative names, "@", optional TTL and class,
 * comments, parentheses and TXT values split into several quoted strings.
 * Names come back lower case, without the final dot.
 */
export function parseZoneFile(text: string, domain: string) {
  let origin = domain.toLowerCase().replace(/\.$/, "");
  const records: ZoneRecord[] = [];
  let previous = origin;
  // Parentheses continue a record over several lines.
  const lines: string[] = [];
  let pending = "";
  let depth = 0;
  for (const raw of text.split(/\r?\n/)) {
    let quoted = false;
    let line = "";
    for (const c of raw) {
      if (c === '"') quoted = !quoted;
      if (!quoted && c === ";") break;
      if (!quoted && c === "(") {
        depth++;
        line += " ";
        continue;
      }
      if (!quoted && c === ")") {
        depth = Math.max(0, depth - 1);
        line += " ";
        continue;
      }
      line += c;
    }
    pending = pending ? `${pending} ${line.trim()}` : line;
    if (depth === 0) {
      lines.push(pending);
      pending = "";
    }
  }
  if (pending) lines.push(pending);
  const absolute = (name: string) => {
    if (name === "@") return origin;
    if (name.endsWith(".")) return name.slice(0, -1).toLowerCase();
    return `${name}.${origin}`.toLowerCase();
  };
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = tokens(line);
    if (!parts.length) continue;
    if (parts[0].text.toUpperCase() === "$ORIGIN" && parts[1]) {
      origin = parts[1].text.replace(/\.$/, "").toLowerCase();
      continue;
    }
    if (parts[0].text.startsWith("$")) continue;
    const continued = /^[ \t]/.test(line);
    let index = 0;
    let name = previous;
    if (!continued) {
      name = absolute(parts[0].text);
      index = 1;
    }
    // TTL and class, in either order.
    for (let step = 0; step < 2 && index < parts.length; step++) {
      const token = parts[index].text.toUpperCase();
      if (/^\d+[smhdw]?$/i.test(token) || CLASSES.has(token)) index++;
    }
    const type = parts[index]?.text.toUpperCase();
    if (!type || !RECORD_TYPES.has(type)) continue;
    const data = parts.slice(index + 1);
    previous = name;
    const value =
      type === "TXT"
        ? data.map((p) => p.text).join("")
        : data
            .map((p) => p.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    records.push({ name, type, value });
  }
  return records;
}

export type DnsExpectation = {
  domain: string;
  /** Mail exchangers, lower case, without the final dot. */
  mx: string[];
  spf: string | null;
  dkim: { selector: string; name: string; value: string }[];
  dmarc: string | null;
  /**
   * Names that must point at the server: autoconfig and autodiscover (the
   * apps' automatic setup) and mail.<domain>, which the server's certificate
   * also covers. Empty when the zone has no automatic setup records.
   */
  hosts: { label: string; name: string; target: string }[];
};

const host = (name: string) => name.trim().toLowerCase().replace(/\.$/, "");

/** The automatic setup names the zone lists, and mail.<domain>, which the server's certificate asks for too. */
const HOST_LABELS = ["mail", "autoconfig", "autodiscover"] as const;

/**
 * What the server expects in the domain's zone, for the checks people need.
 * The zone also lists CAA records: they are never shown, since a CAA naming
 * only the mail server's certificate authority would break the certificates
 * of the client's website (Vercel and others issue elsewhere).
 */
export function expectedDns(records: ZoneRecord[], domain: string): DnsExpectation {
  const apex = host(domain);
  const txtAt = (name: string) => records.filter((r) => r.type === "TXT" && r.name === name).map((r) => r.value);
  const cname = (label: string) => records.find((r) => r.type === "CNAME" && r.name === `${label}.${apex}`);
  const setup = cname("autoconfig") ?? cname("autodiscover");
  const target = setup ? host(setup.value) : null;
  return {
    domain: apex,
    mx: records
      .filter((r) => r.type === "MX" && r.name === apex)
      .map((r) => host(r.value.split(" ").at(-1) ?? ""))
      .filter(Boolean),
    spf: txtAt(apex).find((v) => /^v=spf1\b/i.test(v)) ?? null,
    dkim: records
      .filter((r) => r.type === "TXT" && r.name.endsWith(`._domainkey.${apex}`) && /(^|;)\s*p=/i.test(r.value))
      .map((r) => ({ selector: r.name.slice(0, -`._domainkey.${apex}`.length), name: r.name, value: r.value })),
    dmarc: txtAt(`_dmarc.${apex}`).find((v) => /^v=DMARC1\b/i.test(v)) ?? null,
    hosts: target
      ? HOST_LABELS.map((label) => ({ label, name: `${label}.${apex}`, target: cname(label) ? host(cname(label)!.value) : target }))
          // A name that is the target itself (autoconfig pointing at mail.<domain>) has nothing to point at.
          .filter((entry) => entry.name !== entry.target)
      : [],
  };
}

/** A lookup's answer: the records, nothing there, or the question could not be asked. */
export type DnsAnswer<T> = { status: "found"; records: T[] } | { status: "none" } | { status: "error" };
export type DnsLookups = {
  mx: DnsAnswer<{ exchange: string; priority: number }>;
  /** By name: TXT records as the resolver returns them (each one a list of strings). */
  txt: Record<string, DnsAnswer<string[]>>;
  /**
   * By name, for the expectation's hosts: the CNAME and, without one, the
   * addresses; `targets` are the server's own addresses, by target name. A
   * name with A records equal to the server's points at it too
   * (mail.anuntech.com is set up that way).
   */
  hosts?: Record<string, { cname: DnsAnswer<string>; a: DnsAnswer<string> }>;
  targets?: Record<string, DnsAnswer<string>>;
};

export type DnsCheckStatus = "ok" | "missing" | "unknown";
export type DnsCheck = {
  key: string;
  /** Where the guide shows it: the proof, what can go up now, or the switch from the old provider. */
  stage: DnsStage;
  title: string;
  /** What the record does, in a sentence without jargon. */
  purpose: string;
  status: DnsCheckStatus;
  /** What is published today, when it helps to see it. */
  found: string[];
  /** What to change, when something is wrong. */
  fix: string | null;
  /** The record to create or correct, to copy into the DNS panel. */
  record: { type: string; name: string; value: string } | null;
};

const spfTerms = (record: string) =>
  record
    .trim()
    .split(/\s+/)
    .slice(1)
    .map((term) => term.toLowerCase());
/** The key in a DKIM record, without the spaces some panels add. */
const dkimKey = (record: string) => /(?:^|;)\s*p=([^;]*)/i.exec(record)?.[1].replace(/\s+/g, "") ?? "";
const dmarcPolicy = (record: string) => /(?:^|;)\s*p=\s*([a-z]+)/i.exec(record)?.[1].toLowerCase() ?? null;

/** Where DMARC starts: reports only, so a sender the client forgot is not rejected while the switch settles. */
export const startingDmarc = (domain: string) => `v=DMARC1; p=none; rua=mailto:postmaster@${domain}`;

/**
 * Each check, compared with what the server expects: "ok" (certo),
 * "missing" (falta isto, with the fix) or "unknown" (the lookup failed).
 * DKIM and DMARC can go up at once without changing anything in the mail of
 * today ("now"); MX, SPF and the names of the apps move the mail over
 * ("switch"), after the mailboxes exist and the old mail was copied.
 */
export function compareDns(expected: DnsExpectation, lookups: DnsLookups): DnsCheck[] {
  const { domain } = expected;
  const checks: DnsCheck[] = [];
  const txt = (name: string): DnsAnswer<string> => {
    const answer = lookups.txt[name] ?? { status: "error" };
    return answer.status === "found" ? { status: "found", records: answer.records.map((parts) => parts.join("")) } : answer;
  };

  if (expected.mx.length) {
    const stage = "switch" as const;
    const title = "Recebimento (MX)";
    const purpose = "Diz para onde vão os e-mails enviados para o domínio.";
    const record = { type: "MX", name: domain, value: `10 ${expected.mx[0]}` };
    const answer = lookups.mx;
    if (answer.status === "error")
      checks.push({ key: "mx", stage, title, purpose, status: "unknown", found: [], fix: null, record: null });
    else {
      const found = answer.status === "found" ? answer.records.map((r) => host(r.exchange)) : [];
      const missing = expected.mx.filter((mx) => !found.includes(mx));
      const extra = found.filter((mx) => !expected.mx.includes(mx));
      const ok = !missing.length && !extra.length;
      checks.push({
        key: "mx",
        stage,
        title,
        purpose,
        status: ok ? "ok" : "missing",
        found: answer.status === "found" ? answer.records.map((r) => `${r.priority} ${host(r.exchange)}`) : [],
        fix: ok
          ? null
          : missing.length && !found.length
            ? `Crie um registro MX em ${domain} apontando para ${expected.mx.join(", ")}. Sem ele, ninguém consegue mandar e-mail para o domínio.`
            : missing.length
              ? `Aponte o MX de ${domain} para ${expected.mx.join(", ")} e apague ${extra.join(", ") || "os outros"}. Hoje os e-mails vão para outro servidor.`
              : `Apague o MX que aponta para ${extra.join(", ")}. Parte dos e-mails pode ir para lá em vez do servidor da Anuntech.`,
        record: ok ? null : record,
      });
    }
  }

  if (expected.spf) {
    const stage = "switch" as const;
    const title = "Quem pode enviar (SPF)";
    const purpose = "Lista os servidores que podem mandar e-mail em nome do domínio, para não cair no spam.";
    const record = { type: "TXT", name: domain, value: expected.spf };
    const answer = txt(domain);
    if (answer.status === "error") checks.push({ key: "spf", stage, title, purpose, status: "unknown", found: [], fix: null, record: null });
    else {
      const found = answer.status === "found" ? answer.records.filter((r) => /^v=spf1\b/i.test(r.trim())) : [];
      const wanted = spfTerms(expected.spf).filter((term) => !/^[-~?+]?all$/.test(term));
      let fix: string | null = null;
      if (!found.length) fix = `Crie um registro TXT em ${domain} com o valor abaixo.`;
      else if (found.length > 1) fix = `Há ${found.length} registros SPF em ${domain}, e com mais de um nenhum vale. Junte tudo em um só, com o valor abaixo e o que mais precisar enviar pelo domínio.`;
      else {
        const terms = spfTerms(found[0]);
        const lacking = wanted.filter((term) => !terms.includes(term));
        if (terms.some((term) => term === "+all" || term === "all")) fix = "O SPF de hoje deixa qualquer servidor enviar pelo domínio. Troque o fim por -all, como no valor abaixo.";
        else if (lacking.length) fix = `O SPF de hoje não inclui o servidor da Anuntech. Acrescente ${lacking.join(" ")} ao registro, antes do "all".`;
      }
      checks.push({ key: "spf", stage, title, purpose, status: fix ? "missing" : "ok", found, fix, record: fix ? record : null });
    }
  }

  for (const key of expected.dkim) {
    const stage = "now" as const;
    const title = expected.dkim.length > 1 ? `Assinatura dos e-mails (DKIM ${key.selector})` : "Assinatura dos e-mails (DKIM)";
    const purpose = "Prova que o e-mail saiu do servidor da Anuntech e não foi alterado no caminho.";
    const record = { type: "TXT", name: key.name, value: key.value };
    const answer = txt(key.name);
    if (answer.status === "error") {
      checks.push({ key: `dkim:${key.selector}`, stage, title, purpose, status: "unknown", found: [], fix: null, record: null });
      continue;
    }
    const found = answer.status === "found" ? answer.records : [];
    const matches = found.some((r) => dkimKey(r) && dkimKey(r) === dkimKey(key.value));
    checks.push({
      key: `dkim:${key.selector}`,
      stage,
      title,
      purpose,
      status: matches ? "ok" : "missing",
      // The key itself is long and says nothing to a person: only whether it is there.
      found: found.length ? [found.length === 1 ? "Há uma chave publicada" : `Há ${found.length} chaves publicadas`] : [],
      fix: matches
        ? null
        : found.length
          ? `A chave publicada em ${key.name} é diferente da do servidor. Troque o valor do registro TXT pelo de baixo.`
          : `Crie um registro TXT com o nome ${key.name} e o valor abaixo.`,
      record: matches ? null : record,
    });
  }

  {
    const stage = "now" as const;
    const title = "Proteção contra falsificação (DMARC)";
    const purpose = "Diz aos outros servidores o que fazer com e-mails falsos que usam o domínio.";
    const name = `_dmarc.${domain}`;
    // The server's zone asks for p=reject; a domain starts at p=none and is hardened later, by hand.
    const value = startingDmarc(domain);
    const answer = txt(name);
    if (answer.status === "error") checks.push({ key: "dmarc", stage, title, purpose, status: "unknown", found: [], fix: null, record: null });
    else {
      const found = answer.status === "found" ? answer.records.filter((r) => /^v=DMARC1\b/i.test(r.trim())) : [];
      const policy = found.length === 1 ? dmarcPolicy(found[0]) : null;
      const fix = !found.length
        ? `Crie um registro TXT com o nome ${name} e o valor abaixo.`
        : found.length > 1
          ? `Há ${found.length} registros DMARC em ${name}. Deixe só um.`
          : !policy
            ? `O registro DMARC de ${name} não diz a política (p=). Use o valor abaixo.`
            : null;
      checks.push({ key: "dmarc", stage, title, purpose, status: fix ? "missing" : "ok", found, fix, record: fix ? { type: "TXT", name, value } : null });
    }
  }

  for (const entry of expected.hosts) {
    const stage = "switch" as const;
    const { title, purpose } = HOST_TEXT[entry.label as (typeof HOST_LABELS)[number]] ?? { title: entry.name, purpose: "" };
    const record = { type: "CNAME", name: entry.name, value: entry.target };
    const answer = lookups.hosts?.[entry.name];
    const target = lookups.targets?.[entry.target];
    if (!answer || answer.cname.status === "error") {
      checks.push({ key: `host:${entry.label}`, stage, title, purpose, status: "unknown", found: [], fix: null, record: null });
      continue;
    }
    let fix: string | null;
    let found: string[] = [];
    if (answer.cname.status === "found") {
      const to = host(answer.cname.records[0] ?? "");
      found = [`CNAME ${to}`];
      fix = to === entry.target ? null : `${entry.name} aponta para ${to}. Troque o CNAME para ${entry.target}.`;
    } else if (answer.a.status === "found") {
      found = answer.a.records.map((ip) => `A ${ip}`);
      const server = target?.status === "found" ? target.records : [];
      // A name with the server's own addresses works as well as the CNAME (mail.anuntech.com).
      fix = server.length && answer.a.records.every((ip) => server.includes(ip))
        ? null
        : `${entry.name} aponta para outro servidor. Apague o registro A e crie o CNAME abaixo. Se o DNS é da Cloudflare, deixe o proxy desligado (nuvem cinza) nesse registro.`;
    } else if (answer.a.status === "error") {
      checks.push({ key: `host:${entry.label}`, stage, title, purpose, status: "unknown", found: [], fix: null, record: null });
      continue;
    } else fix = `Crie um registro CNAME com o nome ${entry.name} apontando para ${entry.target}.`;
    checks.push({ key: `host:${entry.label}`, stage, title, purpose, status: fix ? "missing" : "ok", found: fix ? found : [], fix, record: fix ? record : null });
  }
  return checks;
}

/** The name as most DNS panels take it: without the domain, and "@" for the domain itself. */
export function dnsPanelName(name: string, domain: string) {
  if (name === domain) return "@";
  return name.endsWith(`.${domain}`) ? name.slice(0, -domain.length - 1) : name;
}

/** The names the DNS check asks about: the domain, each DKIM selector and DMARC. */
export function dnsQuestions(expected: DnsExpectation) {
  return [expected.domain, ...expected.dkim.map((k) => k.name), `_dmarc.${expected.domain}`];
}

const HOST_TEXT: Record<(typeof HOST_LABELS)[number], { title: string; purpose: string }> = {
  mail: { title: "Endereço dos aplicativos (mail)", purpose: "O nome que os celulares e programas de e-mail usam, e que o certificado do servidor cobre." },
  autoconfig: { title: "Configuração automática (autoconfig)", purpose: "Deixa o Thunderbird e outros aplicativos acharem o servidor sozinhos." },
  autodiscover: { title: "Configuração automática do Outlook (autodiscover)", purpose: "Deixa o Outlook achar o servidor sozinho, só com o endereço e a senha." },
};

/**
 * Where the domain's mail lands today, from the MX check: on the server
 * ("here"), still at the old provider ("elsewhere"), nowhere yet ("none"),
 * or unknown. The guide warns while it is not here.
 */
export function mailArrival(checks: DnsCheck[]): "here" | "elsewhere" | "none" | "unknown" {
  const mx = checks.find((check) => check.key === "mx");
  if (!mx || mx.status === "unknown") return "unknown";
  if (mx.status === "ok") return "here";
  return mx.found.length ? "elsewhere" : "none";
}
