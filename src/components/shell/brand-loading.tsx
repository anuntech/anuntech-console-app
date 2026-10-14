"use client";
import { useLayoutEffect } from "react";
import styles from "./brand-loading.module.css";
/**
 * Vinheta da Anuntech como tela de carregamento.
 *
 * Só entra nos dois momentos combinados: ao confirmar o acesso (tela cheia,
 * marinho, com o vídeo gerado a partir do logotipo) e nas rotas pesadas do
 * Console (dentro da página, no fundo do tema, o logotipo real animado em
 * CSS). Nunca na navegação comum, que continua com o esqueleto.
 *
 * O vídeo vem de `public/brand/vinheta/` (ver `videos/vinheta/README.md`).
 * Quem pede movimento reduzido vê o logotipo parado.
 */
const BASE = "/brand/vinheta";
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

function NavySting() {
  return (
    <>
      <video
        className="aspect-square w-[min(60vw,320px)] motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={`${BASE}/navy-poster.png`}
        aria-hidden="true"
      >
        <source src={`${BASE}/navy.webm`} type="video/webm" />
        <source src={`${BASE}/navy.mp4`} type="video/mp4" />
      </video>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="hidden aspect-square w-[min(60vw,320px)] motion-reduce:block"
        src={`${BASE}/navy-poster.png`}
        alt=""
        aria-hidden="true"
      />
    </>
  );
}

export function BrandLoading({
  fullscreen = false,
  label = "Carregando o Console…",
}: {
  /** Tela cheia em marinho: usado só no acesso confirmado. */
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
        className="fixed inset-0 z-[60] grid place-items-center bg-[#0a1d42]"
      >
        <span className="sr-only">{label}</span>
        <NavySting />
      </div>
    );
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-in fade-in fill-mode-both grid min-h-[60vh] place-items-center delay-150 duration-300"
    >
      <span className="sr-only">{label}</span>
      <BrandLockup />
    </div>
  );
}
