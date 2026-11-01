import "server-only";
import { Resolver } from "node:dns/promises";
import { asc, eq, inArray } from "drizzle-orm";
import { companies, mailDomains } from "@/db/schema";
import { db } from "../db";
import { isJmapId, jmap, MailMethodError } from "./jmap";
import {
  MAIL_DOMAINS,
  MAILBOX_ALIASES_MAX,
  FORWARD_RECIPIENTS_MAX,
  compareDns,
  dnsQuestions,
  domainOf,
  expectedDns,
  isAnuntechDomain,
  isOwnMailDomain,
  localOf,
  localPartProblem,
  parseZoneFile,
  type DnsAnswer,
  type DnsCheck,
} from "./mail-rules";
import type { DomainRow, ForwardRow, MailboxRow } from "./mail-types";

/*
 * The operations of the e-mail area on the Stalwart server: mailboxes
 * (x:Account, @type User), forwards (x:MailingList) and the DNS health of
 * the managed domains: Anuntech's own (MAIL_DOMAINS) and the ones the team
 * linked to a client (console_mail_domains).
 *
 * Nothing the browser sends is trusted: an account or list id is read back
 * from the server and changed only when it is in a managed domain and, for
 * accounts, a plain User (the admin and the service account live in
 * teste.anuntech.cloud, which is never managed, and other roles are left to
 * the server's own console). The domainId always comes from the server's
 * own list, by name.
 * Passwords go to the server and nowhere else: not to the logs, not to the
 * database, not back to the screen unless the Console generated them.
 */

/** A refusal written for the person: the action shows the message as it is. */
export class MailRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailRefusal";
  }
}

type Alias = { name?: unknown; domainId?: unknown; enable?: unknown; description?: unknown };
type RawAccount = {
  id?: unknown;
  "@type"?: unknown;
  name?: unknown;
  domainId?: unknown;
  description?: unknown;
  emailAddress?: unknown;
  usedDiskQuota?: unknown;
  quotas?: unknown;
  aliases?: unknown;
  roles?: unknown;
  createdAt?: unknown;
};
type RawList = {
  id?: unknown;
  name?: unknown;
  domainId?: unknown;
  description?: unknown;
  emailAddress?: unknown;
  recipients?: unknown;
  aliases?: unknown;
};
type SetError = { type?: unknown; properties?: unknown; description?: unknown };

const ACCOUNT_PROPERTIES = ["id", "@type", "name", "domainId", "description", "emailAddress", "usedDiskQuota", "quotas", "aliases", "roles", "createdAt"];
const LIST_PROPERTIES = ["id", "name", "domainId", "description", "emailAddress", "recipients", "aliases"];
const GET_CHUNK = 100;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const record = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** A JMAP list arrives as an object keyed by position ({"0": …, "1": …}); an array is read too. */
function listEntries<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return Object.entries(record(value))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, item]) => item as T);
}

/** A JMAP set arrives as {"value": true}. */
const setKeys = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : Object.entries(record(value)).filter(([, on]) => on === true).map(([key]) => key);

async function queryIds(method: string, filter: Record<string, unknown> = {}) {
  const ids: string[] = [];
  // A safety stop: the server pages its answers, and a broken one must not loop forever.
  for (let round = 0; round < 50; round++) {
    const result = await jmap([[`${method}/query`, { filter, position: ids.length, calculateTotal: true }, "q"]]);
    const answer = result<{ ids?: unknown; total?: unknown }>("q", `${method}/query`);
    const page = Array.isArray(answer.ids) ? answer.ids.filter(isJmapId) : [];
    ids.push(...page);
    const total = typeof answer.total === "number" ? answer.total : ids.length;
    if (!page.length || ids.length >= total) break;
  }
  return [...new Set(ids)];
}

async function getObjects<T>(method: string, ids: string[], properties: string[]) {
  const list: T[] = [];
  for (let i = 0; i < ids.length; i += GET_CHUNK) {
    const result = await jmap([[`${method}/get`, { ids: ids.slice(i, i + GET_CHUNK), properties }, "g"]]);
    const answer = result<{ list?: unknown }>("g", `${method}/get`);
    if (Array.isArray(answer.list)) list.push(...(answer.list as T[]));
  }
  return list;
}

// Domains ---------------------------------------------------------------

