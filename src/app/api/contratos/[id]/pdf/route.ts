import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contracts, companies, memberships } from "@/db/schema";
import {
  isAdministrator,
  hasPermission,
  normalizeEmail,
} from "@/lib/permissions";
import { contractPdf } from "@/lib/contract-pdf";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) return new Response(null, { status: 401 });
  const { id } = await params;
  const [row] = await db
    .select({ contract: contracts, company: companies })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .where(eq(contracts.id, id));
  if (!row) return new Response(null, { status: 404 });
  const c = row.contract;
  const admin = isAdministrator(
    session.user.email,
    true,
    process.env.CONSOLE_ADMIN_EMAIL,
  );
  const draft = new URL(request.url).searchParams.get("draft") === "1";
  if (!admin) {
    if (draft || !c.publishedAt || !c.publication)
      return new Response(null, { status: 404 });
    const [grant] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.companyId, c.companyId),
          eq(memberships.email, normalizeEmail(session.user.email)),
          eq(memberships.active, true),
        ),
      );
    if (!grant || !hasPermission(grant.role, "finance"))
      return new Response(null, { status: 404 });
  }
  const publication = !draft && c.publishedAt ? c.publication : null;
  if (!draft && !publication) return new Response(null, { status: 404 });
  const pdf = await contractPdf({
    ...(publication || {
      title: c.title,
      body: c.body,
      companyName: row.company.name,
      companyDocument: row.company.document,
    }),
    id,
    version: c.publishedVersion,
    date: publication ? c.publishedAt! : c.updatedAt,
    draft,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-${id}${draft ? "-rascunho" : `-v${c.publishedVersion}`}.pdf"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
