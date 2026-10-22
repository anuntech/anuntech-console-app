import "server-only";
import { ORPCError } from "@orpc/server";
import { api } from "../server";
import { guard } from "../access";

// Placeholder: being built.
const todo = () => {
  throw new ORPCError("NOT_IMPLEMENTED", { message: "Em construção." });
};

export const company = {
  get: api.company.get.use(guard({ self: true })).handler(todo),
  update: api.company.update.use(guard({ self: true })).handler(todo),
  lookupCep: api.company.lookupCep.use(guard({ self: true })).handler(todo),
};