/** A domain the Console manages: the server's id and, on a client's, the company. */
export type ManagedDomain = { id: string; companyId: string | null };

let serverCache: { byName: Map<string, string>; expires: number } | null = null;
let askedFreshAt = 0;

/** Every domain on the server, by name → id. Kept for 10 minutes; `fresh` asks again. */
async function serverDomains(fresh = false) {
  if (!fresh && serverCache && serverCache.expires > Date.now()) return serverCache.byName;
  const ids = await queryIds("x:Domain");
  const domains = await getObjects<{ id?: unknown; name?: unknown }>("x:Domain", ids, ["id", "name"]);
  const byName = new Map<string, string>();
  for (const domain of domains) {
    const name = text(domain.name).toLowerCase();
    if (name && isJmapId(domain.id)) byName.set(name, domain.id);
  }
  askedFreshAt = Date.now();
  // An empty answer (a server being set up, a role without sysDomainQuery) is not kept: the next request asks again.
  serverCache = byName.size ? { byName, expires: Date.now() + 10 * 60_000 } : null;
  return byName;
}

/** Anuntech's own domains and the ones linked to a client, with the company: read from the database every time. */
async function allowedDomains() {
  const linked = await db.select({ domain: mailDomains.domain, companyId: mailDomains.companyId }).from(mailDomains);
  const allowed = new Map<string, string | null>(MAIL_DOMAINS.map((domain) => [domain, null]));
  // A link to one of Anuntech's domains would hand it to a client: the actions refuse it, and it is ignored here too.
  for (const row of linked) if (!isAnuntechDomain(row.domain)) allowed.set(row.domain, row.companyId);
  return allowed;
}

/**
 * The managed domains the server has, by name. A domain the server did not
 * have a minute ago (linked on another instance, just created) is looked up
 * again, at most once a minute.
 */
export async function managedDomains() {
  const allowed = await allowedDomains();
  let server = await serverDomains();
  if ([...allowed.keys()].some((name) => !server.has(name)) && Date.now() - askedFreshAt > 60_000) server = await serverDomains(true);
  const managed = new Map<string, ManagedDomain>();
  for (const [name, companyId] of allowed) {
    const id = server.get(name);
    if (id) managed.set(name, { id, companyId });
  }
  return managed;
}

async function domainNames() {
  const byName = await managedDomains();
  return new Map([...byName].map(([name, { id, companyId }]) => [id, { name, companyId }] as const));
}

/** Whether the server has the domain, asked again now. */
export async function serverHasDomain(domain: string) {
  return (await serverDomains(true)).has(domain);
}

/**
 * E-mail › Domínios: the managed domains (Anuntech's own first, then each
 * client's, by domain) and the server's domains no one manages yet, which the
 * team may link to a client (never Anuntech's).
 */
export async function domainOverview(): Promise<{ rows: DomainRow[]; linkable: string[] }> {
  const [linked, server] = await Promise.all([
    db
      .select({ linkId: mailDomains.id, domain: mailDomains.domain, companyId: mailDomains.companyId, companyName: companies.name })
      .from(mailDomains)
      .innerJoin(companies, eq(companies.id, mailDomains.companyId))
      .orderBy(asc(mailDomains.domain)),
    serverDomains(true),
  ]);
  const clients = linked.filter((row) => !isAnuntechDomain(row.domain));
  const taken = new Set(clients.map((row) => row.domain));
  return {
    rows: [
      ...MAIL_DOMAINS.map((domain) => ({ domain, linkId: null, companyId: null, companyName: "Anuntech", onServer: server.has(domain) })),
      ...clients.map((row) => ({ ...row, onServer: server.has(row.domain) })),
    ],
    linkable: [...server.keys()].filter((name) => !taken.has(name) && !isAnuntechDomain(name)).sort(),
  };
}

/** The managed domains for the screens' domain switcher, with whose they are: Anuntech's first, then by domain. */
export async function domainChoices() {
  const managed = await managedDomains();
  const ids = [...new Set([...managed.values()].flatMap(({ companyId }) => (companyId ? [companyId] : [])))];
  const names = new Map(
    ids.length ? (await db.select({ id: companies.id, name: companies.name }).from(companies).where(inArray(companies.id, ids))).map((c) => [c.id, c.name]) : [],
  );
  return [...managed]
    .map(([domain, { companyId }]) => ({ domain, companyName: companyId ? (names.get(companyId) ?? "") : "Anuntech" }))
    .sort((a, b) => Number(!isOwnMailDomain(a.domain)) - Number(!isOwnMailDomain(b.domain)) || a.domain.localeCompare(b.domain));
}

