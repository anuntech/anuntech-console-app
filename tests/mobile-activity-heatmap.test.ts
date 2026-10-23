import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHeatmap,
  countLabel,
  dayAt,
  dayLabel,
  formatCount,
  levelColors,
  levelRanges,
  mix,
  summary,
  weekdayLabels,
} from "../mobile/src/lib/activity-heatmap";

/** 365 days ending on the given date, as accountActivity answers. */
function year(end: string, count: (i: number) => number = () => 0) {
  const last = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: 365 }, (_, i) => ({
    date: new Date(last - (364 - i) * 86_400_000).toISOString().slice(0, 10),
    count: count(i),
  }));
}

test("a year lays out in weeks from Sunday, as the web's grid", () => {
  // 2026-10-23 is a Friday; 364 days before is 2025-10-24, a Friday too.
  const map = buildHeatmap(year("2026-10-23"));
  assert.equal(map.lead, 5);
  assert.equal(map.weeks, 53);
  assert.equal(map.counts.length, 365);
  assert.equal(dayAt(map, 0, 4), null);
  assert.equal(dayAt(map, 0, 5), 0);
  assert.equal(dayAt(map, 52, 5), 364);
  assert.equal(dayAt(map, 52, 6), null);
  assert.equal(dayLabel(map, 364), "sex., 23 de out. de 2026");
  assert.equal(dayLabel(map, 0), "sex., 24 de out. de 2025");
  // The partial first month (October) gives way to November, two columns later.
  assert.equal(map.months[0].label, "nov.");
  assert.equal(map.months.at(-1)?.label, "out.");
});

test("levels are quarters of the busiest day, never below 1, 2 and 3", () => {
  const quiet = buildHeatmap(year("2026-10-23"));
  assert.deepEqual(quiet.thresholds, [1, 2, 3]);
  assert.equal(quiet.total, 0);
  assert.ok(quiet.levels.every((l) => l === 0));
  const busy = buildHeatmap(year("2026-10-23", (i) => (i === 364 ? 20 : i === 363 ? 5 : i === 362 ? 11 : i === 361 ? 15 : 0)));
  assert.deepEqual(busy.thresholds, [5, 10, 15]);
  assert.deepEqual(busy.levels.slice(-4), [3, 3, 1, 4]);
  assert.equal(busy.total, 51);
  assert.deepEqual(levelRanges(busy.thresholds), [
    "nenhuma interação",
    "de 1 a 5 interações",
    "de 6 a 10 interações",
    "de 11 a 15 interações",
    "16 ou mais interações",
  ]);
  assert.equal(levelRanges([1, 2, 3])[1], "1 interação");
});

test("the words are the web's", () => {
  assert.equal(summary(0), "0 interações nos últimos 12 meses");
  assert.equal(summary(1), "1 interação nos últimos 12 meses");
  assert.equal(summary(1234), "1.234 interações nos últimos 12 meses");
  assert.equal(countLabel(0), "Nenhuma interação");
  assert.equal(countLabel(3), "3 interações");
  assert.equal(formatCount(1234567), "1.234.567");
  assert.deepEqual(weekdayLabels, ["", "seg.", "", "qua.", "", "sex.", ""]);
});

test("tints mix the brand over a hint of the text color", () => {
  assert.equal(mix("#ffffff", "#000000", 0.5), "#808080");
  const [empty, , , , full] = levelColors("#5b43f0", "#0d0d0d", "#ffffff");
  assert.equal(full, "#5b43f0");
  assert.equal(empty, mix("#0d0d0d", "#ffffff", 0.065));
});
