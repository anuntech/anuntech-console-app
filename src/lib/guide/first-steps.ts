import "server-only";
import { eq } from "drizzle-orm";
import { notificationPreferences, user } from "@/db/schema";
import type { Actor } from "../access/access";
import { db } from "../db";
import { preferenceKey } from "../notifications/notification-preferences";
import { GUIDE_VERSION } from "./guide-content";
import { milestonesOf } from "./milestones";

export type FirstStep = { key: string; title: string; href: string; done: boolean };
export type FirstSteps = { companyId: string; steps: FirstStep[] };

/**
 * The few things a person does once to work well with Anuntech, derived
 * from data where it can be (a saved notice preference, a verified phone)
 * and from what they did otherwise. Administradores and Membros get
 * different steps. Null when everything is done or the card was hidden.
 */
export async function firstStepsFor(actor: Actor): Promise<FirstSteps | null> {
  if (actor.admin || !actor.grants.length) return null;
  const grant = actor.grants[0];
  const companyId = grant.company.id;
  const [seen, [me], [notices]] = await Promise.all([
    milestonesOf(actor.user.id, [companyId]),
    db.select({ name: user.name, phoneVerified: user.phoneNumberVerified }).from(user).where(eq(user.id, actor.user.id)),
    db.select({ key: notificationPreferences.key }).from(notificationPreferences).where(eq(notificationPreferences.key, preferenceKey(companyId, "tickets"))),
  ]);
  if (seen.has(`first_steps_hidden:${companyId}`)) return null;
  const guide: FirstStep = {
    key: "guide",
    title: `Leia como a Anuntech trabalha com a ${grant.company.name}`,
    href: "/como-trabalhamos",
    done: seen.has(`guide_read_v${GUIDE_VERSION}:`),
  };
  const steps: FirstStep[] =
    grant.role === "manager"
      ? [
          { key: "members", title: "Revise quem tem acesso ao Console", href: "/configuracoes/membros", done: seen.has(`members_reviewed:${companyId}`) },
          { key: "notices", title: "Escolha quem recebe os avisos de chamados", href: "/configuracoes/notificacoes", done: !!notices || seen.has(`notices_reviewed:${companyId}`) },
          guide,
        ]
      : [
          { key: "profile", title: "Complete seu nome e WhatsApp", href: "/conta", done: !!me?.name?.trim() && !!me?.phoneVerified },
          guide,
        ];
  return steps.every((s) => s.done) ? null : { companyId, steps };
}
