"use client";
import Image from "next/image";
import { useState } from "react";
import { cn } from "cn";
import { isCatalogAvatar } from "@/lib/avatar-catalog";
import { initials } from "@/lib/format";
import { IllustratedAvatar } from "@/components/settings/illustrated-avatar";

export type PersonLike = { id?: string; name: string; image?: string | null };

const PHOTO = /^profile-avatars\/[a-f0-9]{64}\/[a-f0-9-]{36}\.webp$/;

/**
 * One face everywhere: the illustrated avatar, the uploaded photo (served
 * through /api/pessoas/{id}/foto for people who share a company) or the
 * initials. `tone="staff"` colours the initials for the Anuntech team.
 */
export function PersonAvatar({
  person,
  size = 24,
  tone = "default",
  className,
}: {
  person: PersonLike;
  size?: number;
  tone?: "default" | "staff";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const image = person.image ?? null;
  if (image && isCatalogAvatar(image))
    return (
      <span className={cn("shrink-0", className)} title={person.name}>
        <IllustratedAvatar image={image} size={size} />
      </span>
    );
  const photo =
    image && person.id && PHOTO.test(image) && !failed
      ? `/api/pessoas/${person.id}/foto?v=${image.slice(image.lastIndexOf("/") + 1)}`
      : null;
  return (
    <span
      title={person.name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none",
        tone === "staff" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
        className,
      )}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(person.name)
      )}
    </span>
  );
}

/** A few overlapping faces, then "+n". */
export function AvatarStack({
  people,
  size = 24,
  max = 3,
  className,
}: {
  people: PersonLike[];
  size?: number;
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cn("flex items-center", className)} aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((person, index) => (
        <PersonAvatar
          key={person.id ?? person.name}
          person={person}
          size={size}
          className={cn("ring-2 ring-card", index > 0 && "-ml-1.5")}
        />
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
          className="-ml-1.5 flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground ring-2 ring-card"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
