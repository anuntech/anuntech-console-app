import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { pushDevices } from "@/db/schema";
import { db } from "../../db";
import { api } from "../server";
import { guard } from "../access";

export const devices = {
  register: api.devices.register
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      // A token belongs to one phone; whoever signs in on it last receives.
      await db
        .insert(pushDevices)
        .values({
          userId: context.actor.user.id,
          platform: input.platform,
          token: input.token,
          appVersion: input.appVersion ?? null,
        })
        .onConflictDoUpdate({
          target: pushDevices.token,
          set: {
            userId: context.actor.user.id,
            platform: input.platform,
            appVersion: input.appVersion ?? null,
            lastSeenAt: new Date(),
            disabledAt: null,
          },
        });
      return { ok: true as const };
    }),
  unregister: api.devices.unregister
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      await db
        .update(pushDevices)
        .set({ disabledAt: new Date() })
        .where(
          and(
            eq(pushDevices.token, input.token),
            eq(pushDevices.userId, context.actor.user.id),
            isNull(pushDevices.disabledAt),
          ),
        );
      return { ok: true as const };
    }),
};
