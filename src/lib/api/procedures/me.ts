import "server-only";
import { api } from "../server";
import { guard } from "../access";

export const me = {
  get: api.me.get.use(guard({ self: true })).handler(({ context }) => {
    const { actor } = context;
    return {
      id: actor.user.id,
      name: actor.user.name,
      email: actor.user.email,
      image: actor.user.image ?? null,
      phone: actor.user.phoneNumberVerified ? actor.user.phoneNumber || null : null,
      staff: actor.admin,
      owner: actor.owner,
      companies: actor.grants.map((grant) => ({
        id: grant.company.id,
        name: grant.company.name,
        role: grant.role,
      })),
    };
  }),
};
