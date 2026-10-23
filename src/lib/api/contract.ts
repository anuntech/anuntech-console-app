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
const priority = z.enum(["normal", "high", "critical"]);
/** The files staged by POST /api/v1/anexos for this send (the web's limit: 5). */
const uploadIds = z.array(z.uuid()).max(5).default([]);
const ticketKind = z.enum(["problem", "question", "change", "access", "new_project"]);
const ticketImpact = z.enum(["down", "workaround", "other"]);
const ticketRow = z.object({
  id: z.string(),
  subject: z.string(),
  status,
  statusLabel: z.string(),
  /** Alta and Crítica get a mark in the row, as on the web. */
  priority,
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
/** A row of the Financeiro list: the invoice plus its recurrence and how late it is. */
const financeRow = invoiceRow.extend({
  /** The recurrence that issued it ("Recorrência mensal/anual"), or null for a one-off charge. */
  interval: z.enum(["monthly", "yearly"]).nullable(),
  /** Days past the due date while overdue, else 0. */
  daysOverdue: z.number(),
  /** The boleto's own date, when the bank uses a later one than the obligation's. */
  bankDueDate: z.string().nullable(),
});
const upcomingCharge = z.object({
  subscriptionId: z.string(),
  company: z.string(),
  description: z.string(),
  amountCents: z.number(),
  dueDate: z.string(),
  /** By when the boleto and the Pix arrive. */
  issueDate: z.string(),
  /** Latest invoice of the recurrence, to open. */
  invoiceId: z.string().nullable(),
});
const page = z.object({ page: z.number().int().min(1).max(10_000).default(1) });
const paged = { page: z.number(), pageCount: z.number(), showCompany: z.boolean() };
const projectRow = z.object({
  id: z.string(),
  name: z.string(),
  /** active, paused, completed (or suspended); the web marks only what is not active. */
  status: z.string(),
  statusLabel: z.string(),
  company: z.string(),
  tasks: z.object({ total: z.number(), done: z.number() }),
  updatedAt: z.string(),
});
const taskStatus = z.enum(["backlog", "todo", "in_progress", "review", "done"]);
const taskPriority = z.enum(["low", "normal", "high", "urgent"]);
const projectTask = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatus,
  priority: taskPriority,
  priorityLabel: z.string(),
  dueDate: z.string().nullable(),
  /** The deadline passed (São Paulo's today) and the task is not done; dueToday: it is today. */
  overdue: z.boolean(),
  dueToday: z.boolean(),
  labels: z.array(z.string()),
  estimateMinutes: z.number().nullable(),
  /** "2h", "1h30", "45min". */
  estimateLabel: z.string().nullable(),
  /** Names, in the order they were assigned; ids in the same order. */
  assignees: z.array(z.string()),
  assigneeIds: z.array(z.string()),
  comments: z.number(),
  files: z.number(),
  reviewDue: z.string().nullable(),
  /** Created by the client and not yet taken into the work by the team ("Pedido do cliente"). */
  requested: z.boolean(),
  creator: z.string().nullable(),
  updatedAt: z.string(),
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
/** A person's picture: an illustration of the catalog, an uploaded photo (path served with the session) or initials. */
const avatar = z.object({
  kind: z.enum(["illustration", "photo", "initials"]),
  /** Path on the Console: /brand/avatars/<n>.svg, /api/conta/foto?v=… or /api/pessoas/<id>/foto?v=… */
  path: z.string().nullable(),
  /** Background of an illustration. */
  color: z.string().nullable(),
});
const ticketEntry = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    id: z.string(),
    body: z.string(),
    createdAt: z.string(),
    author: z.string(),
    authorImage: z.string().nullable(),
    /** The author's picture as the app draws it (optional: older servers left it out). */
    avatar: avatar.optional(),
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

const message = z.object({ message: z.string() });
/** Someone on a task, a comment or the activity: name and picture. */
const taskPerson = z.object({ id: z.string(), name: z.string(), avatar });
const taskFile = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  mime: z.string(),
  /** Path on the Console (/api/anexos/<id>); the app sends its session cookie. */
  href: z.string(),
});
const taskFields = {
  title: z.string().max(200),
  description: z.string().max(5000).default(""),
  priority: taskPriority.default("normal"),
  /** YYYY-MM-DD or empty for no deadline. */
  dueDate: z.union([z.iso.date(), z.literal("")]).default(""),
  /** Hours as typed ("1,5"), empty for none. */
  estimate: z.string().max(10).default(""),
  labels: z.array(z.string().max(100)).max(20).default([]),
  assigneeIds: z.array(z.string().max(128)).max(20).default([]),
  /** Files sent before to POST /api/v1/anexos?para=tarefa. */
  uploadIds: z.array(z.uuid()).max(20).default([]),
};
/** Someone a bookmark folder is (or can be) shared with. */
const bookmarkPerson = z.object({ id: z.string(), name: z.string(), avatar });
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
/** How a product or service opens: a protected app (apps.open), its own web link, the service's screen, or nothing yet. */
const opensAs = z.enum(["app", "link", "service", "none"]);
const productCard = z.object({
  id: z.string(),
  kind: z.enum(["product", "service"]),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  statusLabel: z.string(),
  company: z.string(),
  /** The catalog icon's path on the Console (a gallery file, or /api/catalogo/<id>/icone with the session); null for initials. */
  iconPath: z.string().nullable(),
  opensAs,
  /** The product's own web link, only when it opens as a link. */
  url: z.string().nullable(),
});
/** Amount, interval and next due date: only where the person sees money (Administradores). */
const productMoney = z.object({
  amountCents: z.number().nullable(),
  interval: z.enum(["monthly", "yearly"]).nullable(),
  nextDueDate: z.string().nullable(),
});
/** What the client reads while something is suspended, and whether "Pagar agora" shows. */
const suspensionNotice = z.object({ title: z.string(), text: z.string(), canPay: z.boolean() });
const reportState = z.object({
  month: z.string(),
  reportSentAt: z.string().nullable(),
  contestedAt: z.string().nullable(),
  /** Last instant to contest the sent report; null when the contract sets no window. */
  contestUntil: z.string().nullable(),
});
/** A company's hours bank this month (never the terms or a price), and whether the person approves and contests. */
const bankCard = reportState.extend({
  companyId: z.string(),
  company: z.string(),
  viewer: z.enum(["approver", "member"]),
  includedMinutes: z.number(),
  usedMinutes: z.number(),
  overageApprovedMinutes: z.number(),
  alertPercent: z.number(),
  entries: z.array(
    z.object({
      id: z.string(),
      minutes: z.number(),
      note: z.string(),
      workedOn: z.string(),
      kind: z.string(),
      ticket: z.string().nullable(),
      author: z.string(),
    }),
  ),
  /** Last month, while its report can still be contested. */
  previous: reportState.nullable(),
});

