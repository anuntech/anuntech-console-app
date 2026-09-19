import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdministrator } from "@/lib/permissions";
import { normalizeCnpj, normalizeCep } from "@/lib/company-lookup";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified)
    return json({ error: "Entre na Console para consultar." }, 401);
  if (
    !isAdministrator(session.user.email, true, process.env.CONSOLE_ADMIN_EMAIL)
  )
    return json({ error: "Acesso restrito à administração." }, 403);
  const query = new URL(request.url).searchParams;
  const kind = query.get("tipo"),
    value = query.get("valor") || "";
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
