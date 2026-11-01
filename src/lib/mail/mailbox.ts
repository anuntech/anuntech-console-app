import "server-only";
import type { Actor } from "../access/access";
import { getAccountEmails } from "../account/account-identity";
import { accountIdFor, blobBytes, jmap, MailMethodError, USING } from "./jmap";
import { cleanEmailHtml, htmlToText, normalizeCid } from "./mail-html";
import {
  canOpenMailbox,
  folderName,
  isJmapId,
  MAIL_PAGE_SIZE,
  mailboxesFor,
  safeFileName,
  sortFolders,
  type Address,
  type MoveTarget,
} from "./mail-rules";

/*
 * The team's mailboxes over JMAP. Every function that touches a mailbox
 * takes the accountId from `openMailbox`, which checks the person first;
 * nothing here accepts an accountId from the browser.
 */

/** The person's own mailboxes, from the verified e-mails of the account. No call to the mail server. */
export async function mailboxesOf(actor: Actor) {
  if (!actor.admin) return [];
  const emails = await getAccountEmails(actor.user.id, actor.user.email);
  return mailboxesFor({ admin: true, emails });
}

export type OpenMailbox = { address: string; accountId: string };

/**
 * The mailbox at `address` if the person may open it and it exists on the
 * server; null otherwise, the same answer for both, so a refusal reads like
 * a mailbox that does not exist. `missing` tells the page apart only for the
 * person's own address.
 */
export async function openMailbox(actor: Actor, address: string): Promise<OpenMailbox | null> {
  const result = await mailboxAccess(actor, address);
  return result.status === "open" ? result.mailbox : null;
}

export async function mailboxAccess(
  actor: Actor,
  address: string,
): Promise<{ status: "denied" } | { status: "missing"; address: string } | { status: "open"; mailbox: OpenMailbox }> {
  if (!actor.admin) return { status: "denied" };
  const emails = await getAccountEmails(actor.user.id, actor.user.email);
  if (!canOpenMailbox({ admin: true, emails }, address)) return { status: "denied" };
  const normalized = address.trim().toLowerCase();
  const accountId = await accountIdFor(normalized);
  return accountId ? { status: "open", mailbox: { address: normalized, accountId } } : { status: "missing", address: normalized };
}

// Folders -----------------------------------------------------------------

type Mailbox = { id: string; name: string; role: string | null; parentId: string | null; sortOrder: number; totalEmails: number; unreadEmails: number };
export type FolderView = { id: string; name: string; role: string | null; unread: number; total: number };

async function mailboxes(accountId: string) {
  const result = await jmap(USING.mail, [
    ["Mailbox/get", { accountId, properties: ["id", "name", "role", "parentId", "sortOrder", "totalEmails", "unreadEmails"] }, "0"],
  ]);
  return result<{ list: Mailbox[] }>("0", "Mailbox/get").list.filter((m) => isJmapId(m.id));
}

export async function listFolders({ accountId }: OpenMailbox): Promise<FolderView[]> {
  return sortFolders(await mailboxes(accountId)).map((m) => ({
    id: m.id,
    name: folderName(m),
    role: m.role ?? null,
    unread: Number(m.unreadEmails) || 0,
    total: Number(m.totalEmails) || 0,
  }));
}

// Lists ------------------------------------------------------------------------

export type MessageRow = {
  id: string;
  from: Address[];
  to: Address[];
  subject: string;
  preview: string;
  receivedAt: string;
  seen: boolean;
  flagged: boolean;
  hasAttachment: boolean;
};

type EmailRecord = {
  id: string;
  blobId?: string;
  threadId?: string;
  mailboxIds?: Record<string, boolean>;
  keywords?: Record<string, boolean>;
  from?: Address[] | null;
  to?: Address[] | null;
  cc?: Address[] | null;
  bcc?: Address[] | null;
  replyTo?: Address[] | null;
  subject?: string | null;
  preview?: string;
  sentAt?: string | null;
  receivedAt?: string;
  hasAttachment?: boolean;
  messageId?: string[] | null;
  inReplyTo?: string[] | null;
  references?: string[] | null;
  textBody?: BodyPart[];
  htmlBody?: BodyPart[];
  attachments?: BodyPart[];
  bodyValues?: Record<string, { value: string; isTruncated?: boolean }>;
};
type BodyPart = { partId?: string | null; blobId?: string | null; size?: number; name?: string | null; type?: string; cid?: string | null; disposition?: string | null };

const addresses = (list: Address[] | null | undefined): Address[] =>
  (list ?? []).filter((a) => typeof a?.email === "string").map((a) => ({ name: a.name ?? null, email: a.email }));

