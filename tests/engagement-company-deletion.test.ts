import assert from "node:assert/strict";
import test from "node:test";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../src/db/schema";
import {
  COMPANY_DELETE_REFUSAL,
  ENGAGEMENT_DELETE_REFUSAL,
  canDeleteCompany,
  canDeleteEngagement,
} from "../src/lib/deletion-rules";

const free = { invoices: 0, subscriptions: 0, contracts: 0 };

test("a project, product or service goes only when nothing billed or signed points at it", () => {
  assert.equal(canDeleteEngagement(free), true);
  assert.equal(canDeleteEngagement({ ...free, invoices: 1 }), false);
  assert.equal(canDeleteEngagement({ ...free, subscriptions: 1 }), false);
  assert.equal(canDeleteEngagement({ ...free, contracts: 2 }), false);
  // Links not loaded (a client's page, a failed count) never offer the delete.
  assert.equal(canDeleteEngagement(undefined), false);
  assert.equal(canDeleteEngagement(null), false);
  assert.equal(canDeleteEngagement({ ...free, invoices: Number.NaN }), false);
  assert.match(ENGAGEMENT_DELETE_REFUSAL, /faturas ou contratos/);
});

test("a company goes only without invoices, recurrences, contracts or proposals", () => {
  const clean = { ...free, quotes: 0 };
  assert.equal(canDeleteCompany(clean), true);
  assert.equal(canDeleteCompany({ ...clean, invoices: 3 }), false);
  assert.equal(canDeleteCompany({ ...clean, subscriptions: 1 }), false);
  assert.equal(canDeleteCompany({ ...clean, contracts: 1 }), false);
  assert.equal(canDeleteCompany({ ...clean, quotes: 1 }), false);
  assert.equal(canDeleteCompany(undefined), false);
  assert.match(COMPANY_DELETE_REFUSAL, /arquive/);
});

/* The delete actions handle every foreign key by hand (children first, in one
   transaction). These pin the schema they were written against: a new table
   pointing at one of these records fails here until the action handles it. */

const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable => is(value, PgTable));

/** "table.column" for every foreign key pointing at `target`, with whether it may be null. */
function pointingAt(target: PgTable) {
  const name = getTableConfig(target).name;
  const found: Record<string, "null" | "not null"> = {};
  for (const table of tables) {
    const config = getTableConfig(table);
    for (const fk of config.foreignKeys) {
      const { columns, foreignColumns } = fk.reference();
      if (getTableConfig(foreignColumns[0].table).name !== name) continue;
      for (const column of columns)
        found[`${config.name}.${column.name}`] = column.notNull ? "not null" : "null";
    }
  }
  return found;
}

test("company deletion knows every table that points at a company", () => {
  assert.deepEqual(pointingAt(schema.companies), {
    // Refused while any exists.
    "console_invoices.company_id": "not null",
    "console_subscriptions.company_id": "not null",
    "console_contracts.company_id": "not null",
    "console_quotes.company_id": "not null",
    // Deleted with the company.
    "console_memberships.company_id": "not null",
    "console_engagements.company_id": "not null",
    "console_tasks.company_id": "not null",
    "console_tickets.company_id": "not null",
    "console_bookmark_folders.company_id": "null",
    "console_bookmarks.company_id": "null",
    "console_notification_preferences.company_id": "null",
    // Kept, set to null: the history outlives the company.
    "console_audit_events.company_id": "null",
  });
});

test("the children deleted with a company or its work are all accounted for", () => {
  assert.deepEqual(pointingAt(schema.engagements), {
    // Refused while any exists.
    "console_invoices.engagement_id": "null",
    "console_subscriptions.engagement_id": "null",
    "console_contracts.engagement_id": "null",
    // Deleted with it.
    "console_tasks.engagement_id": "not null",
    // Kept, unlinked.
    "console_tickets.engagement_id": "null",
  });
  assert.deepEqual(pointingAt(schema.tasks), {
    "console_task_assignees.task_id": "not null",
    "console_attachments.task_id": "null",
  });
  assert.deepEqual(pointingAt(schema.tickets), {
    "console_messages.ticket_id": "not null",
    "console_attachments.ticket_id": "null",
    "console_ticket_notices.ticket_id": "not null",
  });
  assert.deepEqual(pointingAt(schema.memberships), {
    "console_email_deliveries.membership_id": "not null",
  });
  assert.deepEqual(pointingAt(schema.bookmarkFolders), {
    "console_bookmark_folder_shares.folder_id": "not null",
    "console_bookmarks.folder_id": "null",
  });
  // Leaves: nothing points at these, so deleting their rows ends the chain.
  for (const leaf of [
    schema.messages,
    schema.attachments,
    schema.taskAssignees,
    schema.ticketNotices,
    schema.emailDeliveries,
    schema.bookmarks,
    schema.bookmarkFolderShares,
    schema.notificationPreferences,
  ])
    assert.deepEqual(pointingAt(leaf), {}, getTableConfig(leaf).name);
});
