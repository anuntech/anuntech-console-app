import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

/**
 * A stand-in for Cloudflare R2's S3 API, enough for Arquivos (lib/drive/r2.ts):
 * multipart uploads, HEAD, GET with a signed address, PUT and DELETE. A real
 * HTTP server, since both the Console (signing, finishing) and the suite
 * (playing the browser, sending the parts) talk to it. Every request must be
 * signed, by header or by query, and a signed address must not have expired.
 */
export async function startR2Mock() {
  const objects = new Map();
  const uploads = new Map();
  const requests = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://r2.local");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const signedByQuery = url.searchParams.has("X-Amz-Signature");
    const key = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
    requests.push({ method: req.method, key, query: Object.fromEntries(url.searchParams), signedByQuery });
    const send = (status, text = "", headers = {}) => {
      res.writeHead(status, headers);
      res.end(text);
    };
    if (!signedByQuery && !String(req.headers.authorization ?? "").startsWith("AWS4-HMAC-SHA256")) return send(403, "<Error><Code>AccessDenied</Code></Error>");
    if (signedByQuery) {
      const stamp = url.searchParams.get("X-Amz-Date") ?? "";
      const at = Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`);
      if (!at || Date.now() > at + Number(url.searchParams.get("X-Amz-Expires") ?? 0) * 1000) return send(403, "<Error><Code>AccessDenied</Code><Message>expired</Message></Error>");
    }
    const uploadId = url.searchParams.get("uploadId");
    if (req.method === "POST" && url.searchParams.has("uploads")) {
      const id = randomUUID();
      uploads.set(id, { key, parts: new Map() });
      return send(200, `<InitiateMultipartUploadResult><Key>${key}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    }
    if (req.method === "PUT" && uploadId) {
      const upload = uploads.get(uploadId);
      if (!upload || upload.key !== key) return send(404, "<Error><Code>NoSuchUpload</Code></Error>");
      const etag = `"${createHash("md5").update(body).digest("hex")}"`;
      upload.parts.set(Number(url.searchParams.get("partNumber")), { body, etag });
      return send(200, "", { ETag: etag });
    }
    if (req.method === "POST" && uploadId) {
      const upload = uploads.get(uploadId);
      if (!upload || upload.key !== key) return send(404, "<Error><Code>NoSuchUpload</Code></Error>");
      const listed = [...body.toString().matchAll(/<PartNumber>(\d+)<\/PartNumber><ETag>([^<]+)<\/ETag>/g)].map((m) => ({ n: Number(m[1]), etag: m[2].replace(/&quot;/g, '"') }));
      const bad = listed.find(({ n, etag }) => upload.parts.get(n)?.etag !== etag);
      if (!listed.length || bad) return send(200, "<Error><Code>InvalidPart</Code></Error>");
      objects.set(key, Buffer.concat(listed.map(({ n }) => upload.parts.get(n).body)));
      uploads.delete(uploadId);
      return send(200, `<CompleteMultipartUploadResult><Key>${key}</Key></CompleteMultipartUploadResult>`);
    }
    if (req.method === "DELETE" && uploadId) return send(uploads.delete(uploadId) ? 204 : 404);
    if (req.method === "PUT") {
      objects.set(key, body);
      return send(200, "", { ETag: `"${createHash("md5").update(body).digest("hex")}"` });
    }
    const object = objects.get(key);
    if (req.method === "DELETE") return send(objects.delete(key) ? 204 : 404);
    if (!object) return send(404, "<Error><Code>NoSuchKey</Code></Error>");
    const headers = { "Content-Length": String(object.length) };
    const disposition = url.searchParams.get("response-content-disposition");
    if (disposition) headers["Content-Disposition"] = disposition;
    if (req.method === "HEAD") return send(200, "", headers);
    if (req.method === "GET") {
      res.writeHead(200, headers);
      return res.end(object);
    }
    send(405);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    endpoint: `http://127.0.0.1:${port}`,
    objects,
    uploads,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
