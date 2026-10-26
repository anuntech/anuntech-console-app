import "server-only";
import { AwsClient } from "aws4fetch";

/*
 * The files of Arquivos in Cloudflare R2, through its S3 API. The bucket is
 * private: the browser sends each part and reads each file through an
 * address signed here for a few minutes, after the Console checked access.
 * The bytes never pass through the Console's functions (Vercel takes 4.5 MB
 * per request).
 *
 * Environment: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET; the tests point R2_ENDPOINT at a local stand-in.
 */

export class StorageError extends Error {}

function settings() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;
  return { client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto", retries: 2 }), base: `${endpoint.replace(/\/$/, "")}/${bucket}` };
}

/** Without the keys, Arquivos keeps the small files in the database, as before. */
export const storageConfigured = () => settings() !== null;

function need() {
  const s = settings();
  if (!s) throw new StorageError("O armazenamento de arquivos não está configurado.");
  return s;
}

const objectUrl = (base: string, key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null;
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Signed here, sent with the plain fetch (a URL string, which the test stand-ins and fetch wrappers expect). */
async function signedFetch(url: string, init: RequestInit = {}) {
  const { client } = need();
  const signed = await client.sign(url, init);
  return fetch(signed.url, { method: signed.method, headers: signed.headers, body: init.body, signal: AbortSignal.timeout(20_000) });
}

async function call(url: string, init: RequestInit, what: string) {
  const response = await signedFetch(url, init);
  if (!response.ok) throw new StorageError(`${what}: R2 respondeu ${response.status}.`);
  return response;
}

export async function startMultipart(key: string, contentType: string) {
  const { base } = need();
  const xml = await (await call(`${objectUrl(base, key)}?uploads`, { method: "POST", headers: { "content-type": contentType } }, "Início do envio")).text();
  const uploadId = tag(xml, "UploadId");
  if (!uploadId) throw new StorageError("Início do envio: o R2 não devolveu o identificador.");
  return uploadId;
}

/** Where the browser PUTs one part; valid for an hour. */
export async function partUrl(key: string, uploadId: string, partNumber: number) {
  const { client, base } = need();
  const url = new URL(objectUrl(base, key));
  url.searchParams.set("partNumber", String(partNumber));
  url.searchParams.set("uploadId", uploadId);
  url.searchParams.set("X-Amz-Expires", "3600");
  return (await client.sign(url, { method: "PUT", aws: { signQuery: true } })).url;
}

export async function completeMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
  const { base } = need();
  const body = `<CompleteMultipartUpload>${parts
    .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${escapeXml(p.etag)}</ETag></Part>`)
    .join("")}</CompleteMultipartUpload>`;
  const xml = await (
    await call(`${objectUrl(base, key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "POST", body, headers: { "content-type": "application/xml" } }, "Conclusão do envio")
  ).text();
  // S3 can answer 200 with an error inside the body.
  if (/<Error>/.test(xml)) throw new StorageError(`Conclusão do envio: ${tag(xml, "Code") ?? "erro"}.`);
}

export async function abortMultipart(key: string, uploadId: string) {
  const { base } = need();
  // Gone already counts as done.
  const response = await signedFetch(`${objectUrl(base, key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new StorageError(`Cancelamento do envio: R2 respondeu ${response.status}.`);
}

/** The stored size, or null when there is no such object. */
export async function objectSize(key: string) {
  const { base } = need();
  const response = await signedFetch(objectUrl(base, key), { method: "HEAD" });
  if (response.status === 404) return null;
  if (!response.ok) throw new StorageError(`Consulta do arquivo: R2 respondeu ${response.status}.`);
  return Number(response.headers.get("content-length") ?? 0);
}

/** A download address valid for five minutes, saved under its own name. */
export async function downloadUrl(key: string, fileName: string, inline = false) {
  const { client, base } = need();
  const url = new URL(objectUrl(base, key));
  url.searchParams.set("X-Amz-Expires", "300");
  url.searchParams.set("response-content-disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  url.searchParams.set("response-cache-control", "private, no-store");
  return (await client.sign(url, { method: "GET", aws: { signQuery: true } })).url;
}

/** A small file sent by the Console itself (the files that lived in the database). */
export async function putObject(key: string, body: Uint8Array, contentType = "application/octet-stream") {
  const { base } = need();
  await call(objectUrl(base, key), { method: "PUT", body: body as unknown as BodyInit, headers: { "content-type": contentType } }, "Envio do arquivo");
}

export async function deleteObject(key: string) {
  const { base } = need();
  const response = await signedFetch(objectUrl(base, key), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new StorageError(`Exclusão do arquivo: R2 respondeu ${response.status}.`);
}

/**
 * After a bookmark, a folder or a company is gone: its files leave R2 too.
 * Never blocks the deletion; a file left behind is only space, logged by key.
 */
export async function removeStoredFiles(keys: (string | null | undefined)[]) {
  const present = keys.filter((key): key is string => !!key);
  if (!present.length || !storageConfigured()) return;
  await Promise.all(
    present.map((key) => deleteObject(key).catch((error) => console.error("[arquivos] delete failed", key, error instanceof Error ? error.message : error))),
  );
}
