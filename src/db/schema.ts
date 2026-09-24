import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  date,
  uniqueIndex,
  index,
  jsonb,
  customType,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});
export const user = pgTable("console_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified")
    .notNull()
    .default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoStepChannel: text("two_step_channel", { enum: ["email", "whatsapp"] })
    .notNull()
    .default("whatsapp"),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const accountEmails = pgTable("console_account_emails", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: created(),
});
export const twoFactor = pgTable("console_two_factor", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  verified: boolean("verified").notNull().default(false),
  failedVerificationCount: integer("failed_verification_count")
    .notNull()
    .default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});
export const consoleStaffMembers = pgTable("console_staff_members", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const session = pgTable(
  "console_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("console_session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "console_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("console_account_user_idx").on(t.userId),
    uniqueIndex("console_account_provider_idx").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "console_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("console_verification_identifier_idx").on(t.identifier)],
);
export const rateLimit = pgTable("console_rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: customType<{ data: number; driverData: string }>({
    dataType: () => "bigint",
    fromDriver: (v) => Number(v),
  })("last_request").notNull(),
});
export const otpLimits = pgTable("console_otp_limits", {
  key: text("key").primaryKey(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});
export const companies = pgTable("console_companies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  document: text("document").notNull().unique(),
  billingEmail: text("billing_email").notNull(),
  phone: text("phone"),
  billingAddress:
    jsonb("billing_address").$type<
      import("@/lib/company-billing").CompanyAddress
    >(),
  autoIssueNfse: boolean("auto_issue_nfse").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: created(),
});
export const memberships = pgTable(
  "console_memberships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    email: text("email").notNull(),
    role: text("role", { enum: ["manager", "member"] }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("console_membership_unique").on(t.companyId, t.email),
    index("console_membership_email_idx").on(t.email),
  ],
);
/** The text frozen when a contract goes out for signature. */
export type ContractPublication = {
  title: string;
  body: string;
  companyName: string;
  companyDocument: string;
  /** Present since the validity and amendment fields exist; older snapshots lack them. */
  kind?: "contract" | "amendment";
  parentTitle?: string | null;
  parentHash?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  /** The send that produced this snapshot, so an unchanged text re-sent still needs fresh signatures. */
  version?: number;
};
/** Contract text written once, with {{variáveis}} filled per client. */
export const contractTemplates = pgTable("console_contract_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const contracts = pgTable(
  "console_contracts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    templateId: text("template_id").references(() => contractTemplates.id),
    engagementId: text("engagement_id").references((): AnyPgColumn => engagements.id),
    /** An amendment (aditivo) points at the contract it changes. */
    kind: text("kind", { enum: ["contract", "amendment"] }).notNull().default("contract"),
    parentId: text("parent_id").references((): AnyPgColumn => contracts.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    revision: integer("revision").notNull().default(1),
    /** Validity, as metadata for alerts; the text is what binds. */
    startsAt: date("starts_at"),
    endsAt: date("ends_at"),
    expiryNoticeSentAt: timestamp("expiry_notice_sent_at", { withTimezone: true }),
    expiredNoticeSentAt: timestamp("expired_notice_sent_at", { withTimezone: true }),
    /** draft → sent (frozen, awaiting signatures) → signed; or cancelled. */
    status: text("status", { enum: ["draft", "sent", "signed", "cancelled"] })
      .notNull()
      .default("draft"),
    publication: jsonb("publication").$type<ContractPublication>(),
    publishedVersion: integer("published_version").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** SHA-256 of the frozen text; printed on the PDF and checked at signing. */
    documentHash: text("document_hash"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signedPdf: bytea("signed_pdf"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("console_contract_company_idx").on(t.companyId)],
);
/** Every text that went out for signature, so earlier versions stay readable. */
export const contractVersions = pgTable(
  "console_contract_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    documentHash: text("document_hash").notNull(),
    sentBy: text("sent_by")
      .notNull()
      .references(() => user.id),
    sentAt: created(),
  },
  (t) => [uniqueIndex("console_contract_version_unique").on(t.contractId, t.version)],
);
/** One row per party that signed, with the evidence that backs it. */
export const contractSignatures = pgTable(
  "console_contract_signatures",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id),
    party: text("party", { enum: ["client", "anuntech"] }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    documentHash: text("document_hash").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    /** How the signer proved who they were. */
    method: text("method").notNull().default("otp_session"),
    sessionStartedAt: timestamp("session_started_at", { withTimezone: true }),
    signedAt: created(),
  },
  (t) => [
    index("console_contract_signature_contract_idx").on(t.contractId),
    uniqueIndex("console_contract_signature_party_unique").on(t.contractId, t.party),
  ],
);
/** A commercial proposal: phases with hour ranges, an hourly rate and the payment split. */
export const quotes = pgTable(
  "console_quotes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    /** "2026-007": numbered per year, in creation order. */
    year: integer("year").notNull(),
    seq: integer("seq").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<import("@/lib/quote-model").QuoteContent>().notNull(),
    validUntil: date("valid_until"),
    revision: integer("revision").notNull().default(1),
    /** draft → sent (frozen, awaiting the client) → accepted | declined; or cancelled. */
    status: text("status", { enum: ["draft", "sent", "accepted", "declined", "cancelled"] })
      .notNull()
      .default("draft"),
    publication: jsonb("publication").$type<import("@/lib/quote-model").QuotePublication>(),
    publishedVersion: integer("published_version").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** SHA-256 of the frozen proposal; printed on the PDF and checked at acceptance. */
    documentHash: text("document_hash"),
    /** The answer, with the evidence behind it. */
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by").references(() => user.id),
    decidedParty: text("decided_party", { enum: ["client", "anuntech"] }),
    decidedName: text("decided_name"),
    decidedEmail: text("decided_email"),
    decidedIp: text("decided_ip"),
    decisionNote: text("decision_note"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("console_quote_company_idx").on(t.companyId),
    uniqueIndex("console_quote_number_unique").on(t.year, t.seq),
  ],
);
/** Every proposal that went out, so earlier versions stay readable. */
export const quoteVersions = pgTable(
  "console_quote_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id),
    version: integer("version").notNull(),
    publication: jsonb("publication").$type<import("@/lib/quote-model").QuotePublication>().notNull(),
    documentHash: text("document_hash").notNull(),
    sentBy: text("sent_by")
      .notNull()
      .references(() => user.id),
    sentAt: created(),
  },
  (t) => [uniqueIndex("console_quote_version_unique").on(t.quoteId, t.version)],
);
/** How the in-Console assistant is tuned: one row, edited by staff. */
export const assistantSettings = pgTable("console_assistant_settings", {
  id: text("id").primaryKey().default("default"),
  /** OpenRouter model id, e.g. "anthropic/claude-sonnet-4.5". */
  model: text("model").notNull().default("anthropic/claude-sonnet-4.5"),
  /** Instructions appended to the built-in system prompt. */
  prompt: text("prompt").notNull().default(""),
  updatedBy: text("updated_by").references(() => user.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
/** Plain-text knowledge the assistant reads: how Anuntech works, policies, FAQs. */
export const assistantDocuments = pgTable("console_assistant_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  content: text("content").notNull(),
  bytes: integer("bytes").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
/** What Anuntech offers, defined once; companies get linked to items. */
export const catalogItems = pgTable("console_catalog_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  kind: text("kind", { enum: ["product", "service"] }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  /** Products: where the client opens it. */
  url: text("url"),
  defaultAmountCents: integer("default_amount_cents"),
  interval: text("interval", { enum: ["monthly", "yearly"] }),
  /** Services: the fixed sections of the detail page. */
  whatWeDo: text("what_we_do"),
  whatWeNeed: text("what_we_need"),
  expectedResults: text("expected_results"),
  deadlines: text("deadlines"),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const engagements = pgTable(
  "console_engagements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["product", "project", "service"] }).notNull(),
    status: text("status", { enum: ["active", "paused", "completed"] })
      .notNull()
      .default("active"),
    description: text("description"),
    /** Where a product lives; the client opens it from here. */
    url: text("url"),
    /** Products and services come from the catalog, with this company's price. */
    catalogItemId: text("catalog_item_id").references(() => catalogItems.id),
    amountCents: integer("amount_cents"),
    subscriptionId: text("subscription_id").references((): AnyPgColumn => subscriptions.id),
    createdAt: created(),
  },
  (t) => [index("console_engagement_company_idx").on(t.companyId)],
);
/** Work inside a project: one card on the board. `company_id` mirrors the
    project's company so access checks never need a join. */
export const tasks = pgTable(
  "console_tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    engagementId: text("engagement_id")
      .notNull()
      .references(() => engagements.id),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["backlog", "todo", "in_progress", "review", "done"],
    })
      .notNull()
      .default("todo"),
    priority: text("priority", { enum: ["low", "normal", "high", "urgent"] })
      .notNull()
      .default("normal"),
    dueDate: date("due_date"),
    /** Free-form tags, kept per task; colours derive from the text. */
    labels: text("labels").array().notNull().default([]),
    /** Development estimate, stored in minutes so "1,5 h" survives intact. */
    estimateMinutes: integer("estimate_minutes"),
    position: integer("position").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("console_task_engagement_idx").on(t.engagementId),
    index("console_task_board_idx").on(t.engagementId, t.status, t.position),
  ],
);
/** Who is working on a task; a task can have several people. */
export const taskAssignees = pgTable(
  "console_task_assignees",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.userId] }),
    index("console_task_assignee_user_idx").on(t.userId),
  ],
);
export const tickets = pgTable(
  "console_tickets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    engagementId: text("engagement_id").references(() => engagements.id),
    subject: text("subject").notNull(),
    status: text("status", {
      enum: ["open", "in_progress", "waiting_customer", "resolved", "closed"],
    })
      .notNull()
      .default("open"),
    priority: text("priority", { enum: ["normal", "high"] })
      .notNull()
      .default("normal"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    assignedTo: text("assigned_to"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("console_ticket_company_idx").on(t.companyId)],
);
export const messages = pgTable(
  "console_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    createdAt: created(),
  },
  (t) => [index("console_message_ticket_idx").on(t.ticketId)],
);
export const attachments = pgTable(
  "console_attachments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Exactly one of ticketId / taskId is set. */
    ticketId: text("ticket_id").references(() => tickets.id),
    taskId: text("task_id").references(() => tasks.id),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    content: bytea("content").notNull(),
    createdAt: created(),
  },
  (t) => [
    index("console_attachment_ticket_idx").on(t.ticketId),
    index("console_attachment_task_idx").on(t.taskId),
  ],
);
export const subscriptions = pgTable("console_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  engagementId: text("engagement_id").references(() => engagements.id),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  interval: text("interval", { enum: ["monthly", "yearly"] }).notNull(),
  /** Charge terms copied into each period's invoice. */
  discountCents: integer("discount_cents"),
  fineBps: integer("fine_bps"),
  interestMonthlyBps: integer("interest_monthly_bps"),
  anchorDay: integer("anchor_day").notNull(),
  anchorMonth: integer("anchor_month").notNull(),
  nextDueDate: date("next_due_date").notNull(),
  leadDays: integer("lead_days").notNull().default(5),
  collectionDays: integer("collection_days").notNull().default(30),
  status: text("status", { enum: ["draft", "active", "paused", "cancelled"] })
    .notNull()
    .default("draft"),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id),
  lastError: text("last_error"),
  createdAt: created(),
});
export const invoices = pgTable(
  "console_invoices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    engagementId: text("engagement_id").references(() => engagements.id),
    subscriptionId: text("subscription_id").references(() => subscriptions.id),
    publicId: text("public_id").unique(),
    publicEnabled: boolean("public_enabled").notNull().default(true),
    boletoPdf: text("boleto_pdf"),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date").notNull(),
    /**
     * When the obligation is already past due (a debt brought in from
     * elsewhere), the bank still needs a future date for the boleto/Pix.
     * Null means the boleto is due on `dueDate` itself.
     */
    bankDueDate: date("bank_due_date"),
    /** Charge terms sent to the bank: a discount until the due date, and fine + monthly interest after it (basis points). */
    discountCents: integer("discount_cents"),
    fineBps: integer("fine_bps"),
    interestMonthlyBps: integer("interest_monthly_bps"),
    status: text("status", { enum: ["draft", "issued", "paid", "cancelled"] })
      .notNull()
      .default("draft"),
    providerId: text("provider_id").unique(),
    bankRequest: jsonb("bank_request").$type<Record<string, unknown>>(),
    bankBase: text("bank_base"),
    bankStatus: text("bank_status"),
    bankCheckedAt: timestamp("bank_checked_at", { withTimezone: true }),
    boletoLine: text("boleto_line"),
    pixCopyPaste: text("pix_copy_paste"),
    boletoUrl: text("boleto_url"),
    fiscalStatus: text("fiscal_status", {
      enum: ["not_requested", "processing", "authorized", "error"],
    })
      .notNull()
      .default("not_requested"),
    fiscalUrl: text("fiscal_url"),
    createdAt: created(),
  },
  (t) => [
    index("console_invoice_company_idx").on(t.companyId),
    uniqueIndex("console_invoice_subscription_due_unique").on(
      t.subscriptionId,
      t.dueDate,
    ),
  ],
);
export const auditEvents = pgTable(
  "console_audit_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    companyId: text("company_id").references(() => companies.id),
    action: text("action").notNull(),
    entityId: text("entity_id").notNull(),
    details: jsonb("details"),
    createdAt: created(),
  },
  (t) => [index("console_audit_company_idx").on(t.companyId)],
);
export const emailDeliveries = pgTable("console_email_deliveries", {
  id: text("id").primaryKey(),
  membershipId: text("membership_id")
    .notNull()
    .references(() => memberships.id),
  payload: jsonb("payload")
    .$type<{ from: string; to: string[]; subject: string; text: string }>()
    .notNull(),
  status: text("status", { enum: ["pending", "accepted", "failed"] })
    .notNull()
    .default("pending"),
  providerId: text("provider_id"),
  createdAt: created(),
});

