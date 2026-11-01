/*
 * The document the reading pane's iframe shows (srcdoc), around HTML already
 * cleaned on the server (mail-html.ts). Client-safe and pure.
 *
 * The iframe is sandboxed with only allow-popups and
 * allow-popups-to-escape-sandbox: no script runs and the document has an
 * opaque origin, so it reaches neither the Console's cookies nor its DOM.
 * The policy below loads nothing from the network: only inline styles and
 * data: images (the cid: ones the server inlined). "Mostrar imagens" adds
 * https: images for that one message. <base target="_blank"> sends every
 * link to a new tab, outside the sandbox.
 */

export const MAIL_FRAME_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";

export function mailPolicy(remoteImages: boolean) {
  return `default-src 'none'; style-src 'unsafe-inline'; img-src data:${remoteImages ? " https:" : ""}`;
}

/** The whole srcdoc for a cleaned message. The policy comes first, before anything that could load. */
export function mailDocument(cleanHtml: string, { remoteImages = false }: { remoteImages?: boolean } = {}) {
  return [
    "<!doctype html><html><head>",
    `<meta http-equiv="Content-Security-Policy" content="${mailPolicy(remoteImages)}">`,
    '<meta charset="utf-8">',
    '<meta name="referrer" content="no-referrer">',
    '<meta name="color-scheme" content="light">',
    '<base target="_blank">',
    // Messages are written for a white page: the frame stays light in the dark theme too.
    "<style>html{background:#fff;color:#0d0d0d}body{margin:0;padding:16px;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}a{color:#5b43f0}</style>",
    "</head><body>",
    cleanHtml,
    "</body></html>",
  ].join("");
}