// Reading ---------------------------------------------------------------

const allAccounts = async () => getObjects<RawAccount>("x:Account", await queryIds("x:Account"), ACCOUNT_PROPERTIES);
const allLists = async () => getObjects<RawList>("x:MailingList", await queryIds("x:MailingList"), LIST_PROPERTIES);

/** Only a User with the plain User role is managed here; anything unexpected is left alone. */
const isPlainUser = (account: RawAccount) => account["@type"] === "User" && record(account.roles)["@type"] === "User";

type DomainNames = Awaited<ReturnType<typeof domainNames>>;

function mailboxRow(account: RawAccount, names: DomainNames): MailboxRow | null {
  const owner = names.get(text(account.domainId));
  const domain = owner?.name;
  const companyId = owner?.companyId ?? null;
  const local = text(account.name).toLowerCase();
  if (!domain || !local || !isJmapId(account.id) || account["@type"] !== "User") return null;
  const used = Number(account.usedDiskQuota);
  const max = Number(record(account.quotas).maxDiskQuota);
  return {
    id: account.id,
    address: text(account.emailAddress).toLowerCase() || `${local}@${domain}`,
    local,
    domain,
    name: text(account.description).trim() || null,
    usedBytes: Number.isFinite(used) && used > 0 ? used : 0,
    quotaBytes: Number.isFinite(max) && max > 0 ? max : null,
    aliases: listEntries<Alias>(account.aliases)
      .filter((a) => a.domainId === account.domainId && a.enable !== false && text(a.name))
      .map((a) => text(a.name).toLowerCase()),
    createdAt: Number.isFinite(Date.parse(text(account.createdAt))) ? new Date(text(account.createdAt)).toISOString() : null,
    managed: isPlainUser(account),
    companyId,
  };
}

function forwardRow(list: RawList, names: DomainNames): ForwardRow | null {
  const owner = names.get(text(list.domainId));
  const domain = owner?.name;
  const companyId = owner?.companyId ?? null;
  const local = text(list.name).toLowerCase();
  if (!domain || !local || !isJmapId(list.id)) return null;
  return {
    id: list.id,
    address: text(list.emailAddress).toLowerCase() || `${local}@${domain}`,
    local,
    domain,
    name: text(list.description).trim() || null,
    recipients: setKeys(list.recipients).map((r) => r.toLowerCase()),
    aliases: listEntries<Alias>(list.aliases)
      .filter((a) => a.domainId === list.domainId && a.enable !== false && text(a.name))
      .map((a) => text(a.name).toLowerCase()),
    companyId,
  };
}

const byAddress = <T extends { address: string }>(a: T, b: T) => a.address.localeCompare(b.address);

/** The mailboxes of the managed domains (or of one): plain users first-class, the others listed without actions. */
export async function listMailboxes(domain?: string) {
  const names = await domainNames();
  if (!names.size) return [];
  return (await allAccounts())
    .map((account) => mailboxRow(account, names))
    .filter((row): row is MailboxRow => !!row && (domain === undefined || row.domain === domain))
    .sort(byAddress);
}

export async function listForwards(domain?: string) {
  const names = await domainNames();
  if (!names.size) return [];
  return (await allLists())
    .map((list) => forwardRow(list, names))
    .filter((row): row is ForwardRow => !!row && (domain === undefined || row.domain === domain))
    .sort(byAddress);
}

/** A mailbox the Console may change, read from the server; null for anything else (another domain, an admin, no such id). */
export async function findManagedMailbox(id: unknown) {
  if (!isJmapId(id)) return null;
  const [account] = await getObjects<RawAccount>("x:Account", [id], ACCOUNT_PROPERTIES);
  if (!account || account.id !== id || !isPlainUser(account)) return null;
  const row = mailboxRow(account, await domainNames());
  return row?.managed ? { row, account } : null;
}

/** A forward in a managed domain, read from the server; null for anything else. */
export async function findManagedForward(id: unknown) {
  if (!isJmapId(id)) return null;
  const [list] = await getObjects<RawList>("x:MailingList", [id], LIST_PROPERTIES);
  if (!list || list.id !== id) return null;
  return forwardRow(list, await domainNames());
}

