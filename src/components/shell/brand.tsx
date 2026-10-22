import { cn } from "@/lib/cn";

/* The logo files come from anuntech/brand (public/brand/logo). Both tones are
   rendered and CSS shows the one that matches the theme, so nothing flashes. */
const tones = (file: "symbol" | "lockup") => ({
  light: `/brand/logo/${file}-preto.svg`,
  dark: `/brand/logo/${file}-branco.svg`,
});

function ToneImage({
  file,
  alt,
  className,
}: {
  file: "symbol" | "lockup";
  alt: string;
  className?: string;
}) {
  const src = tones(file);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
      <img src={src.light} alt={alt} className={cn("dark:hidden", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
      <img src={src.dark} alt="" aria-hidden="true" className={cn("hidden dark:block", className)} />
    </>
  );
}

/** Symbol and name side by side. */
export function BrandLockup({ className }: { className?: string }) {
  return <ToneImage file="lockup" alt="Anuntech" className={cn("h-7 w-auto", className)} />;
}

/** The symbol alone, for tight spots. */
export function BrandSymbol({ className, alt = "" }: { className?: string; alt?: string }) {
  return <ToneImage file="symbol" alt={alt} className={cn("size-8", className)} />;
}

export function Brand() {
  return (
    <div className="brand">
      <BrandSymbol className="size-10" />
      <div>
        <span>Anuntech</span>
        <strong>Console</strong>
      </div>
    </div>
  );
}
