import sanitizeHtml from "sanitize-html";

/*
 * The HTML of a received message, cleaned on the server before it reaches
 * the page. The page then shows it inside a sandboxed iframe with its own
 * Content-Security-Policy (mail-document.ts), so this is the first of two
 * walls: no scripts, no event handlers, no javascript: links, no forms, no
 * frames, objects or embeds, no <meta> (refresh) and no <base>. Styles stay,
 * since newsletters depend on them; the iframe's policy keeps them from
 * loading anything.
 */

/** Inline images (cid:) that became data: URIs, by Content-ID, already checked for type and size. */
export type InlineImages = Record<string, string>;

const TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  "img",
  "style",
  "font",
  "center",
  "big",
  "strike",
  "tt",
  "map",
  "area",
];

const ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": ["style", "class", "id", "dir", "lang", "align", "valign", "width", "height", "bgcolor", "color", "border", "title", "role"],
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "width", "height", "border", "hspace", "vspace"],
  font: ["face", "size", "color"],
  table: ["cellpadding", "cellspacing", "background", "summary", "frame", "rules"],
  td: ["colspan", "rowspan", "background", "nowrap", "abbr", "headers", "scope"],
  th: ["colspan", "rowspan", "background", "nowrap", "abbr", "headers", "scope"],
  tr: ["background"],
  col: ["span"],
  colgroup: ["span"],
  ol: ["start", "type", "reversed"],
  ul: ["type"],
  li: ["value"],
  area: ["shape", "coords", "href", "alt", "target", "rel"],
  map: ["name"],
};

/** Content-IDs are compared without the angle brackets and case. */
export const normalizeCid = (cid: string) => cid.trim().replace(/^<|>$/g, "").toLowerCase();

/**
 * The message's HTML, safe to put in the iframe's srcdoc, and whether it
 * asks for remote images (the "Mostrar imagens" button appears only then).
 * `cid:` images become the data: URIs in `inline`; the ones not there lose
 * their source.
 */
export function cleanEmailHtml(html: string, inline: InlineImages = {}) {
  const clean = sanitizeHtml(html, {
    allowedTags: TAGS,
    allowedAttributes: ATTRIBUTES,
    // <style> is allowed on purpose: the iframe runs no script and its CSP loads nothing.
    allowVulnerableTags: true,
    // The whole content of these goes, not only the tag.
    nonTextTags: ["script", "noscript", "textarea", "option", "xmp", "title", "iframe", "object", "embed", "applet", "frameset", "noembed", "noframes", "template", "svg", "math"],
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
    allowProtocolRelative: false,
    // Style attributes pass as they are: there is no script to reach, and url() loads nothing under the CSP.
    parseStyleAttributes: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
      area: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
      img: (tagName, attribs) => {
        const src = (attribs.src ?? "").trim();
        const next = { ...attribs };
        if (/^cid:/i.test(src)) {
          let cid = src.slice(4);
          try {
            cid = decodeURIComponent(cid);
          } catch {}
          const data = inline[normalizeCid(cid)];
          if (data) next.src = data;
          else delete next.src;
        } else if (/^data:/i.test(src) && !/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(src)) delete next.src;
        return { tagName, attribs: next };
      },
    },
  });
  return { html: clean, remoteImages: hasRemoteImages(clean) };
}

/** An image, a background or a CSS url() on the web: what "Mostrar imagens" would load. */
export function hasRemoteImages(html: string) {
  return /(?:\bsrc|\bbackground)\s*=\s*["']?\s*https?:|url\(\s*["']?\s*https?:/i.test(html);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** A rough text version of an HTML message, for the quote of a reply or forward when the message has no text part. */
export function htmlToText(html: string) {
  const marked = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|li|h[1-6]|blockquote|table)\s*>/gi, "\n");
  const text = sanitizeHtml(marked, { allowedTags: [], allowedAttributes: {}, nonTextTags: ["style", "script", "title", "head", "textarea", "option", "noscript"] });
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name])
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
