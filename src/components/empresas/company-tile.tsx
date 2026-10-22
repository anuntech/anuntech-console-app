import { cn } from "@/lib/cn";
import { companyInitials } from "@/components/console/company-mark";

/*
 * A company's face in Empresas: its initials on a tile drawn like the logo,
 * the left half smooth and the right half pixels ("da planilha ao produto").
 * The pixels come from the name, so each client gets its own edge and the
 * grid stops being a row of identical lavender squares. Decorative: the name
 * beside it says who it is.
 */

/** 8×8 grid in a 16-unit box: the right half is 4 columns of 8 cells. */
const COLUMNS = [8, 10, 12, 14] as const;
const ROWS = [0, 2, 4, 6, 8, 10, 12, 14] as const;
/** Chance that a cell is missing, per column: the edge dissolves outwards. */
const MISSING = [0, 0.06, 0.2, 0.42];
/** Chance that a cell is lit in the brand violet. */
const LIT = 0.2;

/** Seeded random (mulberry32), so a name always draws the same pixels, on the server and in the browser. */
function seeded(name: string) {
  let seed = 0;
  for (const char of name) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellsFor(name: string) {
  const random = seeded(name.trim().toLowerCase());
  const cells: { x: number; y: number; lit: boolean }[] = [];
  COLUMNS.forEach((x, column) =>
    ROWS.forEach((y) => {
      const missing = random() < MISSING[column];
      const lit = random() < LIT;
      if (!missing) cells.push({ x, y, lit });
    }),
  );
  return cells;
}

const SIZES = {
  sm: "size-9 rounded-lg text-xs",
  md: "size-10 rounded-lg text-sm",
  lg: "size-12 rounded-xl text-sm",
} as const;

export function CompanyTile({
  name,
  size = "md",
  className,
}: {
  name: string;
  /** sm 36px (table rows), md 40px (cards), lg 48px (the company page). */
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative isolate flex shrink-0 items-center justify-center overflow-hidden font-semibold tracking-tight text-accent-foreground select-none",
        SIZES[size],
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="absolute inset-0 -z-10 size-full" shapeRendering="crispEdges">
        <rect width="8.2" height="16" className="fill-accent" />
        {cellsFor(name).map(({ x, y, lit }) => (
          <rect
            key={`${x}-${y}`}
            x={x + 0.2}
            y={y + 0.2}
            width="1.6"
            height="1.6"
            className={lit ? "fill-brand/30 dark:fill-brand/45" : "fill-accent"}
          />
        ))}
      </svg>
      {companyInitials(name)}
    </span>
  );
}
