import "server-only";
import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import {
  ImageError,
  normalizeImage,
  readImageBytes,
  type ImageFailure,
} from "../images/normalize-image";
import { avatarPrefix, isOwnedProfileAvatar } from "./profile-avatar-path";

export { isOwnedProfileAvatar };

/** The stored photo, and what the web accepts (the browser reduces it to 512 px first). */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** What the app may send: a phone photo as taken, reduced here to the same 2 MB WebP. */
export const MAX_APP_AVATAR_UPLOAD_BYTES = 20 * 1024 * 1024;

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

/** The size limit, in the person's words (2 MB on the web, 20 MB from the app). */
export const avatarTooLarge = (maxBytes: number) =>
  maxBytes === MAX_AVATAR_BYTES
    ? avatarMessages.too_large
    : `A foto deve ter até ${Math.floor(maxBytes / (1024 * 1024))} MB.`;

function asAvatarError(error: unknown, maxBytes = MAX_AVATAR_BYTES): never {
  if (error instanceof ImageError)
    throw new ProfileAvatarError(
      error.reason === "too_large"
        ? avatarTooLarge(maxBytes)
        : avatarMessages[error.reason],
      error.status,
    );
  throw error;
}

/** Enforces the byte limit even for chunked requests without Content-Length. */
export async function readAvatarBytes(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes = MAX_AVATAR_BYTES,
): Promise<Buffer> {
  try {
    return await readImageBytes(stream, maxBytes);
  } catch (error) {
    return asAvatarError(error, maxBytes);
  }
}

/**
 * Any accepted photo becomes the same 512 px WebP of at most 2 MB. `maxInput`
 * only lets a larger original in (the app's 20 MB); the output limit stays.
 */
export async function normalizeProfileAvatar(
  bytes: Buffer,
  contentType: string,
  maxInput = MAX_AVATAR_BYTES,
): Promise<Buffer> {
  let result: Buffer;
  try {
    result = await normalizeImage(bytes, contentType, {
      size: 512,
      fit: "cover",
      quality: 78,
      maxBytes: maxInput,
    });
  } catch (error) {
    return asAvatarError(error, maxInput);
  }
  if (result.length > MAX_AVATAR_BYTES)
    throw new ProfileAvatarError(avatarMessages.output_too_large, 422);
  return result;
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
