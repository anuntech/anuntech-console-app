"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MARK_ANUN, MARK_CELLS, MARK_HALF, MARK_NAME_WIDTH, MARK_TECH } from "@/components/ui/brand-mark-shape";
import styles from "./console-opening.module.css";

/**
 * The Console's opening, the same as the app's (mobile/src/components/opening.tsx): the violet screen
 * with the symbol, a wave of light across the pixels, the symbol slides left as "anun" and then "tech"
 * come in, and the screen opens onto the Console.
 *
 * It plays when someone enters the Console: on a full page load after sign-in, or when it last played
 * more than half an hour ago in this browser. The decision runs in a script before the first paint (so
 * the page never flashes before the violet), and the animation is CSS only, so it plays while the page
 * hydrates. Reduced motion never sees it. Client navigation never plays it.
 */
const KEY = "console-opening-at";
/** Set by the sign-in screen: the next Console load plays the opening. */
export const OPENING_AFTER_SIGN_IN = "console-opening-next";
const AGAIN_AFTER = 30 * 60 * 1000;

const gate = `try{var d=document.documentElement,n=Date.now(),f=sessionStorage.getItem("${OPENING_AFTER_SIGN_IN}");sessionStorage.removeItem("${OPENING_AFTER_SIGN_IN}");if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&(f||n-(+localStorage.getItem("${KEY}")||0)>${AGAIN_AFTER})){d.setAttribute("data-opening","play");localStorage.setItem("${KEY}",String(n))}}catch(e){}`;

const GAP = 26;
const WIDTH = 100 + GAP + MARK_NAME_WIDTH;
/** The pixels light up from the smooth edge outwards (the app's wave, as a delay per pixel). */
const waveDelay = (x: number, y: number) => Math.round(((x - 50) / 46 + (y - 4) / 400) * 500 - 125);

const playing = () => document.documentElement.getAttribute("data-opening") === "play";
const noSubscribe = () => () => {};

export function ConsoleOpening() {
  const play = useSyncExternalStore(noSubscribe, playing, () => true);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!play) return;
    // The CSS ends the opening; this only takes it out of the page afterwards.
    const timer = window.setTimeout(() => {
      document.documentElement.removeAttribute("data-opening");
      setDone(true);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [play]);
  if (!play || done) return null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: gate }} />
      <div className={styles.screen} role="status" aria-label="Abrindo o Console" suppressHydrationWarning>
        <svg viewBox={`0 0 ${WIDTH} 100`} aria-hidden="true" className={styles.lockup}>
          <g className={styles.symbol}>
            <path d={MARK_HALF} />
            {MARK_CELLS.map(([x, y, s]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={s} height={s} style={{ animationDelay: `${waveDelay(x, y)}ms` }} />
            ))}
          </g>
          <g transform={`translate(${100 + GAP} ${50 + 76 * 0.27})`}>
            <path className={styles.anun} d={MARK_ANUN} />
            <path className={styles.tech} d={MARK_TECH} />
          </g>
        </svg>
      </div>
    </>
  );
}

/** The violet screen the sign-in shows while the Console loads: the opening's first frame. */
export function OpeningSplash() {
  return (
    <div className={`${styles.screen} ${styles.splash}`} role="status" aria-label="Acesso confirmado. Abrindo o Console.">
      <svg viewBox={`0 0 ${WIDTH} 100`} aria-hidden="true" className={styles.lockup}>
        <g className={styles.symbolStill}>
          <path d={MARK_HALF} />
          {MARK_CELLS.map(([x, y, s]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={s} height={s} />
          ))}
        </g>
      </svg>
    </div>
  );
}

/**
 * After signing in: a full load of the Console, so its opening plays from the splash's frame. Other
 * destinations (an app opening through /abrir) keep the client navigation and return false.
 */
export function enterConsole(next: string) {
  if (next.startsWith("/abrir")) return false;
  markSignIn();
  window.location.assign(next);
  return true;
}

/** The next Console load in this tab plays the opening (sign-in by Google comes back through a redirect). */
export function markSignIn() {
  try {
    sessionStorage.setItem(OPENING_AFTER_SIGN_IN, "1");
  } catch {}
}
