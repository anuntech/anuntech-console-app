/* eslint-disable @typescript-eslint/no-require-imports -- Node preload test harness uses CommonJS. */
// Test-process only. Never imported by the application or shipped to Vercel.
const fs = require("node:fs");
const { MockAgent, setGlobalDispatcher } = require("undici");
const log = process.env.CONSOLE_TEST_ASSISTANT_FILE;

/*
 * Vercel Blob stand-in, in memory: uploaded catalog icons (and anything else on
 * Blob) never reach a real store from the test server. @vercel/blob calls
 * undici's own fetch, not globalThis.fetch, and undici reads its global
 * dispatcher, so a MockAgent answers the Blob API and the store hosts and lets
 * every other request through untouched. The token only names a fake store.
 */
process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_consoletest_mock";
const blobs = new Map();
const blobAgent = new MockAgent();
blobAgent.enableNetConnect();
const blobJson = (statusCode, value) => ({ statusCode, data: JSON.stringify(value), responseOptions: { headers: { "content-type": "application/json" } } });
const blobHeader = (headers, name) => {
  const entries = Array.isArray(headers) ? Object.fromEntries(headers.reduce((pairs, value, index) => (index % 2 ? pairs : [...pairs, [headers[index], headers[index + 1]]]), [])) : headers ?? {};
  const key = Object.keys(entries).find((k) => k.toLowerCase() === name);
  return key ? String(entries[key]) : "";
};
const blobBytes = (body) => (typeof body === "string" ? Buffer.from(body) : ArrayBuffer.isView(body) ? Buffer.from(body.buffer, body.byteOffset, body.byteLength) : null);
const blobApi = blobAgent.get("https://vercel.com");
blobApi
  .intercept({ path: (path) => /^\/api\/blob\/?\?/.test(path), method: "PUT" })
  .reply((opts) => {
    const pathname = new URL(opts.path, "https://vercel.com").searchParams.get("pathname");
    const body = blobBytes(opts.body);
    if (!pathname || !body) return blobJson(400, { error: { code: "bad_request", message: "Invalid upload" } });
    if (blobs.has(pathname) && blobHeader(opts.headers, "x-allow-overwrite") !== "1")
      return blobJson(400, { error: { code: "bad_request", message: "This blob already exists" } });
    const contentType = blobHeader(opts.headers, "x-content-type") || "application/octet-stream";
    blobs.set(pathname, { body, contentType });
    if (log) fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), blob: "put", pathname, bytes: body.length }) + "\n");
    const url = `https://consoletest.${blobHeader(opts.headers, "x-vercel-blob-access") || "private"}.blob.vercel-storage.com/${pathname}`;
    return blobJson(200, { url, downloadUrl: `${url}?download=1`, pathname, contentType, contentDisposition: "inline", etag: '"mock"' });
  })
  .persist();
blobApi
  .intercept({ path: (path) => /^\/api\/blob\/delete\b/.test(path), method: "POST" })
  .reply((opts) => {
    const { urls = [] } = JSON.parse(blobBytes(opts.body)?.toString("utf8") || "{}");
    for (const value of urls) {
      const pathname = /^https?:\/\//.test(value) ? decodeURIComponent(new URL(value).pathname.slice(1)) : value;
      blobs.delete(pathname);
      if (log) fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), blob: "delete", pathname }) + "\n");
    }
    return blobJson(200, {});
  })
  .persist();
blobAgent
  .get(/^https:\/\/[a-z0-9-]+\.(?:private|public)\.blob\.vercel-storage\.com$/)
  .intercept({ path: () => true, method: "GET" })
  .reply((opts) => {
    const blob = blobs.get(decodeURIComponent(new URL(opts.path, "https://store.invalid").pathname.slice(1)));
    if (!blob) return { statusCode: 404, data: "" };
    return { statusCode: 200, data: blob.body, responseOptions: { headers: { "content-type": blob.contentType, "content-length": String(blob.body.length) } } };
  })
  .persist();
setGlobalDispatcher(blobAgent);
