import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { emptyExpiredTrash } from "@/lib/bookmarks/bookmark-core";
import { clearStaleUploads } from "@/lib/drive/uploads";
import { trackedCron } from "@/lib/ops/cron-health";
export const maxDuration = 300;

/** Once a day, 04:00 in São Paulo: the trash past 30 days and the uploads that never became an item. */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    const locked = (await conn.query("select pg_try_advisory_xact_lock(72649190) as locked")).rows[0].locked;
    if (!locked) return Response.json({ skipped: true });
    const trash = await emptyExpiredTrash();
    const uploads = await clearStaleUploads();
    if (trash) revalidatePath("/bookmarks");
    return Response.json({ trash, uploads }, { headers: { "Cache-Control": "no-store" } });
  } finally {
    try {
      await conn.query("ROLLBACK");
    } finally {
      conn.release();
    }
  }
}

export const GET = trackedCron("arquivos", run);
