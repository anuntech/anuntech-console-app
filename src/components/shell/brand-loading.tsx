"use client";
import { useLayoutEffect } from "react";
import styles from "./brand-loading.module.css";
/**
 * Vinheta da Anuntech como tela de carregamento.
 *
 * Só entra nos dois momentos combinados: ao confirmar o acesso (tela cheia)
 * e nas rotas pesadas do Console (dentro da página). Nos dois, o mesmo
 * desenho: o símbolo da marca como máscara em CSS, no violeta da marca,
 * respirando devagar sobre o fundo do tema. Nunca na navegação comum, que
 * continua com o esqueleto. Quem pede movimento reduzido vê o símbolo parado.
 */
/** Quando a vinheta de página apareceu pela última vez (`BrandLoadingHold` lê). */
let shownAt = 0;
export function takeShownAt() {
  const value = shownAt;
  shownAt = 0;
  return value;
}

/** O símbolo da marca, em violeta, respirando. */
export function BrandMark() {
  return <span className={styles.mark} aria-hidden="true" />;
}

export function BrandLoading({
  fullscreen = false,
  label = "Carregando o Console…",
}: {
  /** Tela cheia: usado só no acesso confirmado. */
  fullscreen?: boolean;
  /** Texto para leitores de tela. */
  label?: string;
}) {
  useLayoutEffect(() => {
    if (!fullscreen) shownAt = performance.now();
  }, [fullscreen]);
  if (fullscreen)
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed inset-0 z-[60] grid place-items-center ${styles.splash}`}
      >
        <span className="sr-only">{label}</span>
        <BrandMark />
      </div>
    );
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-in fade-in fill-mode-both delay-150 duration-300 ${styles.page}`}
    >
      <span className="sr-only">{label}</span>
      <BrandMark />
    </div>
  );
}
