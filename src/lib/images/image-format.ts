/*
 * The picture formats the Console keeps, told apart by their first bytes, never
 * by the file name or the type the browser sent. Checked before any decoder
 * runs, so SVG, TIFF, HEIF, GIF and the rest never reach sharp's loaders.
 */

export type ImageFormat = "png" | "jpeg" | "webp";

const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const JPEG = Buffer.from("ffd8ff", "hex");

export function imageFormatOf(bytes: Buffer): ImageFormat | null {
  if (bytes.subarray(0, 8).equals(PNG)) return "png";
  if (bytes.subarray(0, 3).equals(JPEG)) return "jpeg";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP")
    return "webp";
  return null;
}
