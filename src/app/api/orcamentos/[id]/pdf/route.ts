import { and, eq } from "drizzle-orm";
import { companies, quoteVersions, quotes } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { quoteNumberLabel, type QuotePublication } from "@/lib/quote-model";
import { quotePdf } from "@/lib/quote-pdf";
export const runtime = "nodejs";

/**
 * The proposal as a PDF, rendered now from the frozen publication (or the
 * draft). `?versao=N` renders an earlier version, marked as superseded.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({ quote: quotes, company: companies })
    .from(quotes)
    .innerJoin(companies, eq(companies.id, quotes.companyId))
    .where(eq(quotes.id, id));
  if (!row || !canAccess(actor, row.quote.companyId, "finance")) return new Response(null, { status: 404 });
  const q = row.quote;
  if (!actor.admin && (q.status === "draft" || q.status === "cancelled")) return new Response(null, { status: 404 });
  const requested = Number(new URL(request.url).searchParams.get("versao"));
  const version =
    Number.isInteger(requested) && requested > 0
      ? (
          await db
            .select()
            .from(quoteVersions)
            .where(and(eq(quoteVersions.quoteId, id), eq(quoteVersions.version, requested)))
        )[0]
      : null;
  if (requested && !version) return new Response(null, { status: 404 });
  const superseded = !!version && version.documentHash !== q.documentHash;
  const number = quoteNumberLabel(q.year, q.seq);
  const publication: QuotePublication = superseded
    ? version.publication
    : q.status !== "draft" && q.publication
      ? q.publication
      : {
          ...q.content,
          title: q.title,
          number,
          companyName: row.company.name,
          companyDocument: row.company.document,
          validUntil: q.validUntil,
          version: 0,
        };
  const slug = `orcamento-${number}-${q.title.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 80) || id}`;
  const filename = `${slug}${superseded ? `-v${version.version}` : q.status === "accepted" ? "-aceito" : ""}.pdf`;
  const pdf = await quotePdf({
    ...publication,
    id,
    status: superseded ? "sent" : q.status,
    date: superseded ? version.sentAt : q.status === "draft" ? q.updatedAt : (q.publishedAt ?? q.updatedAt),
    hash: superseded ? version.documentHash : q.status === "draft" ? null : q.documentHash,
    superseded,
    decision:
      !superseded && (q.status === "accepted" || q.status === "declined") && q.decidedAt && q.decidedParty && q.decidedName
        ? {
            status: q.status,
            party: q.decidedParty,
            name: q.decidedName,
            email: q.decidedEmail,
            at: q.decidedAt,
            ip: q.decidedIp,
            note: q.decisionNote,
          }
        : null,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
