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
    "console_service_terms.company_id": "not null",
    "console_time_entries.company_id": "not null",
    "console_hours_months.company_id": "not null",
    "console_automation_events.company_id": "null",
    "console_journeys.company_id": "null",
    "console_engagement_suspensions.company_id": "not null",
    // Arquivos: uploads under way go with the company, their parts with them in R2.
    "console_file_uploads.company_id": "null",
    // Arquivos' earlier versions: their R2 keys are collected, the rows go with the bookmarks (cascade).
    "console_file_versions.company_id": "null",
    // Links to its files stop with it.
    "console_share_links.company_id": "null",
    // Gone with it by the database (on delete cascade): pushes still queued,
    // the Piloto automático's events and decisions about it,
    "console_push_notices.company_id": "not null",
    "console_events.company_id": "null",
    "console_decisions.company_id": "null",
    // The team's internal notes about it.
    "console_company_notes.company_id": "not null",
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
    "console_service_terms.engagement_id": "null",
    "console_engagement_suspensions.engagement_id": "not null",
    // Its deliveries' folder in Arquivos, with the copies inside (lib/drive/console-files.ts removeProjectFiles).
    "console_bookmark_folders.engagement_id": "null",
    // Kept, unlinked.
    "console_tickets.engagement_id": "null",
    "console_time_entries.engagement_id": "null",
    "console_journeys.engagement_id": "null",
    "console_journeys.hosting_engagement_id": "null",
    // Gone with it by the database (on delete cascade): a Membro's selection.
    "console_membership_engagements.engagement_id": "not null",
  });
  assert.deepEqual(pointingAt(schema.tasks), {
    "console_task_assignees.task_id": "not null",
    "console_task_comments.task_id": "not null",
    "console_attachments.task_id": "null",
  });
  // Its files go with it (deleted before it, like every task file).
  assert.deepEqual(pointingAt(schema.taskComments), {
    "console_attachments.comment_id": "null",
  });
  assert.deepEqual(pointingAt(schema.tickets), {
    "console_messages.ticket_id": "not null",
    "console_attachments.ticket_id": "null",
    "console_ticket_notices.ticket_id": "not null",
    // Hours stay in the bank, unlinked; so does a proposal it asked for.
    "console_time_entries.ticket_id": "null",
    "console_quotes.ticket_id": "null",
    "console_journeys.ticket_id": "null",
  });
  // A proposal's deletion unlinks what was made from it (quote-deletion.ts).
  assert.deepEqual(pointingAt(schema.quotes), {
    "console_contracts.quote_id": "null",
    "console_engagements.quote_id": "null",
    "console_invoices.quote_id": "null",
    "console_quote_versions.quote_id": "not null",
    "console_journeys.quote_id": "null",
  });
  // A journey's steps go with it (deleteJourney and company deletion).
  assert.deepEqual(pointingAt(schema.journeys), {
    "console_journey_steps.journey_id": "not null",
  });
  assert.deepEqual(pointingAt(schema.memberships), {
    "console_email_deliveries.membership_id": "not null",
    // On delete cascade.
    "console_membership_engagements.membership_id": "not null",
  });
  assert.deepEqual(pointingAt(schema.bookmarkFolders), {
    "console_bookmark_folder_shares.folder_id": "not null",
    "console_bookmarks.folder_id": "null",
    "console_file_uploads.folder_id": "null",
    // Subfolders move up a level when their folder goes (bookmark-core, deleteFolderAs).
    "console_bookmark_folders.parent_id": "null",
    // A folder's links go with it (on delete cascade).
    "console_share_links.folder_id": "null",
  });
  // Leaves: nothing points at these, so deleting their rows ends the chain.
  for (const leaf of [
    schema.messages,
    schema.attachments,
    schema.taskAssignees,
    schema.ticketNotices,
    schema.emailDeliveries,
    schema.bookmarkFolderShares,
    schema.notificationPreferences,
    schema.journeySteps,
    schema.membershipEngagements,
  ])
    assert.deepEqual(pointingAt(leaf), {}, getTableConfig(leaf).name);
  // A bookmark's versions and its text go with it, by the database (on delete cascade).
  assert.deepEqual(pointingAt(schema.bookmarks), { "console_bookmark_stars.bookmark_id": "not null", "console_file_texts.bookmark_id": "not null", "console_file_versions.bookmark_id": "not null", "console_share_links.bookmark_id": "null" });
});
