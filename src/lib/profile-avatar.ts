import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import sharp from "sharp";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_PIXELS = 16 * 1024 * 1024;
const MAX_DIMENSION = 8192;
const mimeFormats = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
} as const;

export class ProfileAvatarError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProfileAvatarError";
  }
}

/** Enforces the byte limit even for chunked requests without Content-Length. */
export async function readAvatarBytes(
  stream: ReadableStream<Uint8Array> | null,
): Promise<Buffer> {
  if (!stream)
    throw new ProfileAvatarError("Selecione uma foto para enviar.", 400);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AVATAR_BYTES) {
        await reader.cancel();
        throw new ProfileAvatarError("A foto deve ter até 2 MB.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size)
    throw new ProfileAvatarError("Selecione uma foto para enviar.", 400);
  return Buffer.concat(chunks, size);
}

export async function normalizeProfileAvatar(
  bytes: Buffer,
  contentType: string,
): Promise<Buffer> {
  const mime = contentType.split(";", 1)[0].trim().toLowerCase();
  if (!Object.hasOwn(mimeFormats, mime))
    throw new ProfileAvatarError("Use uma imagem PNG, JPEG ou WebP.", 415);
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES)
    throw new ProfileAvatarError("A foto deve ter até 2 MB.", 413);
  const format = mimeFormats[mime as keyof typeof mimeFormats];
  const signatureMatches =
    (format === "png" &&
      bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) ||
    (format === "jpeg" &&
      bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) ||
    (format === "webp" &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP");
  if (!signatureMatches)
    throw new ProfileAvatarError("O arquivo não é uma imagem válida.", 422);
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
      throw new ProfileAvatarError(
        "Use uma foto estática com até 16 megapixels e 8.192 pixels por lado.",
        422,
      );
    // Sharp strips EXIF/ICC and other metadata unless explicitly retained.
    const result = await image
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 84, effort: 4 })
      .timeout({ seconds: 10 })
      .toBuffer();
    if (result.length > MAX_AVATAR_BYTES)
      throw new ProfileAvatarError("Não foi possível reduzir esta foto.", 422);
    return result;
  } catch (error) {
    if (error instanceof ProfileAvatarError) throw error;
    throw new ProfileAvatarError(
      "Não foi possível ler esta imagem. Escolha outra foto.",
      422,
    );
  }
}

function avatarPrefix(userId: string) {
  return `profile-avatars/${createHash("sha256").update(userId).digest("hex")}/`;
}

export function isOwnedProfileAvatar(
  image: string | null | undefined,
  userId: string,
): image is string {
  if (!image?.startsWith(avatarPrefix(userId))) return false;
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(
    image.slice(avatarPrefix(userId).length),
  );
}

export async function storeProfileAvatar(userId: string, image: Buffer) {
  const pathname = `${avatarPrefix(userId)}${randomUUID()}.webp`;
  await put(pathname, image, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "image/webp",
    cacheControlMaxAge: 60,
    abortSignal: AbortSignal.timeout(20000),
  });
  return pathname;
}

export async function readProfileAvatar(image: string, userId: string) {
  if (!isOwnedProfileAvatar(image, userId)) return null;
  const result = await get(image, {
    access: "private",
    abortSignal: AbortSignal.timeout(10000),
  });
  if (result?.statusCode !== 200 || !result.stream) return null;
  if (
    result.blob.contentType !== "image/webp" ||
    (result.blob.size ?? 0) > MAX_AVATAR_BYTES
  ) {
    await result.stream.cancel();
    return null;
  }
  return readAvatarBytes(result.stream);
}

export async function deleteProfileAvatar(image: string, userId: string) {
  if (!isOwnedProfileAvatar(image, userId)) return;
  await del(image, {
    abortSignal: AbortSignal.timeout(10000),
  });
}
