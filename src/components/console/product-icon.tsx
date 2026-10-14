"use client";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { cn } from "cn";
import { companyInitials } from "./company-mark";

// Soft tints for items without an icon; the same name keeps the same color.
const tints = [
  "bg-[#DCE8FF] text-[#1a3585]",
  "bg-[#F9DDDF] text-[#9b1c31]",
  "bg-[#D9EDE1] text-[#145c3a]",
  "bg-[#F8E8C5] text-[#7a4a06]",
  "bg-[#E8DFF6] text-[#4b2a8a]",
  "bg-[#D4EDF0] text-[#0f5961]",
  "bg-[#F6DFCE] text-[#8a3a12]",
  "bg-[#E1E3F8] text-[#2f3a8f]",
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
