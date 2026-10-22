"use server";
import { getActor } from "../access/access";
import { openAppAs, type AppFrameResult } from "./app-open";

/**
 * A fresh pass for one product, as the iframe's address. Called by the page on
 * mount and by "Recarregar", never while rendering: a pass baked into the
 * server HTML could be replayed from the router cache after it expired, or
 * after the person lost access. The checks, the pass and the audit are in
 * openAppAs, shared with the app's apps.open.
 */
export async function openApp(engagementId: string): Promise<AppFrameResult> {
  const actor = await getActor();
  return openAppAs(actor, engagementId);
}
