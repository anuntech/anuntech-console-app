import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { indexPendingFiles } from "@/lib/drive/file-index";
import { tagPendingFiles } from "@/lib/drive/file-tags";
import { trackedCron } from "@/lib/ops/cron-health";
export const maxDuration = 300;

/** Every 15 minutes: the text of the files still without it (older ones, a read that failed), for the content search, and their tags. */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    // One run at a time; the reads themselves go through the pool, outside this transaction.
    const locked = (await conn.query("select pg_try_advisory_xact_lock(72649191) as locked")).rows[0].locked;
    if (!locked) return Response.json({ skipped: true });
    const read = await indexPendingFiles({ limit: 400, budgetMs: 200_000 });
    // The files read before the tags existed get theirs.
    const tagged = await tagPendingFiles(100);
    return Response.json({ read, tagged }, { headers: { "Cache-Control": "no-store" } });
  } finally {
    try {
      await conn.query("ROLLBACK");
    } finally {
      conn.release();
    }
  }
}

export const GET = trackedCron("arquivos-texto", run);
