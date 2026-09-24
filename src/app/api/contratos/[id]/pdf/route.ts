import { asc, eq } from "drizzle-orm";
import { contracts, companies, contractSignatures } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { contractPdf } from "@/lib/contract-pdf";
export const runtime = "nodejs";

/** The signed PDF when there is one; otherwise the current text, rendered now. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({ contract: contracts, company: companies })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .where(eq(contracts.id, id));
  if (!row || !canAccess(actor, row.contract.companyId, "finance")) return new Response(null, { status: 404 });
  const c = row.contract;
  if (!actor.admin && (c.status === "draft" || c.status === "cancelled")) return new Response(null, { status: 404 });
  const filename = `contrato-${c.title.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 80) || id}${c.status === "signed" ? "-assinado" : ""}.pdf`;
  const headers = (length: number) => ({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Length": String(length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (c.status === "signed" && c.signedPdf)
    return new Response(new Uint8Array(c.signedPdf), { headers: headers(c.signedPdf.length) });
  const signatures = await db
    .select()
    .from(contractSignatures)
    .where(eq(contractSignatures.contractId, id))
    .orderBy(asc(contractSignatures.signedAt));
  const publication =
    c.status !== "draft" && c.publication
      ? c.publication
      : { title: c.title, body: c.body, companyName: row.company.name, companyDocument: row.company.document };
  const pdf = await contractPdf({
    ...publication,
    id,
    status: c.status,
    date: c.status === "draft" ? c.updatedAt : (c.signedAt ?? c.publishedAt ?? c.updatedAt),
    hash: c.status === "draft" ? null : c.documentHash,
    signatures: signatures.map((s) => ({
      party: s.party,
      name: s.name,
      email: s.email,
      signedAt: s.signedAt,
      ip: s.ip,
      method: s.method,
    })),
  });
  return new Response(new Uint8Array(pdf), { headers: headers(pdf.length) });
}
