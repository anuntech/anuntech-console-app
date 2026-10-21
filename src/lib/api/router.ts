import "server-only";
import { api } from "./server";
import { me } from "./procedures/me";
import { account } from "./procedures/account";
import { devices } from "./procedures/devices";

export const router = api.router({ me, account, devices });
export type Router = typeof router;
