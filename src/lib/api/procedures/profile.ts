import "server-only";
import { ORPCError } from "@orpc/server";
import { api } from "../server";
import { guard } from "../access";

// Placeholder: being built.
const todo = () => {
  throw new ORPCError("NOT_IMPLEMENTED", { message: "Em construção." });
};

export const profile = {
  rename: api.profile.rename.use(guard({ self: true })).handler(todo),
  avatars: api.profile.avatars.use(guard({ self: true })).handler(todo),
  setAvatar: api.profile.setAvatar.use(guard({ self: true })).handler(todo),
  removePhoto: api.profile.removePhoto.use(guard({ self: true })).handler(todo),
  startEmailChange: api.profile.startEmailChange.use(guard({ self: true })).handler(todo),
  confirmEmailChange: api.profile.confirmEmailChange.use(guard({ self: true })).handler(todo),
};
