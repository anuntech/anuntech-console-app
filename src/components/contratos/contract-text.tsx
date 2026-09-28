import { cn } from "cn";
import { contractBlocks } from "@/lib/contracts/contract-text";

/**
 * The contract as a document: a sheet with the title centered, parties
 * with their role in bold, clause headings set apart and numbered items
 * with a hanging number. Reads like the PDF, from the same plain text.
 */
export function ContractText({ body, className }: { body: string; className?: string }) {
  const blocks = contractBlocks(body);
  return (
    <article
      className={cn(
        "mx-auto max-w-[70ch] font-serif text-[15.5px] leading-7 text-foreground [font-family:Charter,'Iowan_Old_Style','Palatino_Linotype',Georgia,serif]",
        className,
      )}
    >
      {blocks.map((block, index) => {
        switch (block.type) {
          case "title":
            return (
              <h3
                key={index}
                className="m-0 mb-8 text-center text-[17px] leading-7 font-bold tracking-[0.04em] text-balance uppercase"
              >
                {block.text}
              </h3>
            );
          case "heading":
            return (
              <h4
                key={index}
                className="m-0 mt-8 mb-3 text-[13.5px] leading-6 font-bold tracking-[0.06em] uppercase"
              >
                {block.text}
              </h4>
            );
          case "party":
            return (
              <p key={index} className="mt-3 text-pretty">
                <span className="font-bold">{block.label}:</span> {block.text}
              </p>
            );
          case "clause":
            return (
              <p key={index} className="mt-2 grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-1 text-pretty whitespace-pre-wrap">
                <span className="text-muted-foreground tabular-nums">{block.number}</span>
                <span>{block.text}</span>
              </p>
            );
          default:
            return (
              <p key={index} className="mt-4 text-pretty whitespace-pre-wrap">
                {block.text}
              </p>
            );
        }
      })}
    </article>
  );
}
