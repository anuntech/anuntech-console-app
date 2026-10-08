import "server-only";
import https from "node:https";
import { X509Certificate, createPrivateKey } from "node:crypto";

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
  ) {
    super(`${provider}: resposta HTTP ${status}.`);
  }
}
function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name}.`);
  return value;
}
export function interBase() {
  const base = required("INTER_API_BASE_URL").replace(/\/$/, "");
  if (
    ![
      "https://cdpj.partners.bancointer.com.br",
      "https://cdpj-sandbox.partners.uatinter.co",
    ].includes(base)
  )
    throw new Error("Endereço Inter não reconhecido.");
  return base;
}
/** When the Inter client certificate stops working; null when it is not configured or unreadable. */
export function interCertificateExpiry(): Date | null {
  try {
    const cert = Buffer.from(process.env.INTER_CERTIFICATE_BASE64 ?? "", "base64");
    return cert.length ? new Date(new X509Certificate(cert).validTo) : null;
  } catch {
    return null;
  }
}
async function interRequest(
  path: string,
  method: string,
  body?: string,
  token?: string,
) {
  const cert = Buffer.from(required("INTER_CERTIFICATE_BASE64"), "base64");
  const key = Buffer.from(required("INTER_PRIVATE_KEY_BASE64"), "base64");
  const certificate = new X509Certificate(cert);
  if (
    !certificate.checkPrivateKey(createPrivateKey(key)) ||
    Date.parse(certificate.validTo) <= Date.now()
  )
    throw new Error("Confira o certificado Inter e sua validade.");
  return new Promise<unknown>((resolve, reject) => {
    const req = https.request(
      new URL(path, interBase()),
      {
        method,
        cert,
        key,
        timeout: 20000,
        headers: {
          Accept: "application/json",
          "Content-Type": token
            ? "application/json"
            : "application/x-www-form-urlencoded",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 8_000_000)
            req.destroy(new Error("Resposta excedeu o limite."));
          else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300)
            return reject(new ProviderError("Inter", res.statusCode || 0));
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
          } catch {
            reject(new Error("Resposta inválida do Inter."));
          }
        });
      },
    );
    req.on("error", () =>
      reject(new Error("Não foi possível confirmar a resposta do Inter.")),
    );
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado.")));
    req.end(body);
  });
}
let cachedToken: { base: string; value: string; expires: number } | undefined;
let pendingToken: Promise<string> | undefined;
export async function interToken() {
  const base = interBase();
  if (cachedToken?.base === base && cachedToken.expires > Date.now())
    return cachedToken.value;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    const data = (await interRequest(
      "/oauth/v2/token",
      "POST",
      new URLSearchParams({
        client_id: required("INTER_CLIENT_ID"),
        client_secret: required("INTER_CLIENT_SECRET"),
        grant_type: "client_credentials",
        scope: "boleto-cobranca.read boleto-cobranca.write",
      }).toString(),
    )) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error("Inter não retornou token.");
    cachedToken = {
      base,
      value: data.access_token,
      expires:
        Date.now() + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000,
    };
    return data.access_token;
  })();
  try {
    return await pendingToken;
  } finally {
    pendingToken = undefined;
  }
}
export async function interApi(
  path: string,
  method = "GET",
  payload?: unknown,
) {
  if (!path.startsWith("/cobranca/v3/"))
    throw new Error("Operação não permitida.");
  return interRequest(
    path,
    method,
    payload === undefined ? undefined : JSON.stringify(payload),
    await interToken(),
  );
}
export type FlwChannel = { id: string; active: boolean; type: string };
export async function flwChannels(): Promise<FlwChannel[]> {
  const url = new URL(required("FLW_API_BASE_URL"));
  if (url.origin !== "https://api.wts.chat")
    throw new Error("Endereço FLW não reconhecido.");
  const res = await fetch(new URL("/chat/v1/channel", url), {
    headers: {
      Authorization: `Bearer ${required("FLW_SYNOVA").replace(/^Bearer\s+/i, "")}`,
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new ProviderError("FLW", res.status);
  const result = await res.json();
  if (!Array.isArray(result)) throw new Error("Resposta FLW inválida.");
  return result.filter(
    (c) => typeof c.id === "string" && c.active && /WHATSAPP/i.test(c.type),
  );
}
export async function checkFocus(environment: "production" | "homologation") {
  const base =
    environment === "production"
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br";
  const token = required(
    environment === "production"
      ? "FOCUS_NFE_TOKEN_PRODUCTION"
      : "FOCUS_NFE_TOKEN_HOMOLOGATION",
  );
  // Consulta somente leitura a uma referência inexistente; não cria documento fiscal.
  const res = await fetch(
    `${base}/v2/nfse/console-connectivity-probe-nonexistent`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await res.json().catch(() => null);
  if (!(res.ok || (res.status === 404 && data?.codigo === "nao_encontrado")))
    throw new ProviderError("Focus NFe", res.status);
}
