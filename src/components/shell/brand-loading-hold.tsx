"use client";
import { useEffect, useState } from "react";
import { BrandLockup, takeShownAt } from "./brand-loading";
import styles from "./brand-loading.module.css";

/** Tempo mínimo da vinheta de página quando ela chegou a aparecer. */
const MIN_MS = 1200;

/**
 * Envolve o conteúdo das rotas pesadas. Se o `loading.tsx` mostrou a vinheta
 * há menos de 1,2 s, mantém o logotipo animado por cima até completar o tempo
 * e então some num fade. Se a página chegou antes de a vinheta aparecer, não
 * faz nada.
 */
export function BrandLoadingHold({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"idle" | "hold" | "out">("idle");
  useEffect(() => {
    const shownAt = takeShownAt();
    if (!shownAt) return;
    const left = MIN_MS - (performance.now() - shownAt);
    if (left <= 0) return;
    // Decisão de montagem: a sobreposição precisa existir no primeiro quadro
    // depois da hidratação, antes de qualquer pintura do conteúdo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("hold");
    const out = window.setTimeout(() => setPhase("out"), left);
    const done = window.setTimeout(() => setPhase("idle"), left + 340);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(done);
    };
  }, []);
  return (
    <div className="relative">
      {children}
      {phase !== "idle" && (
        <div
          className={`${styles.hold} ${phase === "out" ? styles.holdOut : ""}`}
          aria-hidden="true"
        >
          <BrandLockup />
        </div>
      )}
    </div>
  );
}
