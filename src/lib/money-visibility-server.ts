import "server-only";
import { cookies } from "next/headers";
import { MONEY_COOKIE, moneyHiddenFrom } from "./money-visibility";

export async function moneyHidden() {
  return moneyHiddenFrom((await cookies()).get(MONEY_COOKIE)?.value);
}
