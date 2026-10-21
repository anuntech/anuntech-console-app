// The app's API, shared with mobile/: schemas only, no server code. The app
// imports this file for its typed client; the server implements it in
// procedures/ and serves it at /api/v1 (route in app/api/v1/[...rpc]).
import { oc } from "@orpc/contract";
import { z } from "zod";

const empty = z.object({}).strict().optional();
const pushToken = z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/);
const done = z.object({ ok: z.literal(true) });
const ticketId = z.object({ id: z.uuid() });
const status = z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]);
const option = z.object({ value: z.string(), label: z.string(), hint: z.string().optional() });
const ticketRow = z.object({
  id: z.string(),
  subject: z.string(),
  status,
  statusLabel: z.string(),
  kindLabel: z.string().nullable(),
  company: z.string(),
  engagement: z.string().nullable(),
  author: z.string(),
  assignee: z.string().nullable(),
  updatedAt: z.string(),
  due: z.object({ label: z.string(), late: z.boolean() }).nullable(),
});
const invoiceDisplay = z.enum(["issued", "overdue", "paid", "scheduled", "draft", "expired", "cancelled"]);
const money = z.object({ count: z.number(), cents: z.number() });
const invoiceRow = z.object({
  id: z.string(),
  description: z.string(),
  company: z.string(),
  amountCents: z.number(),
  display: invoiceDisplay,
  statusLabel: z.string(),
  dueDate: z.string(),
  /** Path of the public payment page (/pagar/<id>), when it can be paid or seen there. */
  payPath: z.string().nullable(),
});
const page = z.object({ page: z.number().int().min(1).max(10_000).default(1) });
const paged = { page: z.number(), pageCount: z.number(), showCompany: z.boolean() };
const projectRow = z.object({
  id: z.string(),
  name: z.string(),
  statusLabel: z.string(),
  company: z.string(),
  tasks: z.object({ total: z.number(), done: z.number() }),
  updatedAt: z.string(),
});
const projectTask = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  priorityLabel: z.string(),
  dueDate: z.string().nullable(),
  assignees: z.array(z.string()),
  comments: z.number(),
  files: z.number(),
  reviewDue: z.string().nullable(),
});
const documentRow = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  updatedAt: z.string(),
});
const ticketEntry = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    id: z.string(),
    body: z.string(),
    createdAt: z.string(),
    author: z.string(),
    authorImage: z.string().nullable(),
    staff: z.boolean(),
    mine: z.boolean(),
  }),
  z.object({
    kind: z.literal("file"),
    id: z.string(),
    name: z.string(),
    size: z.number(),
    mime: z.string().nullable(),
    createdAt: z.string(),
    author: z.string(),
    staff: z.boolean(),
    /** Path on the Console (/api/anexos/<id>); the app sends its session cookie. */
    href: z.string(),
  }),
]);

