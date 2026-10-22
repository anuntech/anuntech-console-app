import "server-only";
import { ORPCError } from "@orpc/server";
import { api } from "../server";
import { guard } from "../access";

// Placeholder: being built.
const todo = () => {
  throw new ORPCError("NOT_IMPLEMENTED", { message: "Em construção." });
};

export const security = {
  overview: api.security.overview.use(guard({ self: true })).handler(todo),
};
