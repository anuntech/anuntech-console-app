"use client";
import { useLayoutEffect } from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import styles from "./brand-loading.module.css";
/**
 * Vinheta da Anuntech como tela de carregamento.
 *
 * Só entra nos dois momentos combinados: ao confirmar o acesso (tela cheia)
 * e nas rotas pesadas do Console (dentro da página). Nos dois, o mesmo
 * símbolo da marca, em violeta: no acesso confirmado ele se monta com o nome
 * (os pixels chegam e se encaixam); nas rotas pesadas, uma onda de luz passa
 * pelos pixels enquanto a página carrega. Nunca na navegação comum, que
 * continua com o esqueleto. Quem pede movimento reduzido vê o logotipo parado.
 */
/** Quando a vinheta de página apareceu pela última vez (`BrandLoadingHold` lê). */
let shownAt = 0;
export function takeShownAt() {
  const value = shownAt;
  shownAt = 0;
  return value;
}

/** O símbolo da marca, em violeta, com a onda de carregamento. */
export function LoadingMark() {
  return <BrandMark mode="loading" className={styles.mark} />;
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
        <BrandMark mode="intro" wordmark className={styles.intro} />
      </div>
    );
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-in fade-in fill-mode-both delay-150 duration-300 ${styles.page}`}
    >
      <span className="sr-only">{label}</span>
      <LoadingMark />
    </div>
  );
}
