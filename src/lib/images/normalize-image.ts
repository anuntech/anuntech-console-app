import "server-only";
import sharp from "sharp";
import { imageFormatOf } from "./image-format";

/*
 * The one way the Console turns an image someone sent (a profile photo, a
 * catalog icon, an AI option) into a file it keeps: PNG, JPEG or WebP only,
 * checked by magic bytes and decoded by sharp under pixel limits, never
 * animated, rotated by EXIF and written back as a small WebP without metadata.
 * Errors carry a reason; each caller words it for its own screen.
 */

const MAX_PIXELS = 16 * 1024 * 1024;
const MAX_DIMENSION = 8192;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const mimeFormats = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
} as const;

export type ImageFailure =
  | "empty"
  | "too_large"
  | "type"
  | "corrupt"
  | "dimensions"
  | "unreadable"
  | "output_too_large";

export class ImageError extends Error {
  constructor(
    readonly reason: ImageFailure,
    readonly status: number,
  ) {
    super(reason);
    this.name = "ImageError";
  }
}

/** Enforces the byte limit even for chunked requests without Content-Length. */
export async function readImageBytes(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Buffer> {
  if (!stream) throw new ImageError("empty", 400);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ImageError("too_large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new ImageError("empty", 400);
  return Buffer.concat(chunks, size);
}

export type NormalizeOptions = {
  /** Width and height of the square output. */
  size: number;
  /** "cover" crops to fill the square; "contain" fits the whole image inside it. */
  fit: "cover" | "contain";
  /** WebP quality, 1-100. */
  quality: number;
  /**
   * Flattens transparency onto this color, so the result is opaque. "contain"
   * always flattens (white by default): a transparent logo must not vanish on
   * a dark tile, and the bands around a wide image must match its background.
   */
  background?: string;
  /** Largest input accepted and largest output produced (2 MB by default). */
  maxBytes?: number;
};

export async function normalizeImage(
  bytes: Buffer,
  contentType: string,
  { size, fit, quality, background, maxBytes = DEFAULT_MAX_BYTES }: NormalizeOptions,
): Promise<Buffer> {
  const mime = contentType.split(";", 1)[0].trim().toLowerCase();
  if (!Object.hasOwn(mimeFormats, mime)) throw new ImageError("type", 415);
  if (!bytes.length || bytes.length > maxBytes)
    throw new ImageError("too_large", 413);
  const format = mimeFormats[mime as keyof typeof mimeFormats];
  if (imageFormatOf(bytes) !== format) throw new ImageError("corrupt", 422);
  try {
    const image = sharp(bytes, {
      failOn: "warning",
      limitInputPixels: MAX_PIXELS,
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== format ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_DIMENSION ||
      metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_PIXELS ||
      (metadata.pages ?? 1) > 1
    )
      throw new ImageError("dimensions", 422);
    const fill = background ?? (fit === "contain" ? "#ffffff" : undefined);
    let pipeline = image.rotate();
    // Flattened before the resize, so the bands "contain" adds take the same color.
    if (fill) pipeline = pipeline.flatten({ background: fill });
    // Sharp strips EXIF/ICC and other metadata unless explicitly retained.
    const result = await pipeline
      .resize(size, size, {
        fit,
        position: "centre",
        ...(fill ? { background: fill } : {}),
      })
      .webp({ quality, effort: 4 })
      .timeout({ seconds: 10 })
      .toBuffer();
    if (result.length > maxBytes) throw new ImageError("output_too_large", 422);
    return result;
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw new ImageError("unreadable", 422);
  }
}