export type TicketNoticePayload = {
  from: string;
  to: string;
  subject?: string;
  text?: string;
  templateId?: string;
  parameters?: Record<string, string>;
  senderId?: string;
  options?: { enableBot: boolean };
};
export const ticketNotices = pgTable(
  "console_ticket_notices",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => auditEvents.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["email", "whatsapp"] }).notNull(),
    preferenceKey: text("preference_key"),
    destination: text("destination").notNull(),
    payload: jsonb("payload").$type<TicketNoticePayload>().notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    providerId: text("provider_id"),
    providerStatus: text("provider_status"),
    error: text("error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("console_ticket_notice_event_recipient_idx").on(
      t.eventId,
      t.channel,
      t.destination,
    ),
    index("console_ticket_notice_pending_idx").on(t.status, t.nextAttemptAt),
  ],
);

export type BillingNoticePayload = {
  from: string;
  to: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  templateId?: string;
  parameters?: Record<string, string>;
  senderId?: string;
  options?: { enableBot: boolean };
};
export const billingNotices = pgTable(
  "console_billing_notices",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    channel: text("channel", { enum: ["email", "whatsapp"] }).notNull(),
    recipient: text("recipient").notNull().default(""),
    kind: text("kind")
      .$type<import("@/lib/billing-notice-rules").BillingNoticeKind>()
      .notNull(),
    status: text("status", {
      enum: [
        "waiting",
        "pending",
        "sending",
        "accepted",
        "delivered",
        "failed",
        "expired",
        "skipped",
        "uncertain",
      ],
    })
      .notNull()
      .default("waiting"),
    payload: jsonb("payload").$type<BillingNoticePayload>(),
    providerId: text("provider_id"),
    providerStatus: text("provider_status"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("console_billing_notice_event_idx").on(
      t.invoiceId,
      t.channel,
      t.kind,
      t.recipient,
    ),
    index("console_billing_notice_pending_idx").on(t.status, t.nextAttemptAt),
  ],
);

