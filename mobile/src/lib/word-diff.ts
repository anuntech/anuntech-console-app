/**
 * The web's diffWords (src/lib/contracts/contract-text.ts), copied because
 * Metro bundles only what lives in mobile/. tests/mobile-word-diff.test.ts
 * keeps the two in step.
 */
export type WordChange = { text: string; change: "same" | "added" | "removed" };

/** Longest common subsequence of two lists, as index pairs in order. */
function matches<T>(a: T[], b: T[], same: (x: T, y: T) => boolean) {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] = same(a[i], b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** Word by word, what a proposed text keeps, drops and adds; spacing stays with each word. */
export function diffWords(before: string, after: string): WordChange[] {
  const split = (text: string) => text.match(/\s*\S+/g) ?? [];
  const a = split(before);
  const b = split(after);
  const pairs = matches(a, b, (x, y) => x.trim() === y.trim());
  const out: WordChange[] = [];
  const push = (text: string, change: WordChange["change"]) => {
    const last = out[out.length - 1];
    if (last && last.change === change) last.text += text;
    else out.push({ text, change });
  };
  let i = 0;
  let j = 0;
  for (const [ai, bj] of [...pairs, [a.length, b.length] as [number, number]]) {
    while (i < ai) push(a[i++], "removed");
    while (j < bj) push(b[j++], "added");
    if (ai < a.length) {
      push(b[bj], "same");
      i++;
      j++;
    }
  }
  return out;
}

/** What a screen reader says for a diff: the proposed text, then what it drops and adds. */
export function diffSummary(parts: WordChange[]) {
  const pick = (change: WordChange["change"]) =>
    parts
      .filter((part) => part.change === change)
      .map((part) => part.text.trim())
      .join(" … ");
  const removed = pick("removed");
  const added = pick("added");
  return [removed ? `remove “${removed}”` : null, added ? `inclui “${added}”` : null].filter(Boolean).join(", ");
}
