import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import {
  ImageError,
  normalizeImage,
  readImageBytes,
  type ImageFailure,
} from "../images/normalize-image";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export class ProfileAvatarError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProfileAvatarError";
  }
}

// The shared pipeline (lib/images/normalize-image.ts) says what failed; this says it for a photo.
const avatarMessages: Record<ImageFailure, string> = {
  empty: "Selecione uma foto para enviar.",
  too_large: "A foto deve ter até 2 MB.",
  type: "Use uma imagem PNG, JPEG ou WebP.",
  corrupt: "O arquivo não é uma imagem válida.",
  dimensions:
    "Use uma foto estática com até 16 megapixels e 8.192 pixels por lado.",
  unreadable: "Não foi possível ler esta imagem. Escolha outra foto.",
  output_too_large: "Não foi possível reduzir esta foto.",
};

function asAvatarError(error: unknown): never {
  if (error instanceof ImageError)
    throw new ProfileAvatarError(avatarMessages[error.reason], error.status);
  throw error;
}

/** Enforces the byte limit even for chunked requests without Content-Length. */
export async function readAvatarBytes(
  stream: ReadableStream<Uint8Array> | null,
): Promise<Buffer> {
  try {
    return await readImageBytes(stream, MAX_AVATAR_BYTES);
  } catch (error) {
    return asAvatarError(error);
  }
}

export async function normalizeProfileAvatar(
  bytes: Buffer,
  contentType: string,
): Promise<Buffer> {
  try {
    return await normalizeImage(bytes, contentType, {
      size: 512,
      fit: "cover",
      quality: 78,
      maxBytes: MAX_AVATAR_BYTES,
    });
  } catch (error) {
    return asAvatarError(error);
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