/** One page of a folder, newest first, optionally filtered by text. */
export async function listMessages({ accountId }: OpenMailbox, folderId: string, { q, page }: { q: string; page: number }) {
  const filter: Record<string, unknown> = { inMailbox: folderId };
  if (q) filter.text = q;
  const result = await jmap(USING.mail, [
    [
      "Email/query",
      {
        accountId,
        filter,
        sort: [{ property: "receivedAt", isAscending: false }],
        position: (page - 1) * MAIL_PAGE_SIZE,
        limit: MAIL_PAGE_SIZE,
        calculateTotal: true,
      },
      "0",
    ],
    [
      "Email/get",
      {
        accountId,
        "#ids": { resultOf: "0", name: "Email/query", path: "/ids" },
        properties: ["id", "from", "to", "subject", "preview", "receivedAt", "keywords", "hasAttachment"],
      },
      "1",
    ],
  ]);
  const query = result<{ ids: string[]; total?: number }>("0", "Email/query");
  const byId = new Map(result<{ list: EmailRecord[] }>("1", "Email/get").list.map((e) => [e.id, e]));
  const rows: MessageRow[] = query.ids.flatMap((id) => {
    const e = byId.get(id);
    if (!e) return [];
    return [
      {
        id: e.id,
        from: addresses(e.from),
        to: addresses(e.to),
        subject: e.subject ?? "",
        preview: e.preview ?? "",
        receivedAt: e.receivedAt ?? "",
        seen: !!e.keywords?.$seen,
        flagged: !!e.keywords?.$flagged,
        hasAttachment: !!e.hasAttachment,
      },
    ];
  });
  return { rows, total: Number(query.total) || rows.length };
}

// Reading ------------------------------------------------------------------------

export type AttachmentView = { blobId: string; name: string; type: string; size: number };
export type MessageView = {
  id: string;
  from: Address[];
  to: Address[];
  cc: Address[];
  bcc: Address[];
  replyTo: Address[];
  subject: string;
  sentAt: string | null;
  receivedAt: string;
  seen: boolean;
  flagged: boolean;
  mailboxIds: string[];
  /** Cleaned on the server (mail-html.ts); null for a text-only message. */
  html: string | null;
  remoteImages: boolean;
  text: string | null;
  truncated: boolean;
  attachments: AttachmentView[];
  /** The text a reply or forward quotes. */
  quote: string;
  messageId: string[];
  references: string[];
};

/** Inline images the server turns into data: URIs, all of them together. */
const INLINE_BUDGET = 1024 * 1024;
const INLINE_TYPES = /^image\/(png|jpe?g|gif|webp)$/i;

/**
 * One message, cleaned for the reading pane; marked as read when it was not.
 * Null when the account has no such message.
 */
