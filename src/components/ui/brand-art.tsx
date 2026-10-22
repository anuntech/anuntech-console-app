import { useId, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * The brand illustrations, drawn from the same geometry as the brand repo
 * (anuntech-brand/scripts/art.mjs) but painted with the Console's tokens, so
 * they follow light and dark mode and carry no background of their own.
 * Every object is half smooth, half pixel ("da planilha ao produto").
 *
 * The pixel half is grouped by column: on arrival the smooth half fades in
 * and the columns settle one after another (CSS in shadcn.css, `.brand-art`).
 * The art is always decorative; the text beside it says what it means.
 */

/** Empty-state objects, one per area of the Console. */
export type SpotArtName = "chamados" | "faturas" | "projetos" | "busca";
/** Larger scenes for heroes and side panels. */
export type SceneArtName = "esfera" | "planilha" | "blocos";
export type BrandArtName = SpotArtName | SceneArtName;

type Box = [number, number, number, number];
type Cell = { x: number; y: number; s: number; tone?: string; opacity?: number; rx?: number; style?: CSSProperties };
type Art = {
  viewBox: string;
  /** Under the object: the soft ground shadow. */
  ground?: ReactNode;
  /** The smooth half and anything that does not build in columns. */
  smooth: (uid: string) => ReactNode;
  /** The pixel half, column by column (left to right). */
  columns: Cell[][];
  /** Drawn over the pixels (the invoice's folded corner). */
  over?: ReactNode;
};

const round = (n: number) => Math.round(n * 100) / 100;

/* ---------- geometry, as in art.mjs ---------- */

const inRound = (x: number, y: number, [a, b, c, d]: Box, r: number) => {
  if (x < a || x > c || y < b || y > d) return false;
  const qx = Math.max(a + r - x, 0, x - (c - r));
  const qy = Math.max(b + r - y, 0, y - (d - r));
  return qx * qx + qy * qy <= r * r;
};
const roundRect = ([a, b, c, d]: Box, r: number) =>
  `M${a + r} ${b}H${c - r}A${r} ${r} 0 0 1 ${c} ${b + r}V${d - r}A${r} ${r} 0 0 1 ${c - r} ${d}H${a + r}A${r} ${r} 0 0 1 ${a} ${d - r}V${b + r}A${r} ${r} 0 0 1 ${a + r} ${b}Z`;

/** The pixel half of a flat shape: cells right of `split` whose centre is inside. */
function pixelHalf(contains: (x: number, y: number) => boolean, [, y0, x1, y1]: Box, split: number, step: number) {
  const columns: Cell[][] = [];
  for (let x = split; x < x1; x += step) {
    const column: Cell[] = [];
    for (let y = y0; y < y1; y += step) if (contains(x + step / 2, y + step / 2)) column.push({ x, y, s: step });
    if (column.length) columns.push(column);
  }
  return columns;
}

/** The smooth half of a flat shape: the whole path, clipped left of `split` (a nested svg clips without ids). */
function smoothHalf([x0, y0, , y1]: Box, split: number, body: ReactNode) {
  // 1 unit of slack on the left: enough for antialiasing, not for the ticket's notch to leak outside.
  const x = x0 - 1;
  const y = y0 - 4;
  const w = split - x0 + 1;
  const h = y1 - y0 + 8;
  return (
    <svg x={x} y={y} width={w} height={h} viewBox={`${x} ${y} ${w} ${h}`}>
      {body}
    </svg>
  );
}

const ground = (cx: number, cy: number, rx: number) => (
  <ellipse className="art-ground" cx={cx} cy={cy} rx={rx} ry={round(rx * 0.12)} />
);

/** Seeded random, so the art comes out the same every time (art.mjs `rng`). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- empty states: 480×360 canvas, cropped to the object ---------- */

const SPOT_VIEWBOX = "90 44 300 284";
const SPLIT = 240;

function spot(box: Box, step: number, d: string, contains: (x: number, y: number) => boolean, extra?: ReactNode, rule: "evenodd" | "nonzero" = "nonzero"): Art {
  return {
    viewBox: SPOT_VIEWBOX,
    ground: ground(240, 300, 130),
    smooth: () =>
      smoothHalf(
        box,
        SPLIT,
        <>
          <path className="art-fill" fillRule={rule} d={d} />
          {extra}
        </>,
      ),
    columns: pixelHalf(contains, box, SPLIT, step),
  };
}

const lines = (d: string) => (
  <path className="art-ink" d={d} strokeWidth={10} strokeLinecap="round" opacity={0.85} />
);

const SPOTS: Record<SpotArtName, () => Art> = {
  // A ticket with the side notches.
  chamados: () => {
    const b: Box = [110, 110, 370, 270];
    const notch = (x: number, y: number) => Math.hypot(x - 110, y - 190) < 26 || Math.hypot(x - 370, y - 190) < 26;
    return spot(
      b,
      16,
      roundRect(b, 22) + "M136 190a26 26 0 1 0 -52 0a26 26 0 1 0 52 0Z M396 190a26 26 0 1 0 -52 0a26 26 0 1 0 52 0Z",
      (x, y) => inRound(x, y, b, 22) && !notch(x, y),
      lines("M160 160H226 M160 190H210 M160 220H230"),
      "evenodd",
    );
  },
  // A document with the folded corner.
  faturas: () => {
    const art = spot(
      [160, 60, 320, 280],
      16,
      "M172 60H280L320 100V268A12 12 0 0 1 308 280H172A12 12 0 0 1 160 268V72A12 12 0 0 1 172 60Z",
      (x, y) => x >= 160 && x <= 320 && y >= 60 && y <= 280 && !(x > 280 && y < 60 + (x - 280)),
      lines("M186 120H234 M186 152H230 M186 184H222 M186 236H230"),
    );
    return { ...art, over: <path className="art-soft" d="M280 60V100H320Z" /> };
  },
  // A folder: the tab smooth, the body turning into pixels.
  projetos: () =>
    spot(
      [110, 90, 370, 270],
      16,
      "M128 90H206L230 120H352A18 18 0 0 1 370 138V252A18 18 0 0 1 352 270H128A18 18 0 0 1 110 252V108A18 18 0 0 1 128 90Z",
      (x, y) => inRound(x, y, [110, 120, 370, 270], 18) || (x >= 110 && x <= 230 && y >= 90 && y <= 130),
    ),
  // A magnifier: the lens smooth, the handle turning into pixels.
  busca: () =>
    spot(
      [128, 78, 370, 320],
      14,
      "M128 160a82 82 0 1 0 164 0a82 82 0 1 0 -164 0Z M158 160a52 52 0 1 1 104 0a52 52 0 1 1 -104 0Z M262 237.5L287.5 212L365 289.5L339.5 315Z",
      (x, y) => {
        const dd = Math.hypot(x - 210, y - 160);
        if (dd >= 52 && dd <= 82) return true;
        const t = (x - 262) * 0.7071 + (y - 212) * 0.7071;
        const n = Math.abs(-(x - 262) * 0.7071 + (y - 212) * 0.7071);
        return t >= 0 && t <= 110 && n <= 18;
      },
      undefined,
      "evenodd",
    ),
};

/* ---------- scenes ---------- */

/** Light comes from the upper left, toward the viewer (art.mjs LIGHT). */
const LIGHT = (() => {
  const l = [-0.55, -0.62, 0.56];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();

const ISO = 0.866;
type Faces = [string, string, string];
/** One isometric cube: top, left and right faces, coloured by class. */
function cube(x: number, y: number, s: number, [top, left, right]: Faces, key: string | number) {
  const p = (dx: number, dy: number) => `${round(x + dx)},${round(y + dy)}`;
  return (
    <g key={key}>
      <polygon className={top} points={`${p(0, -s / 2)} ${p(s * ISO, 0)} ${p(0, s / 2)} ${p(-s * ISO, 0)}`} />
      <polygon className={left} points={`${p(-s * ISO, 0)} ${p(0, s / 2)} ${p(0, s * 1.5)} ${p(-s * ISO, s)}`} />
      <polygon className={right} points={`${p(0, s / 2)} ${p(s * ISO, 0)} ${p(s * ISO, s)} ${p(0, s * 1.5)}`} />
    </g>
  );
}
const GRAY_FACES: Faces = ["art-cube-top", "art-cube-left", "art-cube-right"];
const VIOLET_FACES: Faces = ["art-vcube-top", "art-vcube-left", "art-vcube-right"];

const SCENES: Record<SceneArtName, () => Art> = {
  // The feature piece: the smooth half lit, the pixels following the same light, a few coming loose.
  esfera: () => {
    const cx = 800;
    const cy = 440;
    const r = 300;
    const step = 30;
    const shade = (x: number, y: number) => {
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const i = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      return `art-s${Math.round(Math.min(1, i) * 8)}`;
    };
    const columns: Cell[][] = [];
    const edge: Cell[] = [];
    for (let x = cx; x < cx + r; x += step) {
      const column: Cell[] = [];
      for (let y = cy - r; y < cy + r; y += step) {
        const mx = x + step / 2;
        const my = y + step / 2;
        if (Math.hypot(mx - cx, my - cy) > r) continue;
        const cell = { x, y, s: step, tone: shade(mx, my) };
        column.push(cell);
        if (Math.hypot(mx + step - cx, my - cy) > r) edge.push(cell);
      }
      columns.push(column);
    }
    // Loose pixels drifting off the right edge, in a column of their own each distance.
    const rand = rng(7);
    const loose: Cell[][] = [[], [], [], []];
    for (let k = 0; k < 14; k++) {
      const from = edge[Math.floor(rand() * edge.length)];
      const dist = 1 + Math.floor(rand() * 4);
      loose[dist - 1].push({
        x: from.x + dist * step * 1.3,
        y: from.y + Math.round((rand() - 0.5) * 2) * step,
        s: step,
        tone: from.tone,
        opacity: round(0.85 - dist * 0.17),
      });
    }
    return {
      viewBox: "460 110 840 730",
      ground: ground(800, 790, 300),
      smooth: (uid) => (
        <>
          <defs>
            <radialGradient id={`${uid}-sphere`} cx={cx - r * 0.45} cy={cy - r * 0.5} r={r * 1.55} gradientUnits="userSpaceOnUse">
              <stop offset="0" style={{ stopColor: "var(--art-sphere-light)" }} />
              <stop offset=".45" style={{ stopColor: "var(--art-sphere-mid)" }} />
              <stop offset="1" style={{ stopColor: "var(--art-sphere-dark)" }} />
            </radialGradient>
          </defs>
          <svg x={cx - r - 2} y={cy - r - 2} width={r + 2} height={2 * r + 4} viewBox={`${cx - r - 2} ${cy - r - 2} ${r + 2} ${2 * r + 4}`}>
            <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-sphere)`} />
          </svg>
        </>
      ),
      columns: [...columns, ...loose.filter((c) => c.length)],
    };
  },

  // The offer in one picture: the raw spreadsheet, cells travelling, the finished system.
  planilha: () => {
    const rand = rng(3);
    const cw = 34;
    const columns: Cell[][] = [];
    for (let c = 0; c < 9; c++) {
      const column: Cell[] = [];
      columns.push(column);
      for (let r = 0; r < 14; r++) {
        const filled = r === 0 || rand() < 0.38;
        column.push({ x: 120 + c * cw, y: 190 + r * cw, s: cw, tone: r === 0 ? "art-cell-head" : filled ? "art-cell-on" : "art-cell-off" });
      }
    }
    // The travelling cells turn violet as they near the system; grouped in four bands, left to right.
    const fly: Cell[][] = [[], [], [], []];
    for (let k = 0; k < 26; k++) {
      const t = rand();
      const s = 34 - t * 10;
      fly[Math.min(3, Math.floor(t * 4))].push({
        x: round(470 + t * 300),
        y: round(230 + rand() * 420),
        s,
        opacity: round(0.95 - t * 0.35),
        rx: round(t * 8),
        style: { fill: `color-mix(in oklab, var(--art-cell-on), var(--art-fill) ${Math.round(t * 100)}%)` },
      });
    }
    const bars = [0.45, 0.7, 0.55, 0.9, 0.75, 1];
    const win: Box = [820, 170, 1480, 730];
    return {
      viewBox: "100 150 1400 670",
      ground: ground(1150, 760, 330),
      smooth: () => (
        <>
          <path className="art-paper" d={roundRect(win, 22)} strokeWidth={2} />
          <path className="art-fill" d={roundRect([820, 170, 1480, 226], 22)} />
          <rect className="art-fill" x={820} y={204} width={660} height={22} />
          {[0.7, 0.5, 0.35].map((o, i) => (
            <circle key={o} className="art-on-fill" cx={852 + i * 24} cy={198} r={7} opacity={o} />
          ))}
          <rect className="art-panel" x={850} y={256} width={150} height={440} rx={14} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} className={i === 1 ? "art-violet-soft" : "art-pill"} x={868} y={280 + i * 44} width={i === 1 ? 114 : 90} height={24} rx={12} />
          ))}
          <rect className="art-panel" x={1030} y={256} width={420} height={72} rx={14} />
          <rect className="art-pill-strong" x={1052} y={280} width={140} height={24} rx={12} />
          <rect className="art-fill" x={1340} y={274} width={90} height={36} rx={18} />
          <rect className="art-panel" x={1030} y={348} width={100} height={320} rx={14} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} className="art-pill" x={1050} y={372 + i * 46} width={60} height={22} rx={11} />
          ))}
          {bars.map((h, i) => (
            <rect key={i} className={i === 5 ? "art-fill" : "art-violet-bar"} x={1150 + i * 46} y={round(640 - h * 170)} width={30} height={round(h * 170)} rx={6} />
          ))}
        </>
      ),
      // The spreadsheet is the "raw" side here: it builds column by column, then the flying cells.
      columns: [...columns, ...fly.filter((c) => c.length)],
    };
  },

  // Stacked modules: the base still in small cubes, the top block finished and violet.
  blocos: () => {
    const u = 44;
    const n = 4;
    const ox = 540;
    const oy = 800;
    const missing = [
      [3, 3, 3],
      [3, 2, 3],
      [0, 3, 3],
    ];
    const list: [number, number, number][] = [];
    for (let z = 0; z < n; z++)
      for (let yy = 0; yy < n; yy++)
        for (let xx = 0; xx < n; xx++) if (!missing.some(([a, b, c]) => a === xx && b === yy && c === z)) list.push([xx, yy, z]);
    list.sort((a, b) => a[2] - b[2] || a[0] + a[1] - (b[0] + b[1]));
    const topCenter = oy + (n - 1) * u * 0.5 - (n - 1) * u - (u * 0.94) / 2;
    const big = n * u * 0.94;
    return {
      viewBox: "230 170 730 980",
      ground: ground(540, 1110, 300),
      // Cubes overlap in painting order, so the base renders as one piece; the arrival is layer by layer.
      smooth: () => <g>{list.map(([xx, yy, z], i) => cube(ox + (xx - yy) * u * ISO, oy + (xx + yy) * u * 0.5 - z * u, u * 0.94, GRAY_FACES, i))}</g>,
      columns: [],
      over: (
        <>
          <g className="art-col" style={{ animationDelay: "120ms" }}>
            {cube(ox, topCenter - big * 1.5 - 60, big, VIOLET_FACES, "top")}
          </g>
          {[0, 1, 2].map((i) => (
            <g key={i} className="art-col" style={{ animationDelay: `${180 + i * 30}ms` }}>
              {cube(860 + i * 34, 300 - i * 52, u * 0.5, VIOLET_FACES, i)}
            </g>
          ))}
        </>
      ),
    };
  },
};

const cache = new Map<BrandArtName, Art>();
function geometry(name: BrandArtName): Art {
  let art = cache.get(name);
  if (!art) {
    art = (name in SPOTS ? SPOTS[name as SpotArtName] : SCENES[name as SceneArtName])();
    cache.set(name, art);
  }
  return art;
}

/** Column delay: the whole pixel half lands within ~180ms however many columns it has. */
const columnDelay = (index: number, count: number) => Math.round(60 + index * Math.min(20, 180 / Math.max(1, count - 1)));

/**
 * One brand illustration. Size it with a width class (`w-44`, `w-full`);
 * the height follows the art's proportions.
 *
 * - `animate="build"` (default): the smooth half fades in, the pixel columns
 *   settle left to right, once, on mount. Nothing loops.
 * - `animate="fade"`: a plain fade, for art that can toggle often (search).
 * - `animate={false}`: static.
 *
 * Reduced motion shows the art at rest; on heavy routes the arrival waits
 * for the brand vignette (`data-brand-hold`).
 */
export function BrandArt({
  name,
  animate = "build",
  glow = false,
  className,
}: {
  name: BrandArtName;
  animate?: "build" | "fade" | false;
  /** A soft violet light behind the art (strongest in dark mode). */
  glow?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const art = geometry(name);
  const svg = (
    <svg
      viewBox={art.viewBox}
      aria-hidden="true"
      focusable="false"
      data-art={name}
      data-anim={animate || undefined}
      className={cn("brand-art block h-auto", !glow && className)}
    >
      {art.ground}
      <g className="art-smooth">{art.smooth(uid)}</g>
      {art.columns.map((column, index) => (
        <g key={index} className="art-col" style={{ animationDelay: `${columnDelay(index, art.columns.length)}ms` }}>
          {/* Static list, keyed by position: loose cells can share x/y with the grid. */}
          {column.map((cell, i) => (
            <rect
              key={i}
              className={cell.tone ?? "art-fill"}
              x={round(cell.x + cell.s * 0.07)}
              y={round(cell.y + cell.s * 0.07)}
              width={round(cell.s * 0.86)}
              height={round(cell.s * 0.86)}
              rx={cell.rx || undefined}
              opacity={cell.opacity}
              style={cell.style}
            />
          ))}
        </g>
      ))}
      {art.over}
    </svg>
  );
  if (!glow) return svg;
  return (
    <span className={cn("relative isolate block", className)}>
      <span aria-hidden="true" className="brand-glow pointer-events-none absolute -inset-[18%] -z-10" />
      {svg}
    </span>
  );
}
