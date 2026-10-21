import "server-only";
import { implement } from "@orpc/server";
import { contract } from "./contract";
import type { ApiContext } from "./access";

/** Where procedures implement the contract: api.<domain>.<name>.use(guard(...)).handler(...). */
export const api = implement(contract).$context<ApiContext>();
