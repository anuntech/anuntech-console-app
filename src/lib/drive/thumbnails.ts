import "server-only";
import sharp from "sharp";

/*
 * The picture on a file's card (Arquivos): a photo or a drawing made small
 * (480 px wide, WebP), so the grid shows it without downloading the file.
 * Made once per stored file by the routine that reads the text
 * (file-index.ts) and kept in R2 next to it, under `thumbs/<key>.webp`; it
 * goes with the file (removeStoredFiles).
 */

/** The kinds sharp reads here; HEIC needs a decoder the server does not have, so it shows its icon. */
const IMAGE = /\.(jpe?g|png|webp|gif|avif|tiff?|bmp|svg)$/i;
/** Past this, the photo is not read for a thumbnail (it would hold the routine). */
export const THUMB_SOURCE_MAX_BYTES = 40 * 1024 * 1024;
export const THUMB_WIDTH = 480;

export const thumbable = (fileName: string) => IMAGE.test(fileName);
/** Where the picture lives in R2 (kept in thumb-url.ts, which the API reads without loading sharp). */
export { thumbKeyOf } from "./thumb-url";

/** The small WebP of an image, turned as the camera held it; throws on a broken file. */
export async function makeThumbnail(bytes: Uint8Array) {
  return sharp(bytes, { limitInputPixels: 100_000_000, animated: false, failOn: "error" })
    .rotate()
    .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}
