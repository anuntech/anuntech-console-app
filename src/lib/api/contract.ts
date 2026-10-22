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
const party = z.enum(["client", "anuntech"]);
const contractKind = z.enum(["contract", "amendment"]);
const contractTerm = z.object({
  state: z.enum(["none", "upcoming", "active", "expiring", "expired"]),
  /** "Vence em 12 dias", "Vencido há 3 dias", "Começa em 5 dias"; null when there is nothing to say. */
  label: z.string().nullable(),
});
const changeRequest = z.object({
  id: z.string(),
  version: z.number(),
  blockIndex: z.number(),
  /** "Cláusula 3.2", "Contratante", "Parágrafo", and the text it had when asked. */
  label: z.string(),
  excerpt: z.string(),
  comment: z.string(),
  proposedText: z.string().nullable(),
  status: z.enum(["draft", "pending", "accepted", "declined"]),
  statusLabel: z.string(),
  /** The proposed text went into the next version. */
  applied: z.boolean(),
  /** Anuntech's answer. */
  response: z.string().nullable(),
  author: z.string(),
  createdAt: z.string(),
  submittedAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
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

/** A person's picture: an illustration of the catalog, an uploaded photo (path served with the session) or initials. */
const avatar = z.object({
  kind: z.enum(["illustration", "photo", "initials"]),
  /** Path on the Console: /brand/avatars/<n>.svg, /api/conta/foto?v=… or /api/pessoas/<id>/foto?v=… */
  path: z.string().nullable(),
  /** Background of an illustration. */
  color: z.string().nullable(),
});
const message = z.object({ message: z.string() });
const sixDigits = z.string().regex(/^\d{6}$/);
const companyAddress = z.object({
  cep: z.string().max(9),
  endereco: z.string().max(100),
  numero: z.string().max(10),
  complemento: z.string().max(30),
  bairro: z.string().max(60),
  cidade: z.string().max(60),
  uf: z.string().max(2),
  codigoMunicipio: z.string().max(7),
});
const memberScope = z.object({ access: z.enum(["all", "selected"]), ids: z.array(z.uuid()).max(500) });
const noticeTopic = z.enum(["billing", "tickets"]);

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
        avatar,
        /** Two-step verification on: e-mail and WhatsApp are locked until it is turned off. */
        twoFactorEnabled: z.boolean(),
        twoStepChannel: z.enum(["email", "whatsapp"]),
        /** Signed in less than 10 minutes ago: contact changes are allowed. */
        recentSignIn: z.boolean(),
        /** Manages exactly one company: Dados da empresa, Membros and Notificações apply to it. */
        managedCompanyId: z.string().nullable(),
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
        /** The viewer approves deliveries in Revisão (a client company's Administrador). */
        canReview: z.boolean(),
      }),
    ),
    /** Approves a delivery in Revisão, or sends it back with what did not work. */
    reviewTask: oc
      .input(z.object({ id: z.uuid(), decision: z.enum(["approve", "problem"]), note: z.string().max(5000).default("") }))
      .output(message),
  },
  contracts: {
    /** Contracts of the person's finance companies (Administradores and the team), by situation and a search on title and company. */
    list: oc
      .input(
        page.extend({
          status: z.enum(["all", "sent", "in_review", "signed"]).default("all"),
          search: z.string().max(160).default(""),
        }),
      )
      .output(
        z.object({
          rows: z.array(
            documentRow.extend({
              kind: contractKind,
              kindLabel: z.string(),
              /** The contract an amendment changes ("Aditivo de …"). */
              parentTitle: z.string().nullable(),
              /** Who signed the version on screen, while signatures are collected. */
              signedBy: z.array(party),
              startsAt: z.string().nullable(),
              endsAt: z.string().nullable(),
              /** A signed contract near or past its end ("Vence em 12 dias", "Vencido há 3 dias"); null otherwise. */
              term: contractTerm.nullable(),
            }),
          ),
          ...paged,
        }),
      ),
    /** The text that went out, who signed it, the PDF, the review rounds, versions and amendments. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      documentRow.extend({
        kind: contractKind,
        kindLabel: z.string(),
        engagement: z.string().nullable(),
        body: z.string(),
        startsAt: z.string().nullable(),
        endsAt: z.string().nullable(),
        /** Where a signed contract stands against its dates (starts, expiring, expired). */
        term: contractTerm.nullable(),
        signatures: z.array(z.object({ party: z.string(), name: z.string(), signedAt: z.string() })),
        /** Path of the PDF on the Console; the app sends its session cookie. */
        pdfPath: z.string(),
        /** SHA-256 of the text that went out (null for a draft) and its version. */
        documentHash: z.string().nullable(),
        version: z.number().nullable(),
        /** When this version was sent, and the template it came from. */
        sentAt: z.string().nullable(),
        template: z.string().nullable(),
        /** The client company's CPF or CNPJ, digits only, as the signature block shows it. */
        companyDocument: z.string().nullable(),
        /** The viewer's side: a client Administrador signs for the company, the team for Anuntech. */
        party: z.enum(["client", "anuntech"]).nullable(),
        canSign: z.boolean(),
        /**
         * The text as blocks: `index` is what a change request names (null for
         * a block the new version removed), `change` marks what changed since
         * `previousVersion`.
         */
        blocks: z.array(
          z.object({
            index: z.number().nullable(),
            type: z.enum(["title", "heading", "party", "clause", "paragraph"]),
            number: z.string().nullable(),
            label: z.string().nullable(),
            text: z.string(),
            change: z.enum(["same", "added", "removed"]),
            requestable: z.boolean(),
          }),
        ),
        previousVersion: z.number().nullable(),
        review: z.object({
          /** The viewer can ask for changes now: the client's side, sent and not signed by it yet. */
          canRequest: z.boolean(),
          /** Requests on the version shown; drafts only reach the client's side. */
          requests: z.array(changeRequest),
          drafts: z.number(),
          /** Earlier versions' requests with the team's answers, newest first. */
          history: z.array(z.object({ version: z.number(), requests: z.array(changeRequest) })),
        }),
        /** Every text sent, newest first, each with its PDF (`?versao=N` for an earlier one). */
        versions: z.array(
          z.object({ version: z.number(), sentAt: z.string(), current: z.boolean(), signedBy: z.array(party), pdfPath: z.string() }),
        ),
        /** The contract an amendment changes, and the amendments of a contract. */
        parent: z.object({ id: z.string(), title: z.string(), statusLabel: z.string() }).nullable(),
        amendments: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            status: z.string(),
            statusLabel: z.string(),
            signedAt: z.string().nullable(),
            endsAt: z.string().nullable(),
          }),
        ),
      }),
    ),
    /** Signs the version on screen, with the person's own session as proof (same as the web). */
    sign: oc.input(z.object({ id: z.uuid(), consent: z.literal(true) })).output(z.object({ message: z.string(), signed: z.boolean() })),
    /** Writes (or, with `requestId`, edits) a change request on one clause of the version waiting for signatures; it stays a draft until sent. */
    saveRequest: oc
      .input(
        z.object({
          contractId: z.uuid(),
          requestId: z.uuid().optional(),
          blockIndex: z.number().int().min(0).max(10_000),
          comment: z.string().max(2000),
          proposedText: z.string().max(8000).default(""),
        }),
      )
      .output(message),
    /** Discards a change request not sent yet. */
    discardRequest: oc.input(z.object({ id: z.uuid() })).output(message),
    /** Sends the round's requests to Anuntech: the contract goes to "Em revisão". */
    submitRequests: oc.input(z.object({ contractId: z.uuid() })).output(message),
  },
  quotes: {
    /** Quotes of the person's finance companies, with the figures that were sent, by situation and a search on number and title. */
    list: oc
      .input(
        page.extend({
          status: z.enum(["all", "sent", "accepted", "declined", "expired"]).default("all"),
          search: z.string().max(160).default(""),
        }),
      )
      .output(
        z.object({
          rows: z.array(
            documentRow.extend({
              number: z.string(),
              totalCents: z.number(),
              validUntil: z.string().nullable(),
              hoursMin: z.number(),
              hoursMax: z.number(),
              /** Waiting past its validity date. */
              expired: z.boolean(),
              /** While it waits: "Válido por 12 dias". */
              validityLabel: z.string().nullable(),
            }),
          ),
          ...paged,
        }),
      ),
    /** One quote: its phases, figures, the answer if there is one, and the PDF. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      documentRow.extend({
        number: z.string(),
        validUntil: z.string().nullable(),
        /** While it waits: "Válido por 12 dias". */
        validityLabel: z.string().nullable(),
        totalCents: z.number(),
        /** The hours' value before the negotiated discount, and the discount ("10%"). */
        subtotalCents: z.number(),
        discountCents: z.number(),
        discountShare: z.string(),
        upfrontCents: z.number(),
        balanceCents: z.number(),
        hourlyRateCents: z.number(),
        hoursMin: z.number(),
        hoursMax: z.number(),
        stack: z.array(z.string()),
        /** Who answered; e-mail and IP only when the client answered (the web's "Mais"). */
        decision: z
          .object({
            party: z.string(),
            name: z.string(),
            note: z.string().nullable(),
            at: z.string(),
            email: z.string().nullable(),
            ip: z.string().nullable(),
          })
          .nullable(),
        pdfPath: z.string(),
        /** The proposal as it was sent: summary, phases with hours, weeks and tasks, notes. */
        summary: z.string(),
        phases: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            hoursMin: z.number(),
            hoursMax: z.number(),
            weeks: z.number().nullable(),
            tasks: z.array(z.object({ title: z.string(), description: z.string() })),
          }),
        ),
        notes: z.string(),
        upfrontPercent: z.number(),
        documentHash: z.string().nullable(),
        version: z.number().nullable(),
        sentAt: z.string().nullable(),
        expired: z.boolean(),
        /** The viewer answers for the company (a client Administrador) and the quote waits for an answer. */
        canAnswer: z.boolean(),
        /** Every proposal sent, newest first, each with its PDF (`?versao=N` for an earlier one). */
        versions: z.array(z.object({ version: z.number(), sentAt: z.string(), current: z.boolean(), pdfPath: z.string() })),
      }),
    ),
    /** Accepts (with consent) or declines (with an optional note) a quote that was sent. */
    answer: oc
      .input(
        z.object({
          id: z.uuid(),
          decision: z.enum(["accept", "decline"]),
          note: z.string().max(1000).default(""),
          consent: z.boolean().default(false),
        }),
      )
      .output(message),
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
  profile: {
    /** Changes the person's name (2 to 100 characters). */
    rename: oc.input(z.object({ name: z.string().max(200) })).output(message),
    /** The illustrations a person can pick. */
    avatars: oc.input(empty).output(z.object({ avatars: z.array(z.object({ image: z.string(), path: z.string(), color: z.string() })) })),
    /** Picks an illustration of the catalog. A photo is sent to POST /api/v1/conta/foto. */
    setAvatar: oc.input(z.object({ image: z.string().max(200) })).output(z.object({ avatar, message: z.string() })),
    /** Removes the uploaded photo: the profile goes back to an illustration. */
    removePhoto: oc.input(empty).output(z.object({ avatar, message: z.string() })),
    /** Starts moving the main e-mail: a code to the current address and one to the new. */
    startEmailChange: oc
      .input(z.object({ email: z.string().max(254) }))
      .output(z.object({ challengeId: z.string(), email: z.string(), message: z.string() })),
    /** Confirms both codes; every session ends, the app signs in again with the new address. */
    confirmEmailChange: oc
      .input(z.object({ challengeId: z.uuid(), sourceCode: sixDigits, targetCode: sixDigits }))
      .output(message),
  },
  security: {
    /** Two-step state and where the account has been open. Changes go through /api/auth/security/*. */
    overview: oc.input(empty).output(
      z.object({
        twoFactorEnabled: z.boolean(),
        channel: z.enum(["email", "whatsapp"]),
        phone: z.string().nullable(),
        sessions: z.array(
          z.object({
            id: z.string(),
            device: z.string(),
            createdAt: z.string(),
            expiresAt: z.string().nullable(),
            status: z.enum(["current", "active", "expired", "ended"]),
            statusLabel: z.string(),
          }),
        ),
      }),
    ),
  },
  company: {
    /** The company the person manages (Administradores). */
    get: oc.input(empty).output(
      z.object({
        id: z.string(),
        name: z.string(),
        document: z.string(),
        billingEmail: z.string(),
        phone: z.string(),
        address: companyAddress.nullable(),
      }),
    ),
    update: oc
      .input(
        z.object({
          name: z.string().max(200),
          document: z.string().max(20),
          billingEmail: z.string().max(254),
          phone: z.string().max(30),
          address: companyAddress.nullable(),
        }),
      )
      .output(message),
    /** Fills the address from a CEP (20 a hour). */
    lookupCep: oc
      .input(z.object({ cep: z.string().regex(/^\d{8}$/) }))
      .output(z.object({ endereco: z.string(), bairro: z.string(), cidade: z.string(), uf: z.string(), codigoMunicipio: z.string() })),
  },
  members: {
    /** Who enters the Console for the company, their role and what each Membro sees. */
    list: oc.input(empty).output(
      z.object({
        people: z.array(
          z.object({
            key: z.string(),
            memberId: z.string(),
            name: z.string().nullable(),
            email: z.string(),
            avatar,
            self: z.boolean(),
            pending: z.boolean(),
            role: z.enum(["manager", "member"]),
            roleLabel: z.string(),
            statusLabel: z.string(),
            scope: memberScope,
            scopeLabel: z.string(),
          }),
        ),
        /** What a Membro can be given to see: the company's products, services and projects. */
        choices: z.array(z.object({ id: z.string(), name: z.string(), kindLabel: z.string() })),
      }),
    ),
    /** Invites a person, or changes their role or what they see (same rules as the web). */
    save: oc
      .input(z.object({ email: z.string().max(254), role: z.enum(["manager", "member"]), scope: memberScope.optional() }))
      .output(message),
    /** Removes the access (or cancels the invite). */
    revoke: oc.input(z.object({ memberId: z.uuid() })).output(message),
    /** Sends the invite again (once a week). */
    resendInvite: oc.input(z.object({ memberId: z.uuid() })).output(message),
  },
  notifications: {
    /** Who receives the company's notices, per subject, by e-mail and WhatsApp. */
    get: oc.input(empty).output(
      z.object({
        topics: z.array(
          z.object({
            topic: noticeTopic,
            title: z.string(),
            description: z.string(),
            emails: z.array(z.string()),
            phones: z.array(z.string()),
            emailEnabled: z.boolean(),
            whatsappEnabled: z.boolean(),
          }),
        ),
      }),
    ),
    save: oc
      .input(
        z.object({
          topic: noticeTopic,
          emails: z.array(z.string().max(254)).max(10),
          phones: z.array(z.string().max(30)).max(10),
          emailEnabled: z.boolean(),
          whatsappEnabled: z.boolean(),
        }),
      )
      .output(message),
  },
};
export type Contract = typeof contract;
