import "server-only";
import { api } from "./server";
import { me } from "./procedures/me";
import { account } from "./procedures/account";
import { devices } from "./procedures/devices";
import { tickets } from "./procedures/tickets";
import { finance } from "./procedures/finance";
import { overview } from "./procedures/overview";
import { bookmarks, contracts, projects, quotes } from "./procedures/areas";

export const router = api.router({ me, account, tickets, finance, projects, contracts, quotes, bookmarks, overview, devices });
export type Router = typeof router;
