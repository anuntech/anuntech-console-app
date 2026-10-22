import "server-only";
import { ORPCError } from "@orpc/server";
import { api } from "../server";
import { guard, type Guarded } from "../access";
import { allowedEmail } from "../../auth/otp-delivery";
import { avatarView, catalogAvatars } from "../../account/avatar-view";
import { ProfileAvatarError } from "../../account/profile-avatar";
import { chooseCatalogAvatar, removeProfilePhoto } from "../../account/profile-avatar-change";
import {
  RECENT_SIGN_IN_REFUSAL,
  confirmAccountEmailChange,
  isAccountRefusal,
  renameAccount,
  startAccountEmailChange,
} from "../../account/account-profile";

/*
 * Minha conta in the app: the web's rules (lib/account/account-profile.ts and
 * profile-avatar-change.ts), the web's words. A refusal is BAD_REQUEST with
 * its message; "Entre novamente…" (the session no longer serves) is
 * UNAUTHORIZED, as the web's 401.
 */

const refuse = (message: string) =>
  new ORPCError(message.startsWith("Entre") ? "UNAUTHORIZED" : "BAD_REQUEST", { message });

/** Same gate as the web's getAccountSession: a verified e-mail that still has access. */
async function account(context: Guarded, refusal: string) {
  if (!(await allowedEmail(context.session.user.email))) throw refuse(refusal);
  return context.session;
}

/** The web route's answers for a picture change (/api/conta/foto). */
async function picture<T>(change: () => Promise<T>, failure: string) {
  try {
    return await change();
  } catch (error) {
    if (error instanceof ProfileAvatarError)
      throw new ORPCError(error.status === 401 ? "UNAUTHORIZED" : "BAD_REQUEST", { message: error.message });
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: failure, cause: error });
  }
}

/** Refusals thrown inside a change (a contact of another environment). */
async function refusals<T>(change: () => Promise<T>) {
  try {
    return await change();
  } catch (error) {
    if (isAccountRefusal(error) && error instanceof Error) throw refuse(error.message);
    throw error;
  }
}

export const profile = {
  rename: api.profile.rename.use(guard({ self: true })).handler(async ({ input, context }) => {
    const current = await account(context, "Entre novamente para editar seu perfil.");
    const result = await renameAccount(current, input);
    if ("error" in result) throw refuse(result.error);
    return { message: result.success };
  }),
  avatars: api.profile.avatars
    .use(guard({ self: true }))
    .handler(() => ({ avatars: catalogAvatars() })),
  setAvatar: api.profile.setAvatar.use(guard({ self: true })).handler(async ({ input, context }) => {
    const current = await account(context, "Entre para alterar sua foto.");
    const image = await picture(
      () => chooseCatalogAvatar(current, input.image),
      "Não foi possível salvar o avatar. Tente novamente.",
    );
    return { avatar: avatarView(image), message: "Avatar atualizado." };
  }),
  removePhoto: api.profile.removePhoto.use(guard({ self: true })).handler(async ({ context }) => {
    const current = await account(context, "Entre para alterar sua foto.");
    const image = await picture(
      () => removeProfilePhoto(current),
      "Não foi possível remover a foto. Tente novamente.",
    );
    return { avatar: avatarView(image), message: "Foto removida." };
  }),
  startEmailChange: api.profile.startEmailChange
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const current = await account(context, RECENT_SIGN_IN_REFUSAL);
      const result = await refusals(() =>
        startAccountEmailChange(current, { email: input.email, primary: true }),
      );
      if ("error" in result) throw refuse(result.error);
      return {
        challengeId: result.challengeId,
        email: result.email,
        // The web's dialog says the same (account-forms.tsx).
        message: "Cada endereço recebeu um código de 6 números. Eles valem por 5 minutos.",
      };
    }),
  confirmEmailChange: api.profile.confirmEmailChange
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const current = await account(context, RECENT_SIGN_IN_REFUSAL);
      const result = await refusals(() => confirmAccountEmailChange(current, input));
      if ("error" in result) throw refuse(result.error);
      // Every session is gone, this one too: the app signs in again with the new address.
      return { message: result.success };
    }),
};
