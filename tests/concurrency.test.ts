import assert from "node:assert/strict";
import test from "node:test";
import { mapLimit } from "../src/lib/concurrency";

test("mapLimit keeps the order and never runs more than the limit at once", async () => {
  let running = 0;
  let peak = 0;
  const out = await mapLimit([5, 1, 4, 2, 3, 0], 2, async (n, i) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, n * 3));
    running -= 1;
    return `${i}:${n}`;
  });
  assert.deepEqual(out, ["0:5", "1:1", "2:4", "3:2", "4:3", "5:0"]);
  assert.equal(peak, 2);
});

test("mapLimit handles an empty list and a limit above the size", async () => {
  assert.deepEqual(await mapLimit([], 4, async () => 1), []);
  assert.deepEqual(await mapLimit([1, 2], 10, async (n) => n * 2), [2, 4]);
});

test("mapLimit rejects when one item fails", async () => {
  await assert.rejects(mapLimit([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error("falhou");
    return n;
  }), /falhou/);
});
