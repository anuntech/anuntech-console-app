import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * At most `limit` uses per rolling hour for one key, shared by every instance,
 * on the OTP limits table (HMAC key, never the raw id). Same shape as the
 * dictation throttle (lib/voice/voice-server.ts).
 */
export async function reserveHourly(scope: string, id: string, limit: number) {
  const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`${scope}:${id}`).digest("hex");
  const result = await db.execute(sql`
    INSERT INTO console_otp_limits (key,last_sent_at,window_start,count) VALUES (${key},now(),now(),1)
    ON CONFLICT (key) DO UPDATE SET last_sent_at=now(),
      window_start=CASE WHEN console_otp_limits.window_start < now()-interval '1 hour' THEN now() ELSE console_otp_limits.window_start END,
      count=CASE WHEN console_otp_limits.window_start < now()-interval '1 hour' THEN 1 ELSE console_otp_limits.count+1 END
    WHERE console_otp_limits.window_start < now()-interval '1 hour' OR console_otp_limits.count < ${limit}
    RETURNING key`);
  return result.rows.length > 0;
}
