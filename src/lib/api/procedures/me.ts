import "server-only";
import { api } from "../server";
import { guard } from "../access";
import { avatarView } from "../../account/avatar-view";
import { isRecentSignIn } from "../../account/account-profile";
import { managedCompanyIds } from "../../access/member-access";
import { companyDisplayName } from "../../companies/display-name";

export const me = {
  get: api.me.get.use(guard({ self: true })).handler(({ context }) => {
    const { actor, session } = context;
    const managed = managedCompanyIds(actor);
    return {
      id: actor.user.id,
      name: actor.user.name,
      email: actor.user.email,
      image: actor.user.image ?? null,
      phone: actor.user.phoneNumberVerified ? actor.user.phoneNumber || null : null,
      avatar: avatarView(actor.user.image),
      // Same reading as the web's Segurança (security-section.tsx).
      twoFactorEnabled: actor.user.twoFactorEnabled === true,
      twoStepChannel: actor.user.twoStepChannel === "email" ? ("email" as const) : ("whatsapp" as const),
      recentSignIn: isRecentSignIn(session.session),
      managedCompanyId: managed.length === 1 ? managed[0] : null,
      staff: actor.admin,
      owner: actor.owner,
      companies: actor.grants.map((grant) => ({
        id: grant.company.id,
        // The name people read (Início, Conta); Dados da empresa keeps the razão social (company.get).
        name: companyDisplayName(grant.company.name, grant.company.document),
        role: grant.role,
      })),
    };
  }),
};