/**
 * Every local part already taken in a domain: accounts of any kind, their
 * aliases (wherever the account lives) and lists with theirs. `except`
 * leaves out one account's or one list's own aliases, for its edit form.
 */
async function takenLocals(domainId: string, except?: { account?: string; list?: string }) {
  const [accounts, lists] = await Promise.all([allAccounts(), allLists()]);
  const taken = new Map<string, "account" | "alias" | "list">();
  for (const account of accounts) {
    if (account.domainId === domainId && text(account.name)) taken.set(text(account.name).toLowerCase(), "account");
    if (account.id === except?.account) continue;
    for (const alias of listEntries<Alias>(account.aliases))
      if (alias.domainId === domainId && text(alias.name)) taken.set(text(alias.name).toLowerCase(), "alias");
  }
  for (const list of lists) {
    if (list.domainId === domainId && text(list.name)) taken.set(text(list.name).toLowerCase(), "list");
    if (list.id === except?.list) continue;
    for (const alias of listEntries<Alias>(list.aliases))
      if (alias.domainId === domainId && text(alias.name)) taken.set(text(alias.name).toLowerCase(), "alias");
  }
  return taken;
}

const TAKEN = {
  account: "já é uma caixa",
  alias: "já é apelido de outra caixa",
  list: "já é um redirecionamento",
} as const;

// Errors ----------------------------------------------------------------

/** A set error, as the person reads it. Only the type and the property names go to the log. */
function refusal(method: string, error: SetError | undefined, password = false) {
  const type = text(error?.type) || "unknown";
  const properties = Array.isArray(error?.properties) ? error.properties.map(String) : [];
  console.error(`[email] ${method} refused`, { type, properties });
  const description = text(error?.description);
  if (password && (properties.some((p) => p.startsWith("credentials")) || /password|secret|weak|zxcvbn|strength/i.test(description)))
    return new MailRefusal("O servidor de e-mail achou a senha fraca. Gere uma senha ou use uma frase mais longa, com palavras que não combinem.");
  if (type === "forbidden") return new MailRefusal("O servidor de e-mail não deixou a conta do Console fazer isso. Peça a quem administra o servidor.");
  if (type === "notFound") return new MailRefusal("O servidor de e-mail não encontrou esse registro. Atualize a página.");
  if (type === "alreadyExists" || type === "primaryKeyViolation")
    return new MailRefusal("Esse endereço já está em uso no servidor de e-mail. Escolha outro.");
  return new MailRefusal("O servidor de e-mail recusou a mudança. Confira os dados e tente de novo.");
}

type SetResult = {
  created?: Record<string, { id?: unknown }> | null;
  notCreated?: Record<string, SetError> | null;
  updated?: Record<string, unknown> | null;
  notUpdated?: Record<string, SetError> | null;
  destroyed?: unknown[] | null;
  notDestroyed?: Record<string, SetError> | null;
};

async function set(method: string, args: Record<string, unknown>, { idempotent = true } = {}) {
  const result = await jmap([[`${method}/set`, args, "s"]], { idempotent });
  try {
    return result<SetResult>("s", `${method}/set`);
  } catch (error) {
    if (error instanceof MailMethodError && error.type === "forbidden")
      throw new MailRefusal("O servidor de e-mail não deixou a conta do Console fazer isso. Peça a quem administra o servidor.");
    throw error;
  }
}

async function updateOne(method: string, id: string, patch: Record<string, unknown>, password = false) {
  const answer = await set(method, { update: { [id]: patch } });
  if (answer.notUpdated?.[id] || !answer.updated || !(id in answer.updated)) throw refusal(`${method}/set`, answer.notUpdated?.[id], password);
}

async function destroyOne(method: string, id: string) {
  const answer = await set(method, { destroy: [id] });
  if (answer.notDestroyed?.[id] || !answer.destroyed?.includes(id)) throw refusal(`${method}/set`, answer.notDestroyed?.[id]);
}

async function createOne(method: string, value: Record<string, unknown>, password = false) {
  const answer = await set(method, { create: { new: value } }, { idempotent: false });
  const id = answer.created?.new?.id;
  if (!isJmapId(id)) throw refusal(`${method}/set`, answer.notCreated?.new, password);
  return id;
}

