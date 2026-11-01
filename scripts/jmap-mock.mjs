import { createServer } from "node:http";

/**
 * A stand-in for the Stalwart mail server's JMAP API (RFC 8620/8621), enough
 * for the Console's webmail (lib/mail): the session, principals, mailboxes,
 * e-mails (query, get, set), identities, submissions, uploads and downloads.
 * A real HTTP server, since the Console calls it through fetch. Every request
 * must carry the service account's Basic credentials, and every method call
 * is recorded with its accountId, so a suite can check that a mailbox outside
 * the person's access was never touched.
 */
export async function startJmapMock({ user = "console-test", password = "test" } = {}) {
  const expected = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  const adminAccount = "admin";
  /** accountId → { email, mailboxes: Map, emails: Map, identities: Map, blobs: Map } */
  const accounts = new Map();
  const calls = [];
  const submissions = [];
  let seq = 0;
  const nextId = (prefix) => `${prefix}${++seq}`;
  let endpoint = "";

  function addAccount(email) {
    const id = nextId("acc");
    const mailboxes = new Map();
    for (const [name, role] of [
      ["Inbox", "inbox"],
      ["Drafts", "drafts"],
      ["Sent Items", "sent"],
      ["Junk Mail", "junk"],
      ["Deleted Items", "trash"],
      ["Projetos", null],
    ]) {
      const mid = nextId("mb");
      mailboxes.set(mid, { id: mid, name, role, parentId: null, sortOrder: 0 });
    }
    accounts.set(id, { id, email, mailboxes, emails: new Map(), identities: new Map(), blobs: new Map() });
    return id;
  }
  const account = (id) => accounts.get(id);
  const roleOf = (accountId, role) => [...account(accountId).mailboxes.values()].find((m) => m.role === role)?.id;
  function addBlob(accountId, bytes, type) {
    const blobId = nextId("blob");
    account(accountId).blobs.set(blobId, { bytes: Buffer.from(bytes), type });
    return blobId;
  }

  /** A received message: `parts` of text, HTML and attachments, stored as blobs. */
  function addEmail(accountId, { role = "inbox", from, to = [], cc = [], subject, text, html, attachments = [], keywords = {}, receivedAt = new Date().toISOString(), messageId }) {
    const id = nextId("m");
    const textBody = [];
    const htmlBody = [];
    const bodyValues = {};
    if (text !== undefined) {
      bodyValues.t = { value: text, isEncodingProblem: false, isTruncated: false };
      textBody.push({ partId: "t", blobId: addBlob(accountId, text, "text/plain"), type: "text/plain", size: Buffer.byteLength(text) });
    }
    if (html !== undefined) {
      bodyValues.h = { value: html, isEncodingProblem: false, isTruncated: false };
      htmlBody.push({ partId: "h", blobId: addBlob(accountId, html, "text/html"), type: "text/html", size: Buffer.byteLength(html) });
    }
    if (!textBody.length) textBody.push(...htmlBody);
    const files = attachments.map((file, index) => ({
      partId: `a${index}`,
      blobId: addBlob(accountId, file.bytes, file.type),
      name: file.name,
      type: file.type,
      size: Buffer.byteLength(file.bytes),
      cid: file.cid ?? null,
      disposition: file.cid ? "inline" : "attachment",
    }));
    account(accountId).emails.set(id, {
      id,
      mailboxIds: { [roleOf(accountId, role)]: true },
      keywords: { ...keywords },
      from,
      to,
      cc,
      bcc: [],
      replyTo: null,
      subject,
      sentAt: receivedAt,
      receivedAt,
      messageId: [messageId ?? `${id}@mock.invalid`],
      inReplyTo: null,
      references: null,
      textBody,
      htmlBody: htmlBody.length ? htmlBody : textBody,
      attachments: files,
      bodyValues,
      preview: (text ?? "").slice(0, 120),
      hasAttachment: files.some((f) => !f.cid),
    });
    return { id, attachments: files };
  }

  function view(email, args) {
    const props = args.properties ?? Object.keys(email);
    // The id always comes back (RFC 8620 §5.1).
    const out = { id: email.id };
    for (const key of props) if (key !== "bodyValues") out[key] = email[key] ?? null;
    if (args.fetchTextBodyValues || args.fetchHTMLBodyValues || args.fetchAllBodyValues) out.bodyValues = email.bodyValues;
    return out;
  }

  function patch(email, changes, mailboxesOf) {
    for (const [path, value] of Object.entries(changes)) {
      if (path === "mailboxIds" || path === "keywords") {
        email[path] = { ...value };
        continue;
      }
      const [field, key] = path.split("/");
      if (field !== "mailboxIds" && field !== "keywords") return { type: "invalidProperties" };
      if (field === "mailboxIds" && value && !mailboxesOf.has(key)) return { type: "invalidProperties" };
      if (value === null) delete email[field][key];
      else email[field][key] = value;
    }
    return null;
  }

  function resolveRefs(args, responses) {
    const out = {};
    for (const [key, value] of Object.entries(args)) {
      if (!key.startsWith("#")) {
        out[key] = value;
        continue;
      }
      const source = responses.find((r) => r[2] === value.resultOf && r[0] === value.name);
      out[key.slice(1)] = source ? source[1][value.path.replace(/^\//, "")] : [];
    }
    return out;
  }

  function run(name, args, created) {
    const acc = account(args.accountId);
    if (!acc && args.accountId !== adminAccount) return ["error", { type: "accountNotFound" }];
    switch (name) {
      case "Principal/query": {
        if (args.accountId !== adminAccount) return ["error", { type: "forbidden" }];
        const wanted = String(args.filter?.email ?? "").toLowerCase();
        const ids = [...accounts.values()].filter((a) => a.email.toLowerCase() === wanted).map((a) => a.id);
        return [name, { accountId: adminAccount, ids, total: ids.length, position: 0 }];
      }
      case "Principal/get": {
        const list = (args.ids ?? []).map((id) => account(id)).filter(Boolean).map((a) => ({ id: a.id, email: a.email, type: "individual", name: a.email }));
        return [name, { accountId: adminAccount, list, notFound: [] }];
      }
      case "Mailbox/get": {
        const list = [...acc.mailboxes.values()].map((m) => {
          const inside = [...acc.emails.values()].filter((e) => e.mailboxIds[m.id]);
          return { ...m, totalEmails: inside.length, unreadEmails: inside.filter((e) => !e.keywords.$seen).length };
        });
        return [name, { accountId: acc.id, state: "1", list, notFound: [] }];
      }
      case "Mailbox/set": {
        const out = {};
        for (const [key, value] of Object.entries(args.create ?? {})) {
          const id = nextId("mb");
          acc.mailboxes.set(id, { id, name: value.name, role: value.role ?? null, parentId: null, sortOrder: 0 });
          out[key] = { id };
        }
        return [name, { accountId: acc.id, created: out }];
      }
      case "Email/query": {
        const text = String(args.filter?.text ?? "").toLowerCase();
        const list = [...acc.emails.values()]
          .filter((e) => !args.filter?.inMailbox || e.mailboxIds[args.filter.inMailbox])
          .filter((e) => !text || [e.subject, e.bodyValues.t?.value, e.bodyValues.h?.value, ...(e.from ?? []).map((a) => a.email)].join(" ").toLowerCase().includes(text))
          .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
        const position = args.position ?? 0;
        const ids = list.slice(position, position + (args.limit ?? 50)).map((e) => e.id);
        return [name, { accountId: acc.id, ids, position, total: list.length }];
      }
      case "Email/get": {
        const list = (args.ids ?? []).map((id) => acc.emails.get(id)).filter(Boolean).map((e) => view(e, args));
        return [name, { accountId: acc.id, state: "1", list, notFound: (args.ids ?? []).filter((id) => !acc.emails.has(id)) }];
      }
      case "Email/set": {
        const result = { accountId: acc.id, created: null, updated: null, destroyed: null, notCreated: null, notUpdated: null, notDestroyed: null };
        for (const [key, value] of Object.entries(args.create ?? {})) {
          const missing = (value.attachments ?? []).find((a) => !acc.blobs.has(a.blobId));
          if (missing || !Object.keys(value.mailboxIds ?? {}).every((m) => acc.mailboxes.has(m))) {
            (result.notCreated ??= {})[key] = { type: missing ? "blobNotFound" : "invalidProperties" };
            continue;
          }
          const id = nextId("m");
          const body = value.bodyValues?.text?.value ?? "";
          acc.emails.set(id, {
            id,
            mailboxIds: { ...value.mailboxIds },
            keywords: { ...value.keywords },
            from: value.from,
            to: value.to ?? [],
            cc: value.cc ?? [],
            bcc: value.bcc ?? [],
            replyTo: null,
            subject: value.subject,
            sentAt: new Date().toISOString(),
            receivedAt: new Date().toISOString(),
            messageId: [`${id}@mock.invalid`],
            inReplyTo: value.inReplyTo ?? null,
            references: value.references ?? null,
            textBody: [{ partId: "t", type: "text/plain", size: body.length }],
            htmlBody: [{ partId: "t", type: "text/plain", size: body.length }],
            attachments: (value.attachments ?? []).map((a) => ({ ...a, size: acc.blobs.get(a.blobId).bytes.length })),
            bodyValues: { t: { value: body } },
            preview: body.slice(0, 120),
            hasAttachment: !!value.attachments?.length,
          });
          created[`#${key}`] = id;
          (result.created ??= {})[key] = { id };
        }
        for (const [id, changes] of Object.entries(args.update ?? {})) {
          const email = acc.emails.get(id);
          const problem = email ? patch(email, changes, acc.mailboxes) : { type: "notFound" };
          if (problem) (result.notUpdated ??= {})[id] = problem;
          else (result.updated ??= {})[id] = null;
        }
        for (const id of args.destroy ?? []) {
          if (acc.emails.delete(id)) (result.destroyed ??= []).push(id);
          else (result.notDestroyed ??= {})[id] = { type: "notFound" };
        }
        return [name, result];
      }
      case "Identity/get":
        return [name, { accountId: acc.id, list: [...acc.identities.values()], notFound: [] }];
      case "Identity/set": {
        const out = {};
        for (const [key, value] of Object.entries(args.create ?? {})) {
          if (value.email.toLowerCase() !== acc.email.toLowerCase()) continue;
          const id = nextId("id");
          acc.identities.set(id, { id, name: value.name, email: value.email });
          out[key] = { id };
        }
        return [name, { accountId: acc.id, created: out }];
      }
      case "EmailSubmission/set": {
        const result = { accountId: acc.id, created: null, notCreated: null };
        for (const [key, value] of Object.entries(args.create ?? {})) {
          const emailId = value.emailId.startsWith("#") ? created[value.emailId] : value.emailId;
          const email = acc.emails.get(emailId);
          const identity = acc.identities.get(value.identityId);
          if (!email || !identity) {
            (result.notCreated ??= {})[key] = { type: "invalidProperties" };
            continue;
          }
          const id = nextId("sub");
          submissions.push({ accountId: acc.id, emailId, identity: identity.email, from: email.from, to: email.to, cc: email.cc, bcc: email.bcc, subject: email.subject });
          (result.created ??= {})[key] = { id };
          const update = args.onSuccessUpdateEmail?.[`#${key}`];
          if (update) patch(email, update, acc.mailboxes);
        }
        return [name, result];
      }
      default:
        return ["error", { type: "unknownMethod" }];
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://jmap.local");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const send = (status, data, headers = { "Content-Type": "application/json" }) => {
      res.writeHead(status, headers);
      res.end(typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data));
    };
    if (req.headers.authorization !== expected) return send(401, { type: "about:blank", status: 401 });
    if (req.method === "GET" && url.pathname === "/jmap/session")
      return send(200, {
        capabilities: { "urn:ietf:params:jmap:core": { maxConcurrentRequests: 4, maxCallsInRequest: 16 } },
        accounts: { [adminAccount]: { name: user, isPersonal: true } },
        primaryAccounts: { "urn:ietf:params:jmap:principals": adminAccount, "urn:ietf:params:jmap:mail": adminAccount },
        username: user,
        // Like Stalwart, the announced URLs are absolute.
        apiUrl: `${endpoint}/jmap/`,
        downloadUrl: `${endpoint}/jmap/download/{accountId}/{blobId}/{name}?accept={type}`,
        uploadUrl: `${endpoint}/jmap/upload/{accountId}/`,
        eventSourceUrl: `${endpoint}/jmap/eventsource`,
        state: "1",
      });
    if (req.method === "POST" && url.pathname === "/jmap/") {
      const request = JSON.parse(body.toString() || "{}");
      const responses = [];
      const created = {};
      for (const [name, rawArgs, callId] of request.methodCalls ?? []) {
        const args = resolveRefs(rawArgs, responses);
        calls.push({ name, accountId: args.accountId, args });
        const [answerName, answer] = run(name, args, created);
        responses.push([answerName, answer, callId]);
      }
      return send(200, { methodResponses: responses, sessionState: "1" });
    }
    const upload = /^\/jmap\/upload\/([^/]+)\/$/.exec(url.pathname);
    if (req.method === "POST" && upload) {
      const accountId = decodeURIComponent(upload[1]);
      calls.push({ name: "upload", accountId });
      if (!account(accountId)) return send(404, { type: "accountNotFound" });
      const type = String(req.headers["content-type"] ?? "application/octet-stream");
      const blobId = addBlob(accountId, body, type);
      return send(201, { accountId, blobId, type, size: body.length });
    }
    const download = /^\/jmap\/download\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && download) {
      const accountId = decodeURIComponent(download[1]);
      calls.push({ name: "download", accountId });
      const blob = account(accountId)?.blobs.get(decodeURIComponent(download[2]));
      if (!blob) return send(404, { type: "notFound" });
      return send(200, blob.bytes, { "Content-Type": blob.type, "Content-Length": String(blob.bytes.length) });
    }
    send(404, { type: "notFound" });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${server.address().port}`;
  return {
    endpoint,
    user,
    password,
    accounts,
    calls,
    submissions,
    addAccount,
    addEmail,
    roleOf,
    email: (accountId, id) => account(accountId)?.emails.get(id),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
