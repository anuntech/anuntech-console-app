"use server";
import { z } from "zod";
import { auditEvents } from "@/db/schema";
import { db } from "../db";
import { getActor } from "../access/access";
import { resolveAppOpening } from "./app-access";
import { appBlockText } from "./app-texts";
import { issuePass, PassKeyError } from "./pass";
import { passClaims } from "./pass-token";
import { appFrameSrc } from "./registry";

export type AppFrameResult = { src: string } | { error: string };

/**
 * A fresh pass for one product, as the iframe's address. Called by the page on
 * mount and by "Recarregar", never while rendering: a pass baked into the
 * server HTML could be replayed from the router cache after it expired, or
 * after the person lost access. Everything the page checked is checked again.
 */
export async function openApp(engagementId: string): Promise<AppFrameResult> {
  const actor = await getActor();
  const id = z.string().min(1).max(100).safeParse(engagementId);
  if (!id.success) return { error: appBlockText("not_found").title };
  const opening = await resolveAppOpening(actor, id.data);
  if (!opening.ok)
    return {
      error:
        opening.reason === "not_found"
          ? appBlockText("not_found").title
          : appBlockText(opening.reason, {
              app: opening.app?.name,
              product: opening.engagement.name,
              company: opening.company.name,
              status: opening.engagement.status,
            }).title,
    };
  let pass: string;
  try {
    pass = issuePass(
      passClaims({
        app: opening.app.id,
        user: { id: actor.user.id, email: actor.user.email, name: actor.user.name },
        company: opening.company.id,
        role: opening.role,
        tenant: opening.tenant,
      }),
    );
  } catch (error) {
    if (!(error instanceof PassKeyError)) throw error;
    // The reason goes to the logs; the person gets what to do next.
    console.error(error.message);
    return { error: "O Console não conseguiu abrir o app agora. Tente de novo em alguns minutos; se continuar, abra um chamado." };
  }
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    companyId: opening.company.id,
    action: "app.opened",
    entityId: opening.engagement.id,
    details: { app: opening.app.id, engagement: opening.engagement.id },
  });
  return { src: appFrameSrc(opening.app, pass) };
}