// Mailboxes -------------------------------------------------------------

async function managedDomain(domain: string) {
  const found = (await managedDomains()).get(domain);
  if (found) return found;
  throw new MailRefusal(
    (await allowedDomains()).has(domain) ? `O domínio ${domain} não está no servidor de e-mail.` : `O domínio ${domain} não é gerenciado pelo Console.`,
  );
}

async function ensureFree(domainIdValue: string, local: string, except?: { account?: string; list?: string }) {
  const taken = (await takenLocals(domainIdValue, except)).get(local);
  if (taken) throw new MailRefusal(`${local} ${TAKEN[taken]}. Escolha outro endereço.`);
}

/** Creates a mailbox with its password; the caller generated or checked it. */
export async function createMailbox(input: { domain: string; local: string; name: string | null; quotaBytes: number; password: string }) {
  const problem = localPartProblem(input.local);
  if (problem) throw new MailRefusal(problem);
  const { id, companyId } = await managedDomain(input.domain);
  await ensureFree(id, input.local);
  const accountId = await createOne(
    "x:Account",
    {
      "@type": "User",
      name: input.local,
      domainId: id,
      description: input.name,
      credentials: { "0": { "@type": "Password", secret: input.password } },
      aliases: {},
      memberGroupIds: {},
      roles: { "@type": "User" },
      permissions: { "@type": "Inherit" },
      quotas: { maxDiskQuota: input.quotaBytes },
      encryptionAtRest: { "@type": "Disabled" },
    },
    true,
  );
  return { id: accountId, address: `${input.local}@${input.domain}`, companyId };
}

/** A new password for a mailbox the Console manages; the apps signed in with the old one stop. */
export async function setMailboxPassword(id: string, password: string) {
  // The Password credential is the account's first one (checked on the server, 31/10/2026).
  await updateOne("x:Account", id, { "credentials/0/secret": password }, true);
}

/**
 * Name, quota and aliases of a managed mailbox. Aliases are the local parts
 * of its own domain; aliases elsewhere (set on the server) are kept as they
 * are. `quotaBytes: undefined` keeps the quota.
 */
export async function updateMailbox(
  mailbox: NonNullable<Awaited<ReturnType<typeof findManagedMailbox>>>,
  input: { name: string | null; quotaBytes?: number; aliases: string[] },
) {
  const { row, account } = mailbox;
  const patch: Record<string, unknown> = { description: input.name };
  if (input.quotaBytes !== undefined) patch["quotas/maxDiskQuota"] = input.quotaBytes;
  const wanted = [...new Set(input.aliases)];
  const current = listEntries<Alias>(account.aliases);
  const same = (a: Alias) => a.domainId === account.domainId;
  const currentHere = current.filter((a) => same(a) && a.enable !== false).map((a) => text(a.name).toLowerCase());
  const changed = wanted.length !== currentHere.length || wanted.some((local) => !currentHere.includes(local));
  if (changed) {
    if (wanted.length > MAILBOX_ALIASES_MAX) throw new MailRefusal(`Uma caixa pode ter até ${MAILBOX_ALIASES_MAX} apelidos.`);
    const added = wanted.filter((local) => !currentHere.includes(local));
    for (const local of added) {
      const problem = localPartProblem(local);
      if (problem) throw new MailRefusal(`Apelido ${local}: ${problem}`);
      if (local === row.local) throw new MailRefusal(`${local} já é o endereço desta caixa.`);
    }
    if (added.length) {
      const taken = await takenLocals(text(account.domainId), { account: row.id });
      for (const local of added) {
        const what = taken.get(local);
        if (what) throw new MailRefusal(`${local}@${row.domain} ${TAKEN[what]}. Escolha outro apelido.`);
      }
    }
    // The whole list is sent: positions shift when one goes, and a replaced field leaves no gap.
    // Disabled aliases (set on the server) stay as they are, unless the person adds the same name back.
    const kept = current.filter((a) => {
      const local = text(a.name).toLowerCase();
      return !same(a) || (a.enable === false ? !wanted.includes(local) : wanted.includes(local));
    });
    const next = [...kept, ...added.map((local) => ({ name: local, domainId: account.domainId, enable: true }))];
    patch.aliases = Object.fromEntries(next.map((alias, index) => [String(index), alias]));
  }
  await updateOne("x:Account", row.id, patch);
  return { aliasesChanged: changed };
}

