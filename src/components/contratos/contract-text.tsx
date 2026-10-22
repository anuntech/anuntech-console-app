import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { contractBlocks, diffBlocks, type BlockChange, type ContractBlock } from "@/lib/contracts/contract-text";

/** What a reader may add to one block of the text, by its position: a button beside it, cards under it. */
export type BlockExtras = { action?: ReactNode; after?: ReactNode; active?: boolean };

function Block({ block }: { block: ContractBlock }) {
  switch (block.type) {
    case "title":
      return (
        <h3 className="m-0 mb-8 text-center text-[17px] leading-7 font-bold tracking-[0.04em] text-balance uppercase">
          {block.text}
        </h3>
      );
    case "heading":
      return (
        <h4 className="m-0 mt-8 mb-3 text-[13.5px] leading-6 font-bold tracking-[0.06em] uppercase">
          {block.text}
        </h4>
      );
    case "party":
      return (
        <p className="mt-3 text-pretty">
          <span className="font-bold">{block.label}:</span> {block.text}
        </p>
      );
    case "clause":
      return (
        <p className="mt-2 grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-1 text-pretty whitespace-pre-wrap">
          <span className="text-muted-foreground tabular-nums">{block.number}</span>
          <span>{block.text}</span>
        </p>
      );
    default:
      return <p className="mt-4 text-pretty whitespace-pre-wrap">{block.text}</p>;
  }
}

/**
 * The contract as a document: a sheet with the title centered, parties
 * with their role in bold, clause headings set apart and numbered items
 * with a hanging number. Reads like the PDF, from the same plain text.
 *
 * With `previousBody`, what changed since that text is marked: rewritten or
 * new blocks get a bar in the margin, removed ones stay struck through where
 * they were. `extras` lets a reader attach a button and cards to a block.
 */
export function ContractText({
  body,
  previousBody,
  extras,
  className,
}: {
  body: string;
  previousBody?: string | null;
  extras?: (index: number, block: ContractBlock) => BlockExtras | null;
  className?: string;
}) {
  const blocks = contractBlocks(body);
  const entries: BlockChange[] = previousBody
    ? diffBlocks(contractBlocks(previousBody), blocks)
    : blocks.map((block, index) => ({ block, change: "same", index }));
  return (
    <article
      className={cn(
        "mx-auto max-w-[70ch] font-serif text-[15.5px] leading-7 text-foreground [font-family:Charter,'Iowan_Old_Style','Palatino_Linotype',Georgia,serif]",
        className,
      )}
    >
      {entries.map((entry, position) => {
        if (entry.change === "removed")
          return (
            <div
              key={`removed-${position}`}
              className="-ml-4 border-l-2 border-destructive-edge pl-[calc(1rem-2px)] text-muted-foreground line-through decoration-destructive/60"
            >
              <span className="sr-only">Removido nesta versão: </span>
              <Block block={entry.block} />
            </div>
          );
        const index = entry.index!;
        const extra = extras?.(index, entry.block) ?? null;
        const changed = entry.change === "added" && !!previousBody;
        if (!changed && !extra) return <Block key={index} block={entry.block} />;
        return (
          <div
            key={index}
            data-block={index}
            className={cn(
              "group/block relative -ml-4 border-l-2 pl-[calc(1rem-2px)] transition-colors",
              changed ? "border-primary bg-accent/40 py-0.5" : "border-transparent",
              extra?.active && "border-primary",
              // On a phone the button sits in the block's corner, beside the text.
              extra?.action && "pr-9 sm:pr-0",
            )}
          >
            {changed && <span className="sr-only">Mudou nesta versão: </span>}
            <Block block={entry.block} />
            {extra?.action && (
              <div className="absolute top-0.5 right-0 font-sans sm:top-1 sm:-right-11">{extra.action}</div>
            )}
            {extra?.after && <div className="mt-3 mb-2 flex flex-col gap-2 font-sans">{extra.after}</div>}
          </div>
        );
      })}
    </article>
  );
}
