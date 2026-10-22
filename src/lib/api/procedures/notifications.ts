import "server-only";
import { ORPCError } from "@orpc/server";
import { api } from "../server";
import { guard } from "../access";

// Placeholder: being built.
const todo = () => {
  throw new ORPCError("NOT_IMPLEMENTED", { message: "Em construção." });
};

export const notifications = {
  get: api.notifications.get.use(guard({ self: true })).handler(todo),
  save: api.notifications.save.use(guard({ self: true })).handler(todo),
};
