/**
 * Vinheta da Anuntech como tela de carregamento.
 *
 * Só entra nos dois momentos combinados: ao confirmar o acesso (tela cheia,
 * marinho) e nas rotas pesadas do Console (dentro da página, no fundo do
 * tema). Nunca na navegação comum, que continua com o esqueleto.
 *
 * Os vídeos vêm de `public/brand/vinheta/` (gerados a partir do logotipo real;
 * ver `videos/vinheta/README.md`). Quem pede movimento reduzido vê só o
 * primeiro quadro, que é o logotipo parado.
 */
const BASE = "/brand/vinheta";

function Sting({
  tone,
  rounded = false,
}: {
  tone: "navy" | "light";
  rounded?: boolean;
}) {
  const shape = rounded ? " rounded-[28px]" : "";
  return (
    <>
      <video
        className={`aspect-square w-[min(60vw,320px)] motion-reduce:hidden${shape}`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={`${BASE}/${tone}-poster.png`}
        aria-hidden="true"
      >
        <source src={`${BASE}/${tone}.webm`} type="video/webm" />
        <source src={`${BASE}/${tone}.mp4`} type="video/mp4" />
      </video>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={`hidden aspect-square w-[min(60vw,320px)] motion-reduce:block${shape}`}
        src={`${BASE}/${tone}-poster.png`}
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
  if (fullscreen)
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[60] grid place-items-center bg-[#0a1d42]"
      >
        <span className="sr-only">{label}</span>
        <Sting tone="navy" />
      </div>
    );
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-in fade-in fill-mode-both grid min-h-[60vh] place-items-center delay-150 duration-300"
    >
      <span className="sr-only">{label}</span>
      <div className="dark:hidden">
        <Sting tone="light" />
      </div>
      <div className="hidden dark:block">
        <Sting tone="navy" rounded />
      </div>
    </div>
  );
}
