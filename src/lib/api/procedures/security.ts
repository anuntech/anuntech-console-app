import "server-only";
import { api } from "../server";
import { guard } from "../access";
import { recentSessions } from "../../auth/session-history";
import { sessionDevice, sessionStatusLabel } from "../../auth/session-device";

type Status = "current" | "active" | "expired" | "ended";

/*
 * Segurança in the app: what the web's page reads (security-section.tsx). The
 * two-step change itself goes through /api/auth/security/* (consoleTwoStep),
 * which the app calls with its session; there is no procedure for it.
 */
export const security = {
  overview: api.security.overview.use(guard({ self: true })).handler(async ({ context }) => {
    const { user, session } = context.session;
    const entries = await recentSessions(user.id, session.id);
    return {
      twoFactorEnabled: user.twoFactorEnabled === true,
      channel: user.twoStepChannel === "email" ? ("email" as const) : ("whatsapp" as const),
      phone: user.phoneNumberVerified ? user.phoneNumber || null : null,
      sessions: entries.map((entry) => {
        const status = entry.status as Status;
        return {
          id: entry.id,
          device: sessionDevice(entry.userAgent),
          createdAt: entry.createdAt.toISOString(),
          // The web shows "ativa até" only while the session is open.
          expiresAt: status === "current" || status === "active" ? entry.expiresAt.toISOString() : null,
          status,
          statusLabel: sessionStatusLabel[status] ?? status,
        };
      }),
    };
  }),
};
