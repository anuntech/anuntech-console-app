import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import type { Inline, NoteBlock, TranscriptLine } from "@/lib/bookmarks/note-markdown";

/*
 * A meeting note drawn from the blocks note-markdown.ts reads. Everything is
 * React text, so a note can never inject markup. Server component: nothing
 * here needs the browser.
 */

function Text({ content }: { content: Inline[] }) {
  return content.map((part, index) =>
    part.bold ? (
      <strong key={index} className="font-semibold text-foreground">
        {part.text}
      </strong>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}

export function NoteBody({ blocks }: { blocks: NoteBlock[] }) {
  return (
    <div className="flex flex-col gap-4 text-[0.9375rem] leading-[1.65] text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "rule") return <hr key={index} className="border-border" />;
        if (block.type === "heading")
          return block.level === 1 ? (
            <h2 key={index} className="text-lg font-semibold tracking-[-0.01em]">
              <Text content={block.content} />
            </h2>
          ) : (
            <h3
              key={index}
              className={cn(
                "font-semibold tracking-[-0.01em] text-foreground",
                block.level === 2 ? "mt-3 text-base first:mt-0" : "mt-1 text-sm",
              )}
            >
              <Text content={block.content} />
            </h3>
          );
        if (block.type === "paragraph")
          return (
            <p key={index} className="max-w-[72ch] text-pretty">
              <Text content={block.content} />
            </p>
          );
        const tasks = block.items.some((item) => item.checked !== null);
        return (
          <ul key={index} className={cn("flex max-w-[72ch] flex-col gap-2", !tasks && "list-disc pl-5 marker:text-muted-foreground")}>
            {block.items.map((item, itemIndex) =>
              item.checked === null ? (
                <li key={itemIndex} className="pl-1 text-pretty">
                  <Text content={item.content} />
                </li>
              ) : (
                <li key={itemIndex} className="flex items-start gap-2.5 text-pretty">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[0.3rem] flex size-4 shrink-0 items-center justify-center rounded-[5px] border",
                      item.checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
                    )}
                  >
                    {item.checked && <CheckIcon className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn(item.checked && "text-muted-foreground line-through")}>
                    <span className="sr-only">{item.checked ? "Feito: " : "A fazer: "}</span>
                    <Text content={item.content} />
                  </span>
                </li>
              ),
            )}
          </ul>
        );
      })}
    </div>
  );
}

export function TranscriptBody({ lines }: { lines: TranscriptLine[] }) {
  return (
    <ol className="flex flex-col gap-3 text-sm leading-[1.6] text-foreground">
      {lines.map((line, index) => (
        <li key={index} className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3">
          <span className="pt-px text-xs tabular-nums text-muted-foreground">{line.time ?? ""}</span>
          <p className="max-w-[72ch] text-pretty">{line.text}</p>
        </li>
      ))}
    </ol>
  );
}
