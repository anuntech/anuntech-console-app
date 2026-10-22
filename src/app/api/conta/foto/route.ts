import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAccountSession } from "@/lib/account/account-session";
import { db } from "@/lib/db";
import { user } from "@/db/schema";
import {
  MAX_AVATAR_BYTES,
  ProfileAvatarError,
  isOwnedProfileAvatar,
  readAvatarBytes,
  readProfileAvatar,
} from "@/lib/account/profile-avatar";
import {
  chooseCatalogAvatar,
  removeProfilePhoto,
  saveProfilePhoto,
} from "@/lib/account/profile-avatar-change";

export const runtime = "nodejs";
export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: privateHeaders });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try {
    // Next may reconstruct Request.url with its internal listening hostname.
    // Use the same public origin as authentication rather than that internal URL.
    const expected = new URL(process.env.BETTER_AUTH_URL || request.url);
    return (
      ["https:", "http:"].includes(expected.protocol) &&
      origin === expected.origin &&
      request.headers.get("sec-fetch-site") !== "cross-site"
    );
  } catch {
    return false;
  }
}

export async function GET() {
  const actor = await getAccountSession();
  if (!actor) return fail("Entre para consultar sua foto.", 401);
  const [current] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, actor.user.id));
  if (!isOwnedProfileAvatar(current?.image, actor.user.id))
    return fail("Foto não encontrada.", 404);
  try {
    const bytes = await readProfileAvatar(current.image, actor.user.id);
    if (!bytes) return fail("Foto não encontrada.", 404);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "Content-Disposition": 'inline; filename="foto-de-perfil.webp"',
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return fail("Não foi possível carregar a foto.", 503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("A alteração foi recusada. Recarregue a página e tente de novo.", 403);
  const actor = await getAccountSession();
  if (!actor) return fail("Entre para alterar sua foto.", 401);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_AVATAR_BYTES) return fail("A foto deve ter até 2 MB.", 413);
  try {
    const bytes = await readAvatarBytes(request.body);
    const uploaded = await saveProfilePhoto(
      actor,
      bytes,
      request.headers.get("content-type") || "",
    );
    revalidatePath("/conta");
    revalidatePath("/", "layout");
    return Response.json({ image: uploaded }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof ProfileAvatarError)
      return fail(error.message, error.status);
    return fail("Não foi possível salvar a foto. Tente novamente.", 503);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return fail("A alteração foi recusada. Recarregue a página e tente de novo.", 403);
  const actor = await getAccountSession();
  if (!actor) return fail("Entre para alterar sua foto.", 401);
  try {
    const image = await removeProfilePhoto(actor);
    revalidatePath("/conta");
    revalidatePath("/", "layout");
    return Response.json({ image }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof ProfileAvatarError)
      return fail(error.message, error.status);
    return fail("Não foi possível remover a foto. Tente novamente.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return fail("A alteração foi recusada. Recarregue a página e tente de novo.", 403);
  const actor = await getAccountSession();
  if (!actor) return fail("Entre para alterar sua foto.", 401);
  try {
    const bytes = await readAvatarBytes(request.body);
    let payload;
    try {
      payload = JSON.parse(bytes.toString("utf8"));
    } catch {
      return fail("Selecione um avatar válido.", 400);
    }
    const image = await chooseCatalogAvatar(actor, payload?.image);
    revalidatePath("/conta");
    revalidatePath("/", "layout");
    return Response.json({ image }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof ProfileAvatarError)
      return fail(error.message, error.status);
    return fail("Não foi possível salvar o avatar. Tente novamente.", 503);
  }
}