/** Deletes the account: the server removes it at once and its mail in the background. */
export async function deleteMailbox(id: string) {
  await destroyOne("x:Account", id);
}

// Forwards --------------------------------------------------------------

/**
 * Forward destinations: any outside address, and inside a managed domain
 * only one that exists (a typo would bounce every message).
 */
async function checkRecipients(recipients: string[], own: string) {
  if (!recipients.length) throw new MailRefusal("Digite pelo menos um destino.");
  if (recipients.length > FORWARD_RECIPIENTS_MAX) throw new MailRefusal(`Use até ${FORWARD_RECIPIENTS_MAX} destinos.`);
  if (recipients.includes(own)) throw new MailRefusal("O redirecionamento não pode mandar para ele mesmo.");
  const domains = await managedDomains();
  for (const [domain, { id }] of domains) {
    const inside = recipients.filter((r) => domainOf(r) === domain);
    if (!inside.length) continue;
    const taken = await takenLocals(id);
    const unknown = inside.filter((r) => !taken.has(localOf(r)));
    if (unknown.length) throw new MailRefusal(`${unknown.join(", ")} não existe. Crie a caixa antes ou corrija o endereço.`);
  }
}

const recipientSet = (recipients: string[]) => Object.fromEntries(recipients.map((r) => [r, true]));

export async function createForward(input: { domain: string; local: string; name: string | null; recipients: string[] }) {
  const problem = localPartProblem(input.local);
  if (problem) throw new MailRefusal(problem);
  const { id, companyId } = await managedDomain(input.domain);
  const address = `${input.local}@${input.domain}`;
  await checkRecipients(input.recipients, address);
  await ensureFree(id, input.local);
  const listId = await createOne("x:MailingList", {
    name: input.local,
    domainId: id,
    description: input.name,
    recipients: recipientSet(input.recipients),
    aliases: {},
  });
  return { id: listId, address, companyId };
}

export async function updateForward(forward: ForwardRow, input: { name: string | null; recipients: string[] }) {
  await checkRecipients(input.recipients, forward.address);
  // Sending the whole set replaces it: destinations taken out are gone.
  await updateOne("x:MailingList", forward.id, { description: input.name, recipients: recipientSet(input.recipients) });
}

export async function deleteForward(id: string) {
  await destroyOne("x:MailingList", id);
}

// DNS health ------------------------------------------------------------

const DNS_TTL = 3 * 60_000;
const dnsCache = new Map<string, { checkedAt: string; checks: DnsCheck[]; expires: number }>();

async function answer<T>(work: () => Promise<T[]>): Promise<DnsAnswer<T>> {
  try {
    const records = await work();
    return records.length ? { status: "found", records } : { status: "none" };
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return code === "ENOTFOUND" || code === "ENODATA" ? { status: "none" } : { status: "error" };
  }
}

/**
 * The domain's records as the internet sees them, compared with the zone
 * the server expects (`dnsZoneFile`). Kept for a few minutes: the page is
 * opened often and DNS changes take a while anyway.
 */
export async function dnsHealth(domain: string) {
  const { id } = await managedDomain(domain);
  // The cache comes after the check: a domain unlinked a minute ago is no longer shown.
  const cached = dnsCache.get(domain);
  if (cached && cached.expires > Date.now()) return cached;
  const [server] = await getObjects<{ id?: unknown; name?: unknown; dnsZoneFile?: unknown }>("x:Domain", [id], ["id", "name", "dnsZoneFile"]);
  const zone = text(server?.dnsZoneFile);
  if (!zone) throw new MailRefusal("O servidor de e-mail não informou os registros que espera para o domínio.");
  const expected = expectedDns(parseZoneFile(zone, domain), domain);
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  const names = dnsQuestions(expected);
  const [mx, ...txt] = await Promise.all([
    answer(() => resolver.resolveMx(domain)),
    ...names.map((name) => answer(() => resolver.resolveTxt(name))),
  ]);
  const result = {
    checkedAt: new Date().toISOString(),
    checks: compareDns(expected, { mx, txt: Object.fromEntries(names.map((name, i) => [name, txt[i]])) }),
    expires: Date.now() + DNS_TTL,
  };
  dnsCache.set(domain, result);
  return result;
}
