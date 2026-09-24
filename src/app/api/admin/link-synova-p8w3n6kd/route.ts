import "server-only";
import { and, eq, ilike, inArray, isNull } from "drizzle-orm";
import {
  catalogItems,
  companies,
  engagements,
  invoices,
  subscriptions,
} from "@/db/schema";
import { db } from "@/lib/db";

/**
 * One-shot data fix: links the existing Synova products to a catalog item
 * and to each company's Synova recurrence and invoices. `?mode=plan` only
 * reports what would change; `?mode=apply` does it. Remove after use.
 */
export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") ?? "plan";
  const [products, subs, catalog] = await Promise.all([
    db
      .select({
        id: engagements.id,
        name: engagements.name,
        kind: engagements.kind,
        status: engagements.status,
        url: engagements.url,
        companyId: engagements.companyId,
        company: companies.name,
        catalogItemId: engagements.catalogItemId,
        subscriptionId: engagements.subscriptionId,
        amountCents: engagements.amountCents,
      })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(and(inArray(engagements.kind, ["product", "service"]), ilike(engagements.name, "%synova%"))),
    db
      .select({
        id: subscriptions.id,
        companyId: subscriptions.companyId,
        company: companies.name,
        description: subscriptions.description,
        amountCents: subscriptions.amountCents,
        interval: subscriptions.interval,
        nextDueDate: subscriptions.nextDueDate,
        status: subscriptions.status,
        engagementId: subscriptions.engagementId,
      })
      .from(subscriptions)
      .innerJoin(companies, eq(companies.id, subscriptions.companyId))
      .where(ilike(subscriptions.description, "%synova%")),
    db.select().from(catalogItems).where(ilike(catalogItems.name, "synova")),
  ]);
  const looseInvoices = await db
    .select({
      id: invoices.id,
      companyId: invoices.companyId,
      description: invoices.description,
      subscriptionId: invoices.subscriptionId,
      status: invoices.status,
    })
    .from(invoices)
    .where(and(ilike(invoices.description, "%synova%"), isNull(invoices.engagementId)));

  // One product per company; one recurrence per company: pair them up.
  const plan: {
    company: string;
    companyId: string;
    engagementId: string | null;
    subscriptionId: string | null;
    amountCents: number | null;
    action: "link" | "create-product" | "ambiguous" | "no-subscription";
    invoices: number;
  }[] = [];
  const companyIds = [...new Set([...products.map((p) => p.companyId), ...subs.map((s) => s.companyId)])];
  for (const companyId of companyIds) {
    const companyProducts = products.filter((p) => p.companyId === companyId);
    const companySubs = subs.filter((s) => s.companyId === companyId);
    const company = companyProducts[0]?.company ?? companySubs[0]?.company ?? companyId;
    const invoiceCount = looseInvoices.filter((i) => i.companyId === companyId).length;
    if (companyProducts.length > 1 || companySubs.length > 1) {
      plan.push({ company, companyId, engagementId: null, subscriptionId: null, amountCents: null, action: "ambiguous", invoices: invoiceCount });
      continue;
    }
    const product = companyProducts[0] ?? null;
    const sub = companySubs[0] ?? null;
    plan.push({
      company,
      companyId,
      engagementId: product?.id ?? null,
      subscriptionId: sub?.id ?? null,
      amountCents: sub?.amountCents ?? product?.amountCents ?? null,
      action: !product ? "create-product" : !sub ? "no-subscription" : "link",
      invoices: invoiceCount,
    });
  }

  if (mode !== "apply")
    return Response.json({
      mode,
      catalogItem: catalog[0] ?? null,
      products: products.map(({ id, name, company, status, url, subscriptionId, amountCents }) => ({ id, name, company, status, url, subscriptionId, amountCents })),
      subscriptions: subs.map(({ id, company, description, amountCents, interval, nextDueDate, status, engagementId }) => ({ id, company, description, amountCents, interval, nextDueDate, status, engagementId })),
      looseInvoices: looseInvoices.length,
      plan,
    });

  const amounts = subs.map((s) => s.amountCents);
  const commonAmount = amounts.length
    ? [...amounts].sort((a, b) => amounts.filter((v) => v === b).length - amounts.filter((v) => v === a).length)[0]
    : null;
  const applied = await db.transaction(async (tx) => {
    const [item] =
      catalog.length > 0
        ? catalog
        : await tx
            .insert(catalogItems)
            .values({
              kind: "product",
              name: "Synova",
              description: null,
              url: products.find((p) => p.url)?.url ?? null,
              defaultAmountCents: commonAmount,
              interval: subs[0]?.interval ?? "monthly",
            })
            .returning();
    let linked = 0;
    let created = 0;
    let invoicesLinked = 0;
    for (const row of plan) {
      if (row.action === "ambiguous") continue;
      let engagementId = row.engagementId;
      if (row.action === "create-product") {
        const [eng] = await tx
          .insert(engagements)
          .values({
            companyId: row.companyId,
            kind: "product",
            name: "Synova",
            url: item.url,
            catalogItemId: item.id,
            amountCents: row.amountCents,
            subscriptionId: row.subscriptionId,
          })
          .returning({ id: engagements.id });
        engagementId = eng.id;
        created += 1;
      } else {
        await tx
          .update(engagements)
          .set({
            catalogItemId: item.id,
            amountCents: row.amountCents,
            ...(row.subscriptionId ? { subscriptionId: row.subscriptionId } : {}),
            ...(item.url ? { url: item.url } : {}),
          })
          .where(eq(engagements.id, engagementId!));
        linked += 1;
      }
      if (row.subscriptionId) {
        await tx
          .update(subscriptions)
          .set({ engagementId })
          .where(and(eq(subscriptions.id, row.subscriptionId), isNull(subscriptions.engagementId)));
        const bySub = await tx
          .update(invoices)
          .set({ engagementId })
          .where(and(eq(invoices.subscriptionId, row.subscriptionId), isNull(invoices.engagementId)))
          .returning({ id: invoices.id });
        invoicesLinked += bySub.length;
      }
      const loose = await tx
        .update(invoices)
        .set({ engagementId })
        .where(
          and(
            eq(invoices.companyId, row.companyId),
            ilike(invoices.description, "%synova%"),
            isNull(invoices.engagementId),
          ),
        )
        .returning({ id: invoices.id });
      invoicesLinked += loose.length;
    }
    return { catalogItemId: item.id, linked, created, invoicesLinked };
  });
  return Response.json({ mode, applied, skipped: plan.filter((row) => row.action === "ambiguous") });
}
