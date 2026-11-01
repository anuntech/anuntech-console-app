import { createServer } from "node:http";

/**
 * A stand-in for the Stalwart server's JMAP management API (capability
 * urn:stalwart:jmap), enough for E-mail (lib/mail): the session, x:Domain
 * (read only, like the service account's role), x:Account and
 * x:MailingList (query, get, set). A real HTTP server, since the Console
 * calls it through fetch.
 *
 * It behaves like the real one where the Console relies on it: lists and
 * sets are objects, never arrays (an array is an invalidPatch); queries
 * page their ids; the password policy refuses weak secrets; secrets never
 * come back on get; and anything that would read a mailbox (Email/*,
 * Mailbox/*, Principal/*) is refused with accountNotFound, since the service
 * account has no impersonate. Every request must carry the service
 * account's Basic credentials, and every method call is recorded, so a
 * suite can check what the Console asked for.
 */
export async function startJmapMock({ user = "console-test", password = "test", pageSize = 4 } = {}) {
  const expected = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  const domains = new Map();
  const accounts = new Map();
  const lists = new Map();
  const calls = [];
  const requests = [];
  let seq = 0;
  let endpoint = "";
  const nextId = (prefix) => `${prefix}${++seq}`;
  const hasArray = (value) => Array.isArray(value) || (!!value && typeof value === "object" && Object.values(value).some(hasArray));
  const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  /** Passwords the policy refuses, standing in for zxcvbn below 3. */
  const weak = new Set(["senhafraca12345", "password123456", "anuntech2026!"]);
  const weakSecret = (secret) => typeof secret !== "string" || secret.length < 8 || secret.length > 128 || weak.has(secret.toLowerCase());

  function addDomain(name, { dnsZoneFile = "" } = {}) {
    const id = nextId("d");
    domains.set(id, { id, name, dnsZoneFile, createdAt: "2026-01-10T12:00:00Z" });
    return id;
  }
  const domainName = (id) => domains.get(id)?.name;
  function addAccount({ type = "User", name, domainId, description = null, role = "User", secret = "Inicial-Forte-2026", quota, used = 0, aliases = [], createdAt = "2026-03-02T12:00:00Z" }) {
    const id = nextId("a");
    accounts.set(id, {
      id,
      "@type": type,
      name,
      domainId,
      description,
      credentials: type === "User" ? { 0: { "@type": "Password", secret } } : {},
      roles: role === "Custom" ? { "@type": "Custom", roleIds: { r1: true } } : { "@type": role },
      permissions: { "@type": "Inherit" },
      quotas: quota ? { maxDiskQuota: quota } : {},
      usedDiskQuota: used,
      aliases: Object.fromEntries(aliases.map((alias, i) => [String(i), { name: alias.name ?? alias, domainId: alias.domainId ?? domainId, enable: alias.enable ?? true }])),
      memberGroupIds: {},
      encryptionAtRest: { "@type": "Disabled" },
      createdAt,
    });
    return id;
  }
  function addList({ name, domainId, description = null, recipients = [], aliases = [] }) {
    const id = nextId("l");
    lists.set(id, {
      id,
      name,
      domainId,
      description,
      recipients: Object.fromEntries(recipients.map((r) => [r, true])),
      aliases: Object.fromEntries(aliases.map((alias, i) => [String(i), { name: alias, domainId, enable: true }])),
    });
    return id;
  }

  const SERVER_SET = ["id", "emailAddress", "usedDiskQuota", "createdAt", "@type", "dnsZoneFile"];
  function computed(kind, object) {
    if (kind === "Domain") return object;
    return { ...object, emailAddress: `${object.name}@${domainName(object.domainId)}` };
  }
  function view(kind, object, properties) {
    const full = computed(kind, object);
    // Secrets are write-only, as on the real server.
    if (full.credentials) full.credentials = Object.fromEntries(Object.entries(full.credentials).map(([k, c]) => [k, { "@type": c["@type"] }]));
    if (!properties) return full;
    const out = { id: full.id };
    for (const key of properties) if (key in full) out[key] = full[key];
    return out;
  }

  /** A JMAP patch: "a/b/c" paths set or remove nested values; an array anywhere is refused. */
  function patch(object, changes) {
    const next = clone(object);
    for (const [path, value] of Object.entries(changes)) {
      if (hasArray(value)) return [null, { type: "invalidPatch", properties: [path] }];
      const parts = path.split("/");
      if (SERVER_SET.includes(parts[0])) return [null, { type: "invalidProperties", properties: [path] }];
      let target = next;
      for (const key of parts.slice(0, -1)) {
        if (target[key] === undefined || target[key] === null) target[key] = {};
        if (typeof target[key] !== "object") return [null, { type: "invalidPatch", properties: [path] }];
        target = target[key];
      }
      const last = parts.at(-1);
      // A property set to null keeps the property, empty; an entry of a map or list set to null goes away.
      if (value === null && parts.length > 1) delete target[last];
      else target[last] = clone(value);
    }
    return [next, null];
  }

  const taken = (domainId, name, exceptId) =>
    [...accounts.values(), ...lists.values()].some(
      (o) => o.id !== exceptId && ((o.domainId === domainId && o.name === name) || Object.values(o.aliases ?? {}).some((a) => a.domainId === domainId && a.name === name)),
    );

  function validAccount(account) {
    if (!account.name || !/^[a-z0-9._-]+$/.test(account.name)) return { type: "invalidProperties", properties: ["name"] };
    if (!domains.has(account.domainId)) return { type: "invalidProperties", properties: ["domainId"] };
    for (const [key, credential] of Object.entries(account.credentials ?? {}))
      if (credential["@type"] === "Password" && weakSecret(credential.secret))
        return { type: "invalidProperties", properties: [`credentials/${key}/secret`], description: "Password is too weak" };
    for (const alias of Object.values(account.aliases ?? {}))
      if (!alias.name || !domains.has(alias.domainId)) return { type: "invalidProperties", properties: ["aliases"] };
    return null;
  }

  function set(kind, store, args) {
    const result = { created: null, notCreated: null, updated: null, notUpdated: null, destroyed: null, notDestroyed: null };
    for (const [key, value] of Object.entries(args.create ?? {})) {
      if (hasArray(value)) {
        (result.notCreated ??= {})[key] = { type: "invalidPatch" };
        continue;
      }
      const object = { ...clone(value), id: nextId(kind === "Account" ? "a" : "l") };
      if (kind === "Account") {
        object.usedDiskQuota = 0;
        object.createdAt = new Date().toISOString();
        if (object.roles?.["@type"] !== "User") {
          (result.notCreated ??= {})[key] = { type: "forbidden" };
          continue;
        }
      }
      const problem = kind === "Account" ? validAccount(object) : !domains.has(object.domainId) ? { type: "invalidProperties", properties: ["domainId"] } : null;
      if (problem) {
        (result.notCreated ??= {})[key] = problem;
        continue;
      }
      if (taken(object.domainId, object.name)) {
        (result.notCreated ??= {})[key] = { type: "alreadyExists" };
        continue;
      }
      store.set(object.id, object);
      (result.created ??= {})[key] = { id: object.id };
    }
    for (const [id, changes] of Object.entries(args.update ?? {})) {
      const current = store.get(id);
      if (!current) {
        (result.notUpdated ??= {})[id] = { type: "notFound" };
        continue;
      }
      // The service account must hold every permission of the account it changes: no admins, no custom roles.
      if (kind === "Account" && current.roles?.["@type"] !== "User") {
        (result.notUpdated ??= {})[id] = { type: "forbidden" };
        continue;
      }
      const [next, problem] = patch(current, changes);
      const invalid = problem ?? (kind === "Account" ? validAccount(next) : null);
      if (invalid) {
        (result.notUpdated ??= {})[id] = invalid;
        continue;
      }
      store.set(id, next);
      (result.updated ??= {})[id] = null;
    }
    for (const id of args.destroy ?? []) {
      const current = store.get(id);
      if (!current) (result.notDestroyed ??= {})[id] = { type: "notFound" };
      else if (kind === "Account" && current.roles?.["@type"] !== "User") (result.notDestroyed ??= {})[id] = { type: "forbidden" };
      else {
        store.delete(id);
        (result.destroyed ??= []).push(id);
      }
    }
    return result;
  }

  function run(name, args, using) {
    const [kind, method] = name.replace(/^x:/, "").split("/");
    if (!name.startsWith("x:")) return ["error", { type: "accountNotFound" }];
    if (!using.includes("urn:stalwart:jmap")) return ["error", { type: "unknownMethod" }];
    const store = kind === "Domain" ? domains : kind === "Account" ? accounts : kind === "MailingList" ? lists : null;
    if (!store) return ["error", { type: "unknownMethod" }];
    if (method === "query") {
      let all = [...store.values()];
      if (args.filter?.domainId) all = all.filter((o) => o.domainId === args.filter.domainId);
      const position = Number(args.position) || 0;
      const ids = all.slice(position, position + pageSize).map((o) => o.id);
      return [name, { ids, position, ...(args.calculateTotal ? { total: all.length } : {}), queryState: "1", canCalculateChanges: false }];
    }
    if (method === "get") {
      const ids = args.ids ?? [...store.keys()];
      const list = ids.filter((id) => store.has(id)).map((id) => view(kind, store.get(id), args.properties));
      return [name, { state: "1", list, notFound: ids.filter((id) => !store.has(id)) }];
    }
    if (method === "set") {
      // The service account's role reads domains and nothing more.
      if (kind === "Domain") return ["error", { type: "forbidden" }];
      return [name, { oldState: "1", newState: "2", ...set(kind, store, args) }];
    }
    return ["error", { type: "unknownMethod" }];
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://jmap.local");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const send = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    requests.push({ method: req.method, path: url.pathname, authorized: req.headers.authorization === expected });
    if (req.headers.authorization !== expected) return send(401, { type: "about:blank", status: 401 });
    if (req.method === "GET" && url.pathname === "/jmap/session")
      return send(200, {
        capabilities: { "urn:ietf:params:jmap:core": { maxConcurrentRequests: 4, maxCallsInRequest: 16, maxObjectsInGet: 500 }, "urn:stalwart:jmap": {} },
        accounts: {},
        primaryAccounts: {},
        username: user,
        // Like Stalwart, the announced URLs are absolute.
        apiUrl: `${endpoint}/jmap/`,
        state: "1",
      });
    if (req.method === "POST" && url.pathname === "/jmap/") {
      const request = JSON.parse(body || "{}");
      const responses = [];
      for (const [name, args, callId] of request.methodCalls ?? []) {
        calls.push({ name, args: clone(args) });
        const [answerName, answer] = run(name, args ?? {}, request.using ?? []);
        responses.push([answerName, answer, callId]);
      }
      return send(200, { methodResponses: responses, sessionState: "1" });
    }
    send(404, { type: "notFound" });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${server.address().port}`;
  return {
    endpoint,
    user,
    password,
    domains,
    accounts,
    lists,
    calls,
    requests,
    addDomain,
    addAccount,
    addList,
    /** The account's current password, as the server would check it at sign-in. */
    secretOf: (id) => accounts.get(id)?.credentials?.[0]?.secret ?? null,
    find: (store, name, domainId) => [...store.values()].find((o) => o.name === name && o.domainId === domainId),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
