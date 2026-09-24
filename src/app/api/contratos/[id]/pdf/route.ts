import { and, asc, eq } from "drizzle-orm";
import { contracts, companies, contractSignatures, contractVersions } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { contractPdf } from "@/lib/contract-pdf";
export const runtime = "nodejs";

/**
 * The signed PDF when there is one; otherwise the current text, rendered
 * now. `?versao=N` renders an earlier version, marked as superseded.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const requested = Number(new URL(request.url).searchParams.get("versao"));
  const version =
    Number.isInteger(requested) && requested > 0
      ? (
          await db
            .select()
            .from(contractVersions)
            .where(and(eq(contractVersions.contractId, id), eq(contractVersions.version, requested)))
        )[0]
      : null;
  if (requested && !version) return new Response(null, { status: 404 });
  const superseded = !!version && version.documentHash !== c.documentHash;
  const slug = `${c.kind === "amendment" ? "aditivo" : "contrato"}-${c.title.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 80) || id}`;
  const filename = `${slug}${superseded ? `-v${version.version}` : c.status === "signed" ? "-assinado" : ""}.pdf`;
  const headers = (length: number) => ({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Content-Length": String(length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (!superseded && c.status === "signed" && c.signedPdf)
    return new Response(new Uint8Array(c.signedPdf), { headers: headers(c.signedPdf.length) });
  const hash = superseded ? version.documentHash : c.status === "draft" ? null : c.documentHash;
  const signatures = hash
    ? await db
        .select()
        .from(contractSignatures)
        .where(and(eq(contractSignatures.contractId, id), eq(contractSignatures.documentHash, hash)))
        .orderBy(asc(contractSignatures.signedAt))
    : [];
  const publication = superseded
    ? {
        ...(c.publication ?? {}),
        title: version.title,
        body: version.body,
        companyName: row.company.name,
        companyDocument: row.company.document,
        kind: c.kind,
      }
    : c.status !== "draft" && c.publication
      ? c.publication
      : {
          title: c.title,
          body: c.body,
          companyName: row.company.name,
          companyDocument: row.company.document,
          kind: c.kind,
          startsAt: c.startsAt,
          endsAt: c.endsAt,
        };
  const pdf = await contractPdf({
    ...publication,
    id,
    status: superseded ? "sent" : c.status,
    date: superseded ? version.sentAt : c.status === "draft" ? c.updatedAt : (c.signedAt ?? c.publishedAt ?? c.updatedAt),
    hash,
    superseded,
    version: superseded ? version.version : c.publishedVersion || undefined,
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
