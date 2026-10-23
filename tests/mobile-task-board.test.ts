import assert from "node:assert/strict";
import test from "node:test";
import { labelDot } from "../src/components/projetos/project-badges";
import { labelColors, labelTone, reorderAfter } from "../mobile/src/lib/tasks";

const palette = {
  accent: "accent",
  infoEdge: "infoEdge",
  primary: "primary",
  secondary: "secondary",
  secondaryForeground: "secondaryForeground",
  border: "border",
  foreground: "foreground",
  muted: "muted",
};

test("a label has the web's colour in the app, whatever its case", () => {
  const webTone: Record<string, string> = { "bg-primary": "brand", "bg-muted-foreground": "neutral", "bg-foreground": "outline" };
  const labels = ["Bug", "Design", "Front", "Backend", "Urgente", "Ação", "pagamento", "SEO", "iOS", "Android", "Revisão de texto"];
  for (const label of labels) assert.equal(labelTone(label), webTone[labelDot(label)], label);
  assert.equal(labelTone("Design"), labelTone("DESIGN"));
  assert.deepEqual(new Set(labels.map(labelTone)), new Set(["brand", "neutral", "outline"]));
});

test("each tone draws with the app's palette", () => {
  const brand = ["Bug", "Design", "Front", "Backend", "SEO"].find((l) => labelTone(l) === "brand")!;
  assert.deepEqual(labelColors(palette, brand), { bg: "accent", edge: "infoEdge", fg: "primary", dot: "primary" });
  const outline = ["Bug", "Design", "Front", "Backend", "SEO", "iOS"].find((l) => labelTone(l) === "outline")!;
  assert.equal(labelColors(palette, outline).bg, "transparent");
});

test("moving inside a column says where the task lands (afterId)", () => {
  const ids = ["a", "b", "c", "d"];
  assert.equal(reorderAfter(ids, "c", "top"), null);
  assert.equal(reorderAfter(ids, "c", "up"), "a");
  assert.equal(reorderAfter(ids, "b", "up"), null);
  assert.equal(reorderAfter(ids, "b", "down"), "c");
  assert.equal(reorderAfter(ids, "a", "top"), undefined);
  assert.equal(reorderAfter(ids, "a", "up"), undefined);
  assert.equal(reorderAfter(ids, "d", "down"), undefined);
  assert.equal(reorderAfter(ids, "x", "down"), undefined);
});
