import { cn } from "@/lib/cn";

// A slow pulse (0.5 Hz), stopped by the reduced-motion reset in globals.css.
const bar = "block animate-pulse rounded-md bg-secondary";

// Keep this fallback below workspace routes, outside the settings dialog.
// Shaped like the standard list (header, then one card with the toolbar and
// rows), so the swap to the real page does not jump. It fades in after 150ms:
// an answer faster than that never flashes a skeleton.
export default function Loading() {
  return (
    <div
      role="status"
      aria-atomic="true"
      className="flex animate-in flex-col gap-7 duration-(--anu-motion-base) ease-brand fade-in fill-mode-both delay-150"
    >
      <span className="sr-only">Carregando o Console…</span>
      <div className="flex items-center gap-2.5" aria-hidden="true">
        <span className={cn(bar, "h-8 w-48 max-w-[60%]")} />
        <span className={cn(bar, "h-5 w-8 rounded-full")} />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card" aria-hidden="true">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className={cn(bar, "h-9 w-64 max-w-[55%] rounded-lg")} />
          <span className={cn(bar, "h-9 w-28 rounded-full max-sm:hidden")} />
          <span className={cn(bar, "ml-auto h-9 w-9 rounded-full sm:w-32")} />
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
          <div key={row} className="flex items-center gap-6 border-b px-4 py-4 last:border-0">
            <span className="flex min-w-0 flex-[2] flex-col gap-2">
              <span className={cn(bar, "h-3.5 w-3/4")} />
              <span className={cn(bar, "h-3 w-1/3")} />
            </span>
            <span className={cn(bar, "h-5 w-24 rounded-full max-sm:hidden")} />
            <span className={cn(bar, "h-3.5 flex-1 max-md:hidden")} />
          </div>
        ))}
      </div>
    </div>
  );
}
