import "server-only";
import { sql } from "drizzle-orm";
import { invoices, subscriptions } from "@/db/schema";
import { saoPauloDate } from "../dates";

/**
 * The due date a product or service shows: the open invoice still to be paid
 * first (the recurrence itself already points one period ahead), else the
 * recurrence's next one. None for a paused or cancelled recurrence.
 */
export const productNextDueDate = () =>
  sql<string | null>`case when ${subscriptions.status} = 'active' then coalesce((select min(${invoices.dueDate}) from ${invoices} where ${invoices.subscriptionId} = ${subscriptions.id} and ${invoices.status} = 'issued' and ${invoices.dueDate} >= ${saoPauloDate()}), ${subscriptions.nextDueDate}) end`;
