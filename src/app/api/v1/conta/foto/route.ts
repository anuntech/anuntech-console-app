import { appActor } from "@/lib/api/app-request";
import { auth } from "@/lib/auth/auth";
import { allowedEmail } from "@/lib/auth/otp-delivery";
import { avatarView } from "@/lib/account/avatar-view";
import {
  MAX_APP_AVATAR_UPLOAD_BYTES,
  ProfileAvatarError,
  avatarTooLarge,
  readAvatarBytes,
} from "@/lib/account/profile-avatar";
import { saveProfilePhoto } from "@/lib/account/profile-avatar-change";

export const runtime = "nodejs";
export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: privateHeaders });
}

/**
 * The app's profile photo: the raw bytes of a PNG, JPEG or WebP (Content-Type
 * says which), up to 20 MB, turned into the same 512 px WebP the web stores.
 * The web's /api/conta/foto takes only its own pages (Origin); this one takes
 * the app's session cookie, with the same checks and answers. Reading the
 * photo stays on GET /api/conta/foto, which works with the cookie.
 */
export async function POST(request: Request) {
  const { actor, response } = await appActor(request);
  if (!actor) {
    const refusal = response ?? fail("Entre novamente para continuar.", 401);
    for (const [name, value] of Object.entries(privateHeaders)) refusal.headers.set(name, value);
    return refusal;
  }
  // The change is tied to this session (replaceProfileAvatar re-checks it), so read it.
  const current = await auth.api.getSession({ headers: request.headers });
  if (
    !current?.user.emailVerified ||
    current.user.id !== actor.user.id ||
    !(await allowedEmail(current.user.email))
  )
    return fail("Entre para alterar sua foto.", 401);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_APP_AVATAR_UPLOAD_BYTES)
    return fail(avatarTooLarge(MAX_APP_AVATAR_UPLOAD_BYTES), 413);
  try {
    const bytes = await readAvatarBytes(request.body, MAX_APP_AVATAR_UPLOAD_BYTES);
    const image = await saveProfilePhoto(
      current,
      bytes,
      request.headers.get("content-type") || "",
      MAX_APP_AVATAR_UPLOAD_BYTES,
    );
    return Response.json(
      { avatar: avatarView(image), message: "Foto de perfil atualizada." },
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof ProfileAvatarError) return fail(error.message, error.status);
    return fail("Não foi possível salvar a foto. Tente novamente.", 503);
  }
}
