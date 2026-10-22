import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getConsoleStaffAccess } from "@/lib/access/console-members";
import { CEP_LIMIT_MESSAGE, lookupRegistry, reserveCepLookup } from "@/lib/companies/registry-lookup";
import { allowedIds, getActor } from "@/lib/access/access";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) return json({ error: "Entre de novo para consultar." }, 401);
  const admin = (await getConsoleStaffAccess(session.user.email)).admin;
  const query = new URL(request.url).searchParams;
  const kind = query.get("tipo"),
    value = query.get("valor") || "";
  // A client's Administrador fills the company's address by CEP (Configurações → Dados da empresa); CNPJ stays with the team.
  if (!admin) {
    const actor = await getActor();
    if (kind !== "cep" || !allowedIds(actor, "finance").length) return json({ error: "Acesso restrito à administração." }, 403);
    if (!(await reserveCepLookup(actor.user.id)))
      return json({ error: CEP_LIMIT_MESSAGE }, 429);
  }
  const result = await lookupRegistry(kind, value);
  return "fields" in result ? json({ fields: result.fields }) : json({ error: result.error }, result.status);
}
