import { cn } from "@/lib/cn";

/**
 * Progress in steps, drawn like the logo's pixel half: one square per step,
 * violet when done, a smaller outline while pending ("do bruto ao produto").
 * For short checklists (implantação, a journey's steps); a long count reads
 * better as text. When a step completes, its square fills and settles
 * (a transition, so it plays on change, never on load).
 */
export function PixelProgress({
  done,
  total,
  label,
  className,
}: {
  done: number;
  total: number;
  /** What is progressing, for screen readers: "Implantação". */
  label: string;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(done, total));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={filled}
      aria-valuetext={`${filled} de ${total} ${total === 1 ? "passo concluído" : "passos concluídos"}`}
      className={cn("flex flex-wrap gap-1", className)}
    >
      {Array.from({ length: total }, (_, step) => (
        <span
          key={step}
          aria-hidden="true"
          className={cn(
            "size-2.5 rounded-[2px] transition-[background-color,border-color,transform] duration-(--anu-motion-base)",
            step < filled ? "bg-brand" : "scale-[0.8] border border-field-border bg-transparent",
          )}
        />
      ))}
    </div>
  );
}