const helpBlock = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("p"), text: z.string() }),
  z.object({ kind: z.literal("list"), items: z.array(z.string()) }),
  z.object({ kind: z.literal("steps"), items: z.array(z.string()) }),
  z.object({ kind: z.literal("pairs"), items: z.array(z.object({ term: z.string(), text: z.string() })) }),
  z.object({ kind: z.literal("note"), tone: z.enum(["info", "attention"]), text: z.string() }),
]);
/** An article in a list. `adminOnly`: marked "Administrador" for a Membro (only the Administrador does it). */
const helpStub = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  adminOnly: z.boolean(),
  video: z.boolean(),
});
const firstStepKey = z.enum(["guide_read", "first_steps_hidden", "notices_reviewed", "members_reviewed"]);

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
        priority,
        priorityLabel: z.string(),
        kindLabel: z.string().nullable(),
        /** How badly a problem hurts, in the client's words. */
        impactLabel: z.string().nullable(),
        companyId: z.string(),
        company: z.string(),
        engagement: z.string().nullable(),
        author: z.string(),
        /** E-mail of who opened it; null when it was the team ("Equipe Anuntech"). */
        authorEmail: z.string().nullable(),
        assigneeName: z.string().nullable(),
        waitingFor: z.string().nullable(),
        createdAt: z.string(),
        /** Última atividade. */
        updatedAt: z.string(),
        canReply: z.boolean(),
        /** Prazos, only when the company's conditions are published (the web's card, in words). */
        clock: z
          .object({
            label: z.string(),
            /** "Respondido em 2 horas úteis", "Até amanhã, 10h" or "Sem prazo". */
            firstResponse: z.string(),
            /** When it was answered, "21/10/2026 às 10:00". */
            firstResponseAt: z.string().nullable(),
            /** "Até sex 24/10, 18h"; null once resolved or without a goal. */
            resolution: z.string().nullable(),
            /** "Prazo pausado desde 21/10/2026 às 10:00." */
            paused: z.string().nullable(),
          })
          .nullable(),
        /** An improvement's estimate in hours of the bank (SUP 5.1); canApprove for the company's Administrador. */
        estimate: z
          .object({
            minutes: z.number(),
            /** "1,5 h" */
            amount: z.string(),
            status: z.enum(["proposed", "approved", "declined"]),
            canApprove: z.boolean(),
          })
          .nullable(),
        entries: z.array(ticketEntry),
      }),
    ),
    /** A reply with text, files or both (files from POST /api/v1/anexos). */
    reply: oc
      .input(z.object({ id: z.uuid(), body: z.string().trim().max(10000).default(""), uploadIds }))
      .output(z.object({ ok: z.literal(true), message: z.string() })),
    /** The company's Administrador approves or declines an improvement's estimate, the one they saw (`minutes`). */
    decideEstimate: oc
      .input(z.object({ id: z.uuid(), decision: z.enum(["approve", "decline"]), minutes: z.number().int().min(1) }))
      .output(z.object({ message: z.string(), status: z.enum(["approved", "declined"]) })),
    /** What opening a ticket offers: companies, their products and services, kinds and impacts. */
    choices: oc.input(empty).output(
      z.object({
        companies: z.array(z.object({ id: z.string(), name: z.string() })),
        engagements: z.array(z.object({ id: z.string(), name: z.string(), companyId: z.string() })),
        kinds: z.array(option.extend({ placeholder: z.string() })),
        impacts: z.array(option),
      }),
    ),
    /** "O que esperar", the line outside business hours and the guidance for a change, for what the form has so far. */
    preview: oc
      .input(
        z.object({
          companyId: z.uuid(),
          engagementId: z.union([z.uuid(), z.literal("")]).default(""),
          kind: ticketKind,
          impact: ticketImpact.optional(),
        }),
      )
      .output(
        z.object({
          expect: z.object({ lines: z.array(z.string()), dated: z.boolean() }),
          outOfHours: z.string().nullable(),
          changeGuidance: z.string().nullable(),
        }),
      ),
    /** Opens a ticket with the first message. */
    create: oc
      .input(
        z.object({
          companyId: z.uuid(),
          engagementId: z.union([z.uuid(), z.literal("")]).default(""),
          kind: ticketKind,
          impact: ticketImpact.optional(),
          subject: z.string().trim().min(1).max(160),
          body: z.string().trim().min(1).max(10000),
          uploadIds,
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
          /** Words of the description, or of the company's name. */
          search: z.string().trim().max(160).default(""),
          /** Due-date window, as the web's period picker (without "Personalizado"). */
          period: z.enum(["all", "this_month", "last_month", "next_30", "this_year"]).default("all"),
          page: z.number().int().min(1).max(10_000).default(1),
        }),
      )
      .output(
        z.object({
          rows: z.array(financeRow),
          /** Each situation's count and amount, under the search and the period. */
          totals: z.object({ all: money, issued: money, overdue: money, paid: money }),
          /** What each active recurrence charges next (clients, first page of the plain list). */
          upcoming: z.array(upcomingCharge),
          page: z.number(),
          pageCount: z.number(),
          showCompany: z.boolean(),
        }),
      ),
    /** One invoice with what pays it: Pix copia e cola, the boleto line and its PDF. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      financeRow.extend({
        engagement: z.string().nullable(),
        pix: z.string().nullable(),
        boletoLine: z.string().nullable(),
        /** Path of the boleto PDF: the public page's, or the session route when the link is off. */
        boletoPath: z.string().nullable(),
        /** The public payment page as a full address, to copy and share. */
        payUrl: z.string().nullable(),
        createdAt: z.string(),
        /** Last time the Console checked the charge at the bank. */
        bankCheckedAt: z.string().nullable(),
        /** The bank holds the charge and has not sent the Pix and the boleto yet. */
        processing: z.boolean(),
        /** The razão social and CPF/CNPJ as the boleto carries them. */
        payer: z.object({ name: z.string(), document: z.string() }),
        /** Discount and late fees, only while it can still be paid. */
        terms: z
          .object({
            discountCents: z.number().nullable(),
            onTimeCents: z.number().nullable(),
            fineBps: z.number().nullable(),
            interestMonthlyBps: z.number().nullable(),
            lateFees: z.string().nullable(),
          })
          .nullable(),
        recurrence: z
          .object({
            interval: z.enum(["monthly", "yearly"]),
            next: z
              .object({ amountCents: z.number(), dueDate: z.string(), issueDate: z.string(), onPayment: z.boolean() })
              .nullable(),
            ahead: z
              .object({ id: z.string(), dueDate: z.string(), amountCents: z.number(), status: z.enum(["issued", "paid"]) })
              .nullable(),
          })
          .nullable(),
        /** The "Nota fiscal" card, when the web shows it; the link only once authorized. */
        fiscal: z
          .object({ status: z.enum(["not_requested", "processing", "authorized", "error"]), url: z.string().nullable() })
          .nullable(),
      }),
    ),
  },
  projects: {
    /** The projects the person sees, with each board's progress: by situation, name and company. */
    list: oc
      .input(
        page.extend({
          status: z.enum(["active", "paused", "completed", "all"]).default("active"),
          search: z.string().max(160).default(""),
          company: z.union([z.uuid(), z.literal("")]).default(""),
        }),
      )
      .output(
        z.object({
          rows: z.array(projectRow),
          ...paged,
          /** The companies to narrow the list to, when the person reaches more than one (empty for the team). */
          companies: z.array(z.object({ id: z.string(), name: z.string() })),
        }),
      ),
    /** One project's board, column by column, with who can be given a task. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        company: z.string(),
        status: z.string(),
        statusLabel: z.string(),
        columns: z.array(z.object({ status: taskStatus, label: z.string(), tasks: z.array(projectTask) })),
        /** The viewer approves deliveries in Revisão (a client company's Administrador). */
        canReview: z.boolean(),
        /** Who is looking: their id (for "Você") and whether they are the team. */
        viewer: z.object({ id: z.string(), staff: z.boolean() }),
        /** Who a task can be given to: the members who see the project, and the team. */
        people: z.array(taskPerson),
        /** Anyone who sees the board adds to it; a client's task enters the Backlog as a request. */
        canCreate: z.boolean(),
        priorities: z.array(option),
        /** "Como usar o quadro", as the web's "Sobre este projeto" lists it. */
        guide: z.array(z.string()),
      }),
    ),
    /** One task: every field, its files, its comments and what the viewer may do with it. */
    task: oc.input(z.object({ id: z.uuid() })).output(
      z.object({
        id: z.string(),
        project: z.object({ id: z.string(), name: z.string() }),
        title: z.string(),
        description: z.string().nullable(),
        status: taskStatus,
        statusLabel: z.string(),
        priority: taskPriority,
        priorityLabel: z.string(),
        dueDate: z.string().nullable(),
        overdue: z.boolean(),
        dueToday: z.boolean(),
        labels: z.array(z.string()),
        estimateMinutes: z.number().nullable(),
        estimateLabel: z.string().nullable(),
        /** The estimate as the form shows it ("1,5"), empty without one. */
        estimateHours: z.string(),
        requested: z.boolean(),
        creator: z.string().nullable(),
        updatedAt: z.string(),
        reviewDue: z.string().nullable(),
        approvedAt: z.string().nullable(),
        assignees: z.array(taskPerson),
        files: z.array(taskFile.extend({ canRemove: z.boolean() })),
        comments: z.array(
          z.object({
            id: z.string(),
            body: z.string(),
            createdAt: z.string(),
            editedAt: z.string().nullable(),
            author: taskPerson,
            mine: z.boolean(),
            /** Only the author edits; the author or the team deletes. */
            canEdit: z.boolean(),
            canDelete: z.boolean(),
            files: z.array(taskFile),
          }),
        ),
        canDelete: z.boolean(),
        canReview: z.boolean(),
        /** The columns the viewer may move it to (its own included), with the client's rules. */
        statuses: z.array(z.object({ value: taskStatus, label: z.string() })),
      }),
    ),
    /** The project's history: who created, moved, approved, commented or edited what, newest first. */
    activity: oc.input(z.object({ id: z.uuid() })).output(
      z.object({
        events: z.array(
          z.object({
            id: z.string(),
            /** What happened, after the person's name ("moveu de A fazer para Revisão"). */
            text: z.string(),
            kind: z.enum(["moves", "reviews", "comments", "edits"]),
            at: z.string(),
            who: taskPerson.extend({ staff: z.boolean() }),
            task: z.object({ id: z.string(), title: z.string(), exists: z.boolean() }).nullable(),
          }),
        ),
        filters: z.array(z.object({ key: z.string(), label: z.string() })),
      }),
    ),
    /** A new task (for the client, a request in the Backlog). `status` counts only for the team. */
    createTask: oc
      .input(z.object({ engagementId: z.uuid(), status: taskStatus.optional(), ...taskFields }))
      .output(z.object({ id: z.string(), message: z.string() })),
    /** Saves every field of a task, its column, new files and the saved ones to remove. */
    updateTask: oc
      .input(z.object({ id: z.uuid(), status: taskStatus, ...taskFields, removeFileIds: z.array(z.uuid()).max(20).default([]) }))
      .output(message),
    /** Moves a task to another column (to its end), with the client's rules. */
    moveTask: oc.input(z.object({ id: z.uuid(), status: taskStatus })).output(message),
    /** Deletes a task (whoever created it, or the team). */
    deleteTask: oc.input(z.object({ id: z.uuid() })).output(message),
    /** Removes a saved file (whoever added it, the task's creator, or the team). */
    removeTaskFile: oc.input(z.object({ id: z.uuid() })).output(message),
    /** A comment: text, files or both. */
    comment: oc
      .input(z.object({ taskId: z.uuid(), body: z.string().max(5000).default(""), uploadIds: z.array(z.uuid()).max(20).default([]) }))
      .output(message),
    /** Changes the words of one's own comment. */
    editComment: oc.input(z.object({ id: z.uuid(), body: z.string().max(5000) })).output(message),
    /** Deletes one's own comment, with its files. */
    deleteComment: oc.input(z.object({ id: z.uuid() })).output(message),
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
    /**
     * The person's folders and one page (25) of bookmarks: links, files and boards.
     * `company` is "all" or a company id; `folder` is "all", "root" (Sem pasta) or a
     * folder id, and falls back to "all" when that folder is not visible (see `folder`).
     */
    list: oc
      .input(
        z.object({
          company: z.string().max(64).default("all"),
          folder: z.string().max(64).default("all"),
          search: z.string().max(160).default(""),
          page: z.number().int().min(1).max(10_000).default(1),
        }),
      )
      .output(
        z.object({
          folders: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              companyId: z.string().nullable(),
              company: z.string().nullable(),
              count: z.number(),
              /** "company": the whole company sees it; "people": the owner and `sharedWith`. */
              visibility: z.enum(["company", "people"]),
              ownerId: z.string(),
              owner: z.string(),
              sharedWith: z.array(bookmarkPerson),
              /** The viewer owns it: renames, shares and deletes it. */
              manages: z.boolean(),
            }),
          ),
          items: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              kind: z.enum(["link", "file", "board"]),
              url: z.string().nullable(),
              fileName: z.string().nullable(),
              /** Bytes of the saved file; null for links and boards. */
              fileSize: z.number().nullable(),
              /** Path to download the file (or the board's picture) with the session. */
              filePath: z.string().nullable(),
              /** A board with a picture to show. */
              hasPreview: z.boolean(),
              folderId: z.string().nullable(),
              companyId: z.string().nullable(),
              createdAt: z.string(),
              updatedAt: z.string(),
              /** Who saved it or the owner of its folder: edits, moves and deletes it. */
              editable: z.boolean(),
            }),
          ),
          /** The folder actually shown. */
          folder: z.string(),
          /** Bookmarks outside any folder, in the companies shown. */
          rootCount: z.number(),
          /** What the folder and the search leave. */
          total: z.number(),
          page: z.number(),
          pageCount: z.number(),
          /** Where the person can save bookmarks and folders. */
          companies: z.array(z.object({ id: z.string(), name: z.string() })),
        }),
      ),
    /** A link or a blank board (drawn in the Console). A file goes to POST /api/v1/bookmarks/arquivo. */
    create: oc
      .input(
        z.object({
          companyId: z.union([z.uuid(), z.literal("")]).default(""),
          folderId: z.union([z.uuid(), z.literal("")]).default(""),
          title: z.string().max(400),
          url: z.string().max(2048).default(""),
          kind: z.enum(["link", "board"]).default("link"),
        }),
      )
      .output(z.object({ message: z.string(), id: z.string() })),
    /** Title, link and folder (who saved it or the folder's owner). A file or a board keeps its content. */
    update: oc
      .input(
        z.object({
          id: z.uuid(),
          title: z.string().max(400),
          url: z.string().max(2048).default(""),
          folderId: z.union([z.uuid(), z.literal("")]).default(""),
        }),
      )
      .output(message),
    /** Another folder, or "" for Sem pasta. */
    move: oc.input(z.object({ id: z.uuid(), folderId: z.union([z.uuid(), z.literal("")]) })).output(message),
    remove: oc.input(z.object({ id: z.uuid() })).output(message),
    createFolder: oc
      .input(
        z.object({
          companyId: z.uuid(),
          name: z.string().max(200),
          visibility: z.enum(["company", "people"]).default("company"),
        }),
      )
      .output(z.object({ message: z.string(), id: z.string() })),
    /** Only the owner. */
    renameFolder: oc.input(z.object({ id: z.uuid(), name: z.string().max(200) })).output(message),
    /** Only the owner: the whole company, or chosen people (up to 50). */
    shareFolder: oc
      .input(
        z.object({
          id: z.uuid(),
          visibility: z.enum(["company", "people"]),
          userIds: z.array(z.string().max(128)).max(100).default([]),
        }),
      )
      .output(message),
    /** Only the owner; the bookmarks inside go to Sem pasta. */
    deleteFolder: oc.input(z.object({ id: z.uuid() })).output(message),
    /** People the folder can be shared with, by name (the owner only). */
    searchPeople: oc
      .input(z.object({ folderId: z.uuid(), query: z.string().max(80) }))
      .output(z.object({ people: z.array(bookmarkPerson) })),
  },
  overview: {
    /** The start screen: what waits for the person and what is due. */
    get: oc.input(empty).output(
      z.object({
        waiting: z.array(ticketRow),
        recent: z.array(ticketRow),
        toPay: z.array(invoiceRow),
        canFinance: z.boolean(),
        canSupport: z.boolean(),
        /** Several companies: rows name theirs. */
        showCompany: z.boolean(),
        /** "Precisa de atenção": counts for the Administrador and the suspended products for everyone. */
        attention: z.object({
          quotesToAnswer: z.number(),
          contractsToSign: z.number(),
          /** Improvements whose estimate waits for approval; the ticket when there is only one. */
          estimates: z.object({ count: z.number(), ticketId: z.string().nullable() }),
          /** Deliveries in Revisão; the project when they are all on one. */
          reviews: z.object({ count: z.number(), projectId: z.string().nullable() }),
          suspended: z.array(z.object({ id: z.string(), name: z.string() })),
        }),
        /** Up to 4 active or paused projects, with their progress. */
        projects: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            status: z.string(),
            statusLabel: z.string(),
            company: z.string(),
            tasks: z.object({ total: z.number(), done: z.number() }),
          }),
        ),
        /** Up to 5 products and services, suspended first. */
        products: z.array(productCard),
        /** Up to 5 bookmarks. */
        bookmarks: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            kind: z.enum(["link", "file", "board"]),
            url: z.string().nullable(),
            fileName: z.string().nullable(),
            filePath: z.string().nullable(),
            folder: z.string().nullable(),
          }),
        ),
        /** With nothing to pay: the next recurring charge (Administradores). */
        nextCharge: z.object({ amountCents: z.number(), dueDate: z.string(), issueDate: z.string() }).nullable(),
        banks: z.array(bankCard),
      }),
    ),
  },
  products: {
    /** Products and services the person sees (a Membro, only the chosen ones), with money for Administradores. */
    list: oc
      .input(
        page.extend({
          status: z.enum(["active", "paused", "completed", "all"]).default("active"),
          search: z.string().max(160).default(""),
        }),
      )
      .output(
        z.object({
          rows: z.array(productCard.extend({ money: productMoney.optional() })),
          ...paged,
          /** Clients see the status filter only when something is paused or closed. */
          showStatusFilter: z.boolean(),
          suspended: suspensionNotice.nullable(),
        }),
      ),
    /** One product or service: the catalog's four sections, its billing (Administradores) and its suspension. */
    get: oc.input(z.object({ id: z.uuid() })).output(
      productCard.extend({
        companyId: z.string(),
        showCompany: z.boolean(),
        sections: z.object({
          whatWeDo: z.string().nullable(),
          whatWeNeed: z.string().nullable(),
          expectedResults: z.string().nullable(),
          deadlines: z.string().nullable(),
        }),
        billing: productMoney.optional(),
        suspension: suspensionNotice.nullable(),
      }),
    ),
  },
  apps: {
    /**
     * Opens a product's protected app: a fresh 2-minute pass in the address
     * (recorded as app.opened), or why it does not open, or the screen a
     * service or project has instead.
     */
    open: oc.input(z.object({ id: z.uuid() })).output(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("open"), url: z.string(), app: z.string() }),
        z.object({
          kind: z.literal("blocked"),
          product: z.string(),
          title: z.string(),
          description: z.string(),
          /** "Abrir produto": the product's own link, when it opens outside the Console. */
          link: z.string().nullable(),
          /** "Abrir chamado": the app is not yet set up for the company. */
          ticket: z.boolean(),
          /** "Pagar agora": suspended, and the person sees the company's invoices. */
          pay: z.boolean(),
        }),
        z.object({ kind: z.literal("page"), to: z.enum(["service", "project"]), id: z.string() }),
      ]),
    ),
  },
  hours: {
    /** Each company's hours bank the person sees. */
    banks: oc.input(empty).output(z.object({ banks: z.array(bankCard) })),
    /** An Administrador approves up to this many hours beyond this month's bank ("2" or "1,5"). */
    approveOverage: oc.input(z.object({ companyId: z.uuid(), hours: z.string().max(10) })).output(message),
    /** An Administrador contests a sent report within the contract's window. */
    contestReport: oc
      .input(z.object({ companyId: z.uuid(), month: z.string().regex(/^\d{4}-\d{2}$/), note: z.string().max(2000) }))
      .output(message),
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
    /** Histórico de envios: each notice that went out, newest first, 20 a page (as the web). */
    history: oc.input(z.object({ page: z.number().int().min(1).max(9_999_999).default(1) })).output(
      z.object({
        rows: z.array(
          z.object({
            id: z.string(),
            /** The ticket's subject or the invoice's description. */
            subject: z.string(),
            /** What moved ("Resposta da equipe", "Financeiro"…). */
            actionLabel: z.string(),
            kind: z.enum(["ticket", "invoice"]),
            /** The ticket or invoice the notice is about. */
            recordId: z.string(),
            channel: z.enum(["email", "whatsapp"]),
            /** Address or number as the web shows it; the channel's name when there is none. */
            recipient: z.string(),
            status: z.string(),
            statusLabel: z.string(),
            tone: z.enum(["good", "info", "danger", "attention", "neutral"]),
            error: z.string().nullable(),
            createdAt: z.string(),
          }),
        ),
        total: z.number(),
        page: z.number(),
        pageCount: z.number(),
        showCompany: z.boolean(),
      }),
    ),
  },
  help: {
    /** Ajuda: the tutorials, the subjects with their articles and the common questions. Texts may hold [rótulo](/caminho) links. */
    home: oc.input(empty).output(
      z.object({
        tutorials: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), duration: z.number(), slug: z.string() })),
        categories: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), articles: z.array(helpStub) })),
        faq: z.array(z.object({ q: z.string(), a: z.string(), slug: z.string() })),
        canOpenTicket: z.boolean(),
      }),
    ),
    /** One article. An unknown slug answers NOT_FOUND. */
    get: oc.input(z.object({ slug: z.string().max(120) })).output(
      z.object({
        slug: z.string(),
        title: z.string(),
        summary: z.string(),
        category: z.object({ id: z.string(), title: z.string() }),
        adminOnly: z.boolean(),
        /** A Membro reading an Administrador's article: the web's notice goes above it. */
        readsAsMember: z.boolean(),
        sections: z.array(z.object({ title: z.string(), blocks: z.array(helpBlock) })),
        faq: z.array(z.object({ q: z.string(), a: z.string() })),
        /** Where to do it, as Console paths ("Ir para Financeiro"). */
        actions: z.array(z.object({ label: z.string(), href: z.string() })),
        updatedAt: z.string(),
        /** The video: `src` is a path on the Console (/ajuda/videos/…), served without a session. */
        tutorial: z
          .object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            src: z.string(),
            duration: z.number(),
            chapters: z.array(z.object({ title: z.string(), hint: z.string(), start: z.number() })),
            transcript: z.array(z.object({ at: z.number(), text: z.string() })),
          })
          .nullable(),
        related: z.array(helpStub),
        /** The rest of the same subject ("Mais em …"). */
        siblings: z.array(helpStub),
        canOpenTicket: z.boolean(),
      }),
    ),
    /**
     * The help search (no accents, prefixes, synonyms), best first
     * (lib/help/help-search.ts). `for: "ticket"` and `"question"` are the
     * new-ticket form's "Talvez isto responda" (2 or 3 strong matches, after
     * 4 letters); "search" is the Ajuda's search box.
     */
    search: oc
      .input(z.object({ q: z.string().max(400), for: z.enum(["search", "ticket", "question"]).default("search") }))
      .output(z.array(z.object({ slug: z.string(), title: z.string(), summary: z.string() }))),
  },
  guide: {
    /** Como trabalhamos: the guide's sections and, per company, the deadlines and what its contract asks. */
    get: oc.input(empty).output(
      z.object({
        sections: z.array(z.object({ id: z.string(), title: z.string(), lead: z.string(), blocks: z.array(helpBlock) })),
        terms: z.array(
          z.object({
            company: z.string(),
            items: z.array(
              z.object({
                title: z.string(),
                promises: z.array(z.object({ text: z.string() })),
                asks: z.array(z.object({ text: z.string() })),
              }),
            ),
          }),
        ),
        staff: z.boolean(),
      }),
    ),
    /** Reading the guide (once per version); it never stands for accepting any term. */
    markRead: oc.input(empty).output(done),
    /** Primeiros passos for the first company; null when everything is done or the card was hidden. Hrefs are Console paths. */
    firstSteps: oc.input(empty).output(
      z.object({
        steps: z
          .object({
            companyId: z.string(),
            /** Only steps that come back by themselves (billing address, the 6-month review): they cannot be hidden. */
            forced: z.boolean(),
            steps: z.array(z.object({ key: z.string(), title: z.string(), href: z.string(), done: z.boolean() })),
          })
          .nullable(),
      }),
    ),
    /** A first step done by hand, or the card hidden (`first_steps_hidden`), for one of the person's companies. */
    markStep: oc.input(z.object({ companyId: z.uuid(), key: firstStepKey })).output(done),
  },
};
export type Contract = typeof contract;
