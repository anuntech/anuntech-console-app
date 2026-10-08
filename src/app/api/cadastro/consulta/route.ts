import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getConsoleStaffAccess } from "@/lib/access/console-members";
import { normalizeCnpj, normalizeCep } from "@/lib/companies/company-lookup";
import { allowedIds, getActor } from "@/lib/access/access";
import { reserveHourly } from "@/lib/http/hourly-limit";
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
    if (!(await reserveHourly("cep", actor.user.id, 20)))
      return json({ error: "Muitas consultas na última hora. Preencha o endereço manualmente." }, 429);
  }
  if (!(
    (kind === "cnpj" && /^\d{14}$/.test(value)) ||
    (kind === "cep" && /^\d{8}$/.test(value))
  ))
    return json(
      { error: "Informe um CNPJ com 14 dígitos ou CEP com 8 dígitos." },
      400,
    );
  try {
    const url =
      kind === "cnpj"
        ? `https://publica.cnpj.ws/cnpj/${value}`
        : `https://viacep.com.br/ws/${value}/json/`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      cache: "no-store",
    });
    if (res.status === 429)
      return json(
        {
          error:
            "Limite de consultas atingido. Aguarde um minuto ou preencha manualmente.",
        },
        429,
      );
    if (res.status === 404)
      return json(
        {
          error: `${kind === "cnpj" ? "CNPJ" : "CEP"} não encontrado. Confira o número ou preencha manualmente.`,
        },
        404,
      );
    if (!res.ok) throw Error();
    const data = await res.json();
    if (data.erro)
      return json(
        {
          error:
            "CEP não encontrado. Confira o número ou preencha manualmente.",
        },
        404,
      );
    const fields =
      kind === "cnpj" ? normalizeCnpj(data, value) : normalizeCep(data, value);
    return json({ fields });
  } catch {
    return json(
      {
        error:
          "A consulta está indisponível no momento. Tente novamente ou preencha os dados manualmente.",
      },
      502,
    );
  }
}
