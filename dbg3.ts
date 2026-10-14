import { helpArticle } from "./src/lib/help/articles";
import { plainText } from "./src/lib/help/help-model";
const a = helpArticle(process.argv[2])!;
console.log(`# ${a.title}\n${a.summary}\n`);
for (const s of a.sections) {
  console.log(`## ${s.title}`);
  for (const b of s.blocks) {
    if (b.kind === "p" || b.kind === "note") console.log((b.kind === "note" ? "[nota] " : "") + plainText(b.text));
    else if (b.kind === "pairs") b.items.forEach((i) => console.log(`- ${i.term}: ${plainText(i.text)}`));
    else b.items.forEach((x, n) => console.log(`${b.kind === "steps" ? n + 1 + "." : "-"} ${plainText(x)}`));
  }
}
console.log("\n## FAQ"); (a.faq ?? []).forEach((f) => console.log(`P: ${f.q}\nR: ${plainText(f.a)}`));
