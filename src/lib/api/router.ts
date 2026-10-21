import "server-only";
import { api } from "./server";
import { me } from "./procedures/me";
import { account } from "./procedures/account";
import { devices } from "./procedures/devices";
import { tickets } from "./procedures/tickets";

export const router = api.router({ me, account, tickets, devices });
export type Router = typeof router;
