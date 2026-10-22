"use client";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { companyInitials } from "./company-mark";

// Tints for items without an icon, from the tokens (the same violet and neutrals
// as project labels); the same name keeps the same tint.
const tints = [
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-card text-foreground ring-1 ring-border ring-inset",
];
function tintFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return tints[Math.abs(hash) % tints.length];
}

/**
 * The face of a product or service: its catalog icon (src from catalogIconSrc)
 * or, without one, its initials on a soft tint. Decorative: the name next to it
 * carries the meaning, so the tile is hidden from screen readers.
 */
export function ProductIcon({
  src,
  name,
  size = 40,
  className,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  // Remembers which address failed, so a new icon (a new ?v=) is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = src && src !== failedSrc ? src : null;
  return (
    <span
      aria-hidden="true"
      // The size is a variable; a class changes it per breakpoint only with `!`
      // (max-sm:[--icon:44px]!), since this inline value wins otherwise.
      style={{ "--icon": `${size}px` } as CSSProperties}
      className={cn(
        "relative flex size-(--icon) shrink-0 items-center justify-center overflow-hidden rounded-[22%] text-[calc(var(--icon)*0.36)] font-semibold tracking-tight select-none",
        image ? "bg-white ring-1 ring-black/5 dark:ring-white/10" : tintFor(name),
        className,
      )}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          width={size}
          height={size}
          unoptimized
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedSrc(image)}
        />
      ) : (
        companyInitials(name)
      )}
    </span>
  );
}