/** Missing rows retain existing delivery defaults; client ticket notices are opt-in. */
export const notificationPreferences = pgTable(
  "console_notification_preferences",
  {
    key: text("key").primaryKey(),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    topic: text("topic", { enum: ["billing", "tickets"] }).notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    emails: jsonb("emails").$type<string[]>(),
    phones: jsonb("phones").$type<string[]>(),
    emailEnabled: boolean("email_enabled").notNull(),
    whatsappEnabled: boolean("whatsapp_enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const notificationSettings = pgTable("console_notification_settings", {
  id: text("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const environmentProfile = pgTable("console_environment_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document").notNull(),
  billingEmail: text("billing_email").notNull(),
  phone: text("phone"),
  billingAddress:
    jsonb("billing_address").$type<
      import("@/lib/company-billing").CompanyAddress
    >(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A folder of a company's bookmarks (companyId null = Anuntech's own).
 * "company" folders are open to everyone in the company; "people" folders
 * only to the owner and the people it was shared with.
 */
export const bookmarkFolders = pgTable(
  "console_bookmark_folders",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").references(() => companies.id),
    ownerId: text("owner_id").notNull().references(() => user.id),
    name: text("name").notNull(),
    visibility: text("visibility", { enum: ["company", "people"] })
      .notNull()
      .default("company"),
    createdAt: created(),
  },
  (t) => [
    index("console_bookmark_folder_owner_idx").on(t.ownerId),
    index("console_bookmark_folder_company_idx").on(t.companyId),
  ],
);
export const bookmarkFolderShares = pgTable(
  "console_bookmark_folder_shares",
  {
    folderId: text("folder_id").notNull().references(() => bookmarkFolders.id),
    userId: text("user_id").notNull().references(() => user.id),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.folderId, t.userId] }),
    index("console_bookmark_share_user_idx").on(t.userId),
  ],
);
/** A link or a small file of a company (companyId null = Anuntech's own). */
export const bookmarks = pgTable(
  "console_bookmarks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").references(() => companies.id),
    ownerId: text("author_id").notNull().references(() => user.id),
    folderId: text("folder_id").references(() => bookmarkFolders.id),
    title: text("title").notNull(),
    url: text("url"),
    fileName: text("file_name"),
    content: bytea("content"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("console_bookmark_owner_idx").on(t.ownerId),
    index("console_bookmark_folder_idx").on(t.folderId),
    index("console_bookmark_company_idx").on(t.companyId),
  ],
);

export const ticketUploads = pgTable("console_ticket_uploads", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => user.id),
  name: text("name").notNull(),
  expectedSize: integer("expected_size").notNull(),
  receivedSize: integer("received_size").notNull().default(0),
  content: bytea("content").notNull(),
  mime: text("mime"),
  ready: boolean("ready").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, t => [index("console_ticket_upload_author_idx").on(t.authorId)]);
