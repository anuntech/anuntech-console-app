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
} from "drizzle-orm/pg-core";
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
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
    role: text("role", { enum: ["manager", "support", "finance"] }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("console_membership_unique").on(t.companyId, t.email),
    index("console_membership_email_idx").on(t.email),
  ],
);
export type ContractPublication = {
  title: string;
  body: string;
  companyName: string;
  companyDocument: string;
};
export const contracts = pgTable(
  "console_contracts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    revision: integer("revision").notNull().default(1),
    publication: jsonb("publication").$type<ContractPublication>(),
    publishedVersion: integer("published_version").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
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
    kind: text("kind", { enum: ["product", "project"] }).notNull(),
    status: text("status", { enum: ["active", "paused", "completed"] })
      .notNull()
      .default("active"),
    description: text("description"),
    createdAt: created(),
  },
  (t) => [index("console_engagement_company_idx").on(t.companyId)],
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
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});
export const attachments = pgTable(
  "console_attachments",
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
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    content: bytea("content").notNull(),
    createdAt: created(),
  },
  (t) => [index("console_attachment_ticket_idx").on(t.ticketId)],
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

export const companyInvites = pgTable("console_company_invites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  label: text("label").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status", { enum: ["open", "submitted", "approved", "revoked"] })
    .notNull()
    .default("open"),
  payload:
    jsonb("payload").$type<import("@/lib/company-input").CompanyRegistration>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  companyId: text("company_id").references(() => companies.id),
  lookupCount: integer("lookup_count").notNull().default(0),
  createdAt: created(),
});

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
    ),
    index("console_billing_notice_pending_idx").on(t.status, t.nextAttemptAt),
  ],
);
