// The app's API, shared with mobile/: schemas only, no server code. The app
// imports this file for its typed client; the server implements it in
// procedures/ and serves it at /api/v1 (route in app/api/v1/[...rpc]).
import { oc } from "@orpc/contract";
import { z } from "zod";

const empty = z.object({}).strict().optional();
const pushToken = z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/);
const done = z.object({ ok: z.literal(true) });

export const contract = {
  me: {
    /** Who is signed in and the companies they reach. */
    get: oc.input(empty).output(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        image: z.string().nullable(),
        phone: z.string().nullable(),
        staff: z.boolean(),
        owner: z.boolean(),
        companies: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            role: z.enum(["manager", "member"]),
          }),
        ),
      }),
    ),
  },
  account: {
    /** Sends a fresh code before deleting the account. */
    requestDeletion: oc
      .input(z.object({ channel: z.enum(["email", "whatsapp"]) }))
      .output(z.object({ challengeId: z.string(), destination: z.string() })),
    /** Deletes the account (see lib/account/account-deletion.ts). */
    delete: oc
      .input(
        z.object({
          challengeId: z.uuid(),
          code: z.string().regex(/^\d{6}$/),
          confirmation: z.string().max(40),
        }),
      )
      .output(z.object({ deleted: z.literal(true) })),
  },
  devices: {
    /** This phone receives push notifications for the signed-in person. */
    register: oc
      .input(
        z.object({
          token: pushToken,
          platform: z.enum(["ios", "android"]),
          appVersion: z.string().max(40).optional(),
        }),
      )
      .output(done),
    /** Signing out: this phone stops receiving them. */
    unregister: oc.input(z.object({ token: pushToken })).output(done),
  },
};
export type Contract = typeof contract;