export async function readMessage({ accountId }: OpenMailbox, id: string): Promise<MessageView | null> {
  const result = await jmap(USING.mail, [
    [
      "Email/get",
      {
        accountId,
        ids: [id],
        properties: [
          "id", "mailboxIds", "keywords", "from", "to", "cc", "bcc", "replyTo", "subject", "sentAt", "receivedAt",
          "messageId", "references", "textBody", "htmlBody", "attachments", "bodyValues",
        ],
        bodyProperties: ["partId", "blobId", "size", "name", "type", "cid", "disposition"],
        fetchTextBodyValues: true,
        fetchHTMLBodyValues: true,
        maxBodyValueBytes: 2_000_000,
      },
      "0",
    ],
  ]);
  const email = result<{ list: EmailRecord[] }>("0", "Email/get").list.find((e) => e.id === id);
  if (!email) return null;
  const values = email.bodyValues ?? {};
  const join = (parts: BodyPart[] | undefined, type: string) => {
    const chosen = (parts ?? []).filter((p) => p.type?.toLowerCase() === type && p.partId && values[p.partId]);
    return chosen.length ? chosen.map((p) => values[p.partId!].value).join("\n") : null;
  };
  const rawHtml = join(email.htmlBody, "text/html");
  const text = join(email.textBody, "text/plain");
  const truncated = Object.values(values).some((v) => v.isTruncated);

  // cid: images referenced by the HTML become data: URIs, small ones first, up to 1 MB in all.
  const inline: Record<string, string> = {};
  const inlined = new Set<string>();
  const parts = email.attachments ?? [];
  if (rawHtml) {
    let budget = INLINE_BUDGET;
    const referenced = new Set([...rawHtml.matchAll(/cid:([^"'\s)>]+)/gi)].map((m) => normalizeCid(m[1])));
    const candidates = parts
      .filter((p) => p.cid && p.blobId && INLINE_TYPES.test(p.type ?? "") && referenced.has(normalizeCid(p.cid)))
      .sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
    for (const part of candidates) {
      if ((part.size ?? 0) > budget) continue;
      const bytes = await blobBytes(accountId, part.blobId!, budget).catch(() => null);
      if (!bytes) continue;
      budget -= bytes.length;
      inline[normalizeCid(part.cid!)] = `data:${part.type!.toLowerCase()};base64,${bytes.toString("base64")}`;
      inlined.add(part.blobId!);
    }
  }
  const cleaned = rawHtml ? cleanEmailHtml(rawHtml, inline) : null;
  const seen = !!email.keywords?.$seen;
  if (!seen) await setKeyword({ address: "", accountId }, id, "$seen", true).catch(() => {});
  return {
    id: email.id,
    from: addresses(email.from),
    to: addresses(email.to),
    cc: addresses(email.cc),
    bcc: addresses(email.bcc),
    replyTo: addresses(email.replyTo),
    subject: email.subject ?? "",
    sentAt: email.sentAt ?? null,
    receivedAt: email.receivedAt ?? "",
    seen: true,
    flagged: !!email.keywords?.$flagged,
    mailboxIds: Object.keys(email.mailboxIds ?? {}).filter((key) => email.mailboxIds![key]),
    html: cleaned?.html ?? null,
    remoteImages: cleaned?.remoteImages ?? false,
    text,
    truncated,
    attachments: parts
      .filter((p) => p.blobId && isJmapId(p.blobId) && !inlined.has(p.blobId))
      .map((p) => ({ blobId: p.blobId!, name: safeFileName(p.name), type: p.type || "application/octet-stream", size: Number(p.size) || 0 })),
    quote: text ?? (rawHtml ? htmlToText(rawHtml) : ""),
    messageId: (email.messageId ?? []).filter((m) => typeof m === "string").slice(0, 1),
    references: (email.references ?? []).filter((m) => typeof m === "string").slice(-20),
  };
}

// Changes -----------------------------------------------------------------------

async function updateEmail(accountId: string, id: string, patch: Record<string, unknown>) {
  const result = await jmap(USING.mail, [["Email/set", { accountId, update: { [id]: patch } }, "0"]]);
  const answer = result<{ updated?: Record<string, unknown> | null; notUpdated?: Record<string, { type?: string }> | null }>("0", "Email/set");
  if (!answer.updated || !(id in answer.updated)) throw new MailMethodError("Email/set", answer.notUpdated?.[id]?.type ?? "notUpdated");
}

/** Read or unread ($seen), starred or not ($flagged). */
export async function setKeyword({ accountId }: OpenMailbox, id: string, keyword: "$seen" | "$flagged", value: boolean) {
  await updateEmail(accountId, id, { [`keywords/${keyword}`]: value ? true : null });
}

/** The folder with a role; Arquivo is created the first time someone archives. */
async function folderWithRole(accountId: string, role: MoveTarget) {
  const found = (await mailboxes(accountId)).find((m) => m.role === role);
  if (found) return found.id;
  if (role !== "archive") throw new MailMethodError("Mailbox/get", "noRole");
  const result = await jmap(USING.mail, [["Mailbox/set", { accountId, create: { archive: { name: "Arquivo", role: "archive" } } }, "0"]]);
  const created = result<{ created?: Record<string, { id: string }> | null }>("0", "Mailbox/set").created?.archive?.id;
  if (!created) throw new MailMethodError("Mailbox/set", "notCreated");
  return created;
}

/** Moves a message into one folder (it leaves all the others). */
export async function moveMessage({ accountId }: OpenMailbox, id: string, target: MoveTarget) {
  const folder = await folderWithRole(accountId, target);
  await updateEmail(accountId, id, { mailboxIds: { [folder]: true } });
}

/** Deletes a message for good, only from the Lixeira. False when it is not there. */
export async function destroyFromTrash({ accountId }: OpenMailbox, id: string) {
  const all = await mailboxes(accountId);
  const trash = all.find((m) => m.role === "trash");
  const result = await jmap(USING.mail, [["Email/get", { accountId, ids: [id], properties: ["mailboxIds"] }, "0"]]);
  const email = result<{ list: EmailRecord[] }>("0", "Email/get").list.find((e) => e.id === id);
  if (!trash || !email?.mailboxIds?.[trash.id]) return false;
  const destroyed = await jmap(USING.mail, [["Email/set", { accountId, destroy: [id] }, "0"]]);
  const answer = destroyed<{ destroyed?: string[] | null }>("0", "Email/set");
  return !!answer.destroyed?.includes(id);
}

/** The original's attachments, to forward them again (their blobIds stay in the account). */
export async function attachmentsOf({ accountId }: OpenMailbox, id: string) {
  const result = await jmap(USING.mail, [
    ["Email/get", { accountId, ids: [id], properties: ["attachments"], bodyProperties: ["blobId", "size", "name", "type"] }, "0"],
  ]);
  const email = result<{ list: EmailRecord[] }>("0", "Email/get").list.find((e) => e.id === id);
  return (email?.attachments ?? [])
    .filter((p) => p.blobId && isJmapId(p.blobId))
    .map((p) => ({ blobId: p.blobId!, name: safeFileName(p.name), type: p.type || "application/octet-stream", size: Number(p.size) || 0 }));
}

// Sending -------------------------------------------------------------------------

export type Outgoing = {
  fromName: string;
  to: Address[];
  cc: Address[];
  bcc: Address[];
  subject: string;
  body: string;
  inReplyTo: string[];
  references: string[];
  attachments: AttachmentView[];
};

/** The identity that sends as the mailbox's address, created the first time. */
async function identityFor(accountId: string, address: string, name: string) {
  const result = await jmap(USING.submission, [["Identity/get", { accountId }, "0"]]);
  const list = result<{ list: { id: string; email: string }[] }>("0", "Identity/get").list;
  const found = list.find((i) => i.email?.toLowerCase() === address);
  if (found) return found.id;
  const created = await jmap(USING.submission, [["Identity/set", { accountId, create: { me: { name, email: address } } }, "0"]]);
  const id = created<{ created?: Record<string, { id: string }> | null }>("0", "Identity/set").created?.me?.id;
  if (!id) throw new MailMethodError("Identity/set", "notCreated");
  return id;
}

/**
 * Sends a message from the mailbox: the e-mail is created in Rascunhos (or
 * Enviados) and submitted in the same request; on success the server moves
 * it to Enviados and drops $draft. Returns the new e-mail's id.
 */
export async function sendMessage({ accountId, address }: OpenMailbox, message: Outgoing) {
  const all = await mailboxes(accountId);
  const sent = all.find((m) => m.role === "sent");
  const drafts = all.find((m) => m.role === "drafts");
  if (!sent) throw new MailMethodError("Mailbox/get", "noSent");
  const identityId = await identityFor(accountId, address, message.fromName);
  const start = drafts ?? sent;
  const email: Record<string, unknown> = {
    mailboxIds: { [start.id]: true },
    keywords: { $draft: true, $seen: true },
    from: [{ name: message.fromName, email: address }],
    to: message.to,
    subject: message.subject,
    textBody: [{ partId: "text", type: "text/plain" }],
    bodyValues: { text: { value: message.body } },
  };
  if (message.cc.length) email.cc = message.cc;
  if (message.bcc.length) email.bcc = message.bcc;
  if (message.inReplyTo.length) email.inReplyTo = message.inReplyTo;
  if (message.references.length) email.references = message.references;
  if (message.attachments.length)
    email.attachments = message.attachments.map((a) => ({ blobId: a.blobId, type: a.type, name: a.name, disposition: "attachment" }));
  const onSuccess: Record<string, unknown> = { "keywords/$draft": null };
  if (start.id !== sent.id) {
    onSuccess[`mailboxIds/${start.id}`] = null;
    onSuccess[`mailboxIds/${sent.id}`] = true;
  }
  const result = await jmap(
    USING.submission,
    [
      ["Email/set", { accountId, create: { draft: email } }, "0"],
      [
        "EmailSubmission/set",
        { accountId, create: { send: { identityId, emailId: "#draft" } }, onSuccessUpdateEmail: { "#send": onSuccess } },
        "1",
      ],
    ],
    { idempotent: false },
  );
  const created = result<{ created?: Record<string, { id: string }> | null; notCreated?: Record<string, { type?: string }> | null }>("0", "Email/set");
  const emailId = created.created?.draft?.id;
  if (!emailId) throw new MailMethodError("Email/set", created.notCreated?.draft?.type ?? "notCreated");
  const submission = result<{ created?: Record<string, { id: string }> | null; notCreated?: Record<string, { type?: string }> | null }>(
    "1",
    "EmailSubmission/set",
  );
  if (!submission.created?.send) {
    // The message stays in Rascunhos for the person to see; nothing went out.
    throw new MailMethodError("EmailSubmission/set", submission.notCreated?.send?.type ?? "notCreated");
  }
  return emailId;
}