export const contract = {
  me: {
    /** Who is signed in and the companies they reach. */
    get: oc.input(empty).output(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        image: z.string().nullable(),
        phone: z.string().nullable(),
        staff: z.boolean(),
        owner: z.boolean(),
        companies: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            role: z.enum(["manager", "member"]),
          }),
        ),
      }),
    ),
  },
  account: {
    /** Sends a fresh code before deleting the account. */
    requestDeletion: oc
      .input(z.object({ channel: z.enum(["email", "whatsapp"]) }))
      .output(z.object({ challengeId: z.string(), destination: z.string() })),
    /** Deletes the account (see lib/account/account-deletion.ts). */
    delete: oc
      .input(
        z.object({
          challengeId: z.uuid(),
          code: z.string().regex(/^\d{6}$/),
          confirmation: z.string().max(40),
        }),
      )
      .output(z.object({ deleted: z.literal(true) })),
  },
  tickets: {
    /** The tickets the person sees, newest activity first (the team: nearest deadline first). */
    list: oc
      .input(
        z.object({
          status: z
            .enum(["active", "all", "open", "in_progress", "waiting_customer", "resolved", "closed"])
            .default("active"),
          search: z.string().max(160).default(""),
          page: z.number().int().min(1).max(10_000).default(1),
        }),
      )
      .output(
        z.object({
          rows: z.array(ticketRow),
          total: z.number(),
          page: z.number(),
          pageCount: z.number(),
          canCreate: z.boolean(),
          showCompany: z.boolean(),
        }),
      ),
    /** One ticket and its conversation. Out of reach answers NOT_FOUND. */
    get: oc.input(ticketId).output(
      z.object({
        id: z.string(),
        subject: z.string(),
        status,
        statusLabel: z.string(),
        kindLabel: z.string().nullable(),
        company: z.string(),
        engagement: z.string().nullable(),
        author: z.string(),
        assigneeName: z.string().nullable(),
        waitingFor: z.string().nullable(),
        createdAt: z.string(),
        canReply: z.boolean(),
        entries: z.array(ticketEntry),
      }),
    ),
    /** A written reply (attachments stay on the web for now). */
    reply: oc
      .input(z.object({ id: z.uuid(), body: z.string().trim().min(1).max(10000) }))
      .output(z.object({ ok: z.literal(true), message: z.string() })),
    /** What opening a ticket offers: companies, their products and services, kinds and impacts. */
    choices: oc.input(empty).output(
      z.object({
        companies: z.array(z.object({ id: z.string(), name: z.string() })),
        engagements: z.array(z.object({ id: z.string(), name: z.string(), companyId: z.string() })),
        kinds: z.array(option),
        impacts: z.array(option),
      }),
    ),
    /** Opens a ticket with the first message. */
    create: oc
      .input(
        z.object({
          companyId: z.uuid(),
          engagementId: z.union([z.uuid(), z.literal("")]).default(""),
          kind: z.enum(["problem", "question", "change", "access", "new_project"]),
          impact: z.enum(["down", "workaround", "other"]).optional(),
          subject: z.string().trim().min(1).max(160),
          body: z.string().trim().min(1).max(10000),
        }),
      )
      .output(z.object({ id: z.string() })),
  },
  finance: {
    /** Invoices of the person's finance companies (Administradores and the team; a Membro sees none). */
    list: oc
      .input(
        z.object({
          status: z.enum(["all", "issued", "overdue", "paid"]).default("all"),
          page: z.number().int().min(1).max(10_000).default(1),
        }),
      )
      .output(
        z.object({
          rows: z.array(invoiceRow),
          totals: z.object({ all: money, issued: money, overdue: money, paid: money }),
          page: z.number(),
          pageCount: z.number(),
          showCompany: z.boolean(),
        }),
      ),
    /** One invoice with what pays it: Pix copia e cola, the boleto line and its PDF. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      invoiceRow.extend({
        engagement: z.string().nullable(),
        pix: z.string().nullable(),
        boletoLine: z.string().nullable(),
        /** Path of the boleto PDF on the public payment page, when there is one. */
        boletoPath: z.string().nullable(),
      }),
    ),
  },
  projects: {
    /** The projects the person sees, with each board's progress. */
    list: oc.input(page).output(z.object({ rows: z.array(projectRow), ...paged })),
    /** One project's board, column by column. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        company: z.string(),
        statusLabel: z.string(),
        columns: z.array(z.object({ status: z.string(), label: z.string(), tasks: z.array(projectTask) })),
      }),
    ),
  },
  contracts: {
    /** Contracts of the person's finance companies (Administradores and the team). */
    list: oc.input(page).output(z.object({ rows: z.array(documentRow.extend({ kindLabel: z.string() })), ...paged })),
    /** The text that went out, who signed it and the PDF. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      documentRow.extend({
        kindLabel: z.string(),
        engagement: z.string().nullable(),
        body: z.string(),
        startsAt: z.string().nullable(),
        endsAt: z.string().nullable(),
        signatures: z.array(z.object({ party: z.string(), name: z.string(), signedAt: z.string() })),
        /** Path of the PDF on the Console; the app sends its session cookie. */
        pdfPath: z.string(),
      }),
    ),
  },
  quotes: {
    /** Quotes of the person's finance companies, with the figures that were sent. */
    list: oc.input(page).output(
      z.object({
        rows: z.array(documentRow.extend({ number: z.string(), totalCents: z.number(), validUntil: z.string().nullable() })),
        ...paged,
      }),
    ),
    /** One quote: its phases, figures, the answer if there is one, and the PDF. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      documentRow.extend({
        number: z.string(),
        validUntil: z.string().nullable(),
        totalCents: z.number(),
        hoursMin: z.number(),
        hoursMax: z.number(),
        decision: z.object({ party: z.string(), name: z.string(), note: z.string().nullable(), at: z.string() }).nullable(),
        pdfPath: z.string(),
      }),
    ),
  },
  bookmarks: {
    /** The person's folders and bookmarks (links, files and boards). */
    list: oc.input(z.object({ folder: z.string().max(64).default("all"), search: z.string().max(160).default("") })).output(
      z.object({
        folders: z.array(z.object({ id: z.string(), name: z.string(), company: z.string().nullable(), count: z.number() })),
        items: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            kind: z.enum(["link", "file", "board"]),
            url: z.string().nullable(),
            fileName: z.string().nullable(),
            /** Path to download the file (or the board's picture) with the session. */
            filePath: z.string().nullable(),
            folderId: z.string().nullable(),
          }),
        ),
      }),
    ),
  },
  overview: {
    /** The start screen: what waits for the person and what is due. */
    get: oc.input(empty).output(
      z.object({
        waiting: z.array(ticketRow),
        recent: z.array(ticketRow),
        toPay: z.array(invoiceRow),
        canFinance: z.boolean(),
      }),
    ),
  },
  devices: {
    /** This phone receives push notifications for the signed-in person. */
    register: oc
      .input(
        z.object({
          token: pushToken,
          platform: z.enum(["ios", "android"]),
          appVersion: z.string().max(40).optional(),
        }),
      )
      .output(done),
    /** Signing out: this phone stops receiving them. */
    unregister: oc.input(z.object({ token: pushToken })).output(done),
  },
};
export type Contract = typeof contract;
