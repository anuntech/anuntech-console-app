"use client";
import { useLayoutEffect } from "react";
import styles from "./brand-loading.module.css";
/**
 * Vinheta da Anuntech como tela de carregamento.
 *
 * Só entra nos dois momentos combinados: ao confirmar o acesso (tela cheia)
 * e nas rotas pesadas do Console (dentro da página). Nos dois, o mesmo
 * desenho: o logotipo real como máscara em CSS, na cor do tema, com a faixa
 * amarela percorrendo o símbolo, sobre um cinza bem claro (ou o fundo do
 * tema escuro). Nunca na navegação comum, que continua com o esqueleto.
 * Quem pede movimento reduzido vê o logotipo parado.
 */
/** Quando a vinheta de página apareceu pela última vez (`BrandLoadingHold` lê). */
let shownAt = 0;
export function takeShownAt() {
  const value = shownAt;
  shownAt = 0;
  return value;
}

/** Logotipo real, cor do tema, faixa amarela percorrendo o símbolo. */
export function BrandLockup() {
  return (
    <div className={styles.lockup} aria-hidden="true">
      <span className={styles.base} />
      <span className={styles.sweep} />
    </div>
  );
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
        <BrandLockup />
      </div>
    );
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-in fade-in fill-mode-both delay-150 duration-300 ${styles.page}`}
    >
      <span className="sr-only">{label}</span>
      <BrandLockup />
    </div>
  );
}
