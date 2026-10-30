import { timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { invoices } from "@/db/schema";
import { interBase } from "@/lib/integrations/integrations";
import { reconcileCharge } from "@/lib/billing/billing-sync";
import { chargeIdsFromWebhook } from "@/lib/billing/inter-webhook";

export const maxDuration = 60;

/**
 * Inter's charge webhook, as a nudge only: the body names the charges that
 * changed, and each is checked at Inter right away, the same way the
 * billing-sync cron does every 5 minutes. Nothing in the body is trusted:
 * paid means RECEBIDO from Inter's own answer (rules.md). Off (404) until
 * INTER_WEBHOOK_TOKEN exists and the URL with ?token= is registered at Inter.
 */
export async function POST(request: Request) {
  const token = process.env.INTER_WEBHOOK_TOKEN;
  if (!token) return new Response(null, { status: 404 });
  const given = Buffer.from(new URL(request.url).searchParams.get("token") ?? "");
  const expected = Buffer.from(token);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response(null, { status: 401 });
  const text = await request.text();
  if (text.length > 200_000) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const ids = chargeIdsFromWebhook(body);
  if (!ids.length) return Response.json({ received: 0 });
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(inArray(invoices.providerId, ids), eq(invoices.status, "issued"), eq(invoices.bankBase, interBase())));
  // Inter waits a few seconds for the answer: the checks run after it, and the cron is still the safety net.
  after(async () => {
    for (const { id } of rows) {
      try {
        await reconcileCharge(id, undefined, undefined, "scheduled");
        revalidatePath(`/financeiro/${id}`);
      } catch (e) {
        console.error("[inter-webhook] reconcile failed", id, e instanceof Error ? e.message : "erro");
      }
    }
    if (rows.length) {
      revalidatePath("/financeiro");
      revalidatePath("/painel");
    }
  });
  return Response.json({ received: rows.length });
}
