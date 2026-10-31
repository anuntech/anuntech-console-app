/**
 * `items.map(fn)` with at most `limit` running at a time, results in the same order. For work per
 * company or per record that reads the database: a plain `for … await` grows the page's time with
 * every client, and a plain `Promise.all` asks the pool (db.ts) for every connection at once.
 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, lane));
  return out;
}

/** How many per-record reads a page or routine runs side by side: a third of the pool, so other requests still get a connection. */
export const READ_LANES = 4;
