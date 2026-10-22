import "server-only";
import { ORPCError } from "@orpc/server";
import { api } from "../server";
import { guard } from "../access";

// Placeholder: being built.
const todo = () => {
  throw new ORPCError("NOT_IMPLEMENTED", { message: "Em construção." });
};

export const members = {
  list: api.members.list.use(guard({ self: true })).handler(todo),
  save: api.members.save.use(guard({ self: true })).handler(todo),
  revoke: api.members.revoke.use(guard({ self: true })).handler(todo),
  resendInvite: api.members.resendInvite.use(guard({ self: true })).handler(todo),
};
