import { Fragment, type ReactNode } from "react";

/*
 * The small Markdown the legal pages are written in: # and ## and ### titles,
 * paragraphs, "- " lists, tables and **bold**. Server-rendered, no client code.
 */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

export function LegalDocument({ source }: { source: string }) {
  const blocks = source.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <article className="space-y-4 text-[15px] leading-7 text-foreground">
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((line) => line.trim());
        if (!lines.length) return null;
        const first = lines[0];
        if (first.startsWith("### "))
          return (
            <h3 key={b} className="pt-2 text-base font-semibold">
              {first.slice(4)}
            </h3>
          );
        if (first.startsWith("## "))
          return (
            <h2 key={b} className="pt-6 text-xl font-semibold tracking-tight">
              {first.slice(3)}
            </h2>
          );
        if (first.startsWith("# "))
          return (
            <h1 key={b} className="text-3xl font-semibold tracking-tight">
              {first.slice(2)}
            </h1>
          );
        if (lines.every((line) => line.trim().startsWith("|"))) {
          const [head, , ...rows] = lines;
          return (
            <div key={b} className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {cells(head).map((cell, i) => (
                      <th key={i} className="px-3 py-2 font-medium">
                        {inline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={r} className="border-t align-top">
                      {cells(row).map((cell, i) => (
                        <td key={i} className="px-3 py-2">
                          {inline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (lines.every((line) => line.trim().startsWith("- ")))
          return (
            <ul key={b} className="list-disc space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.trim().slice(2))}</li>
              ))}
            </ul>
          );
        return (
          <p key={b}>
            {lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 ? <br /> : null}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </article>
  );
}
