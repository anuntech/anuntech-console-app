import Image from "next/image";
import { PROFILE_AVATARS, isCatalogAvatar } from "@/lib/account/avatar-catalog";

/** One crop and colour everywhere: picker, account, navigation and members. */
export function IllustratedAvatar({
  image,
  size = 88,
}: {
  image: string;
  size?: number;
}) {
  const avatar = PROFILE_AVATARS.find((avatar) => avatar.image === image);
  if (!avatar) return null;
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full"
      style={{ backgroundColor: avatar.background, width: size, height: size }}
    >
      <Image
        src={image}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="absolute inset-0 size-full max-w-none origin-[50%_30%] scale-[1.75] object-cover"
      />
    </span>
  );
}

/** The private proxy always resolves the current user's photo on the server. */
export function profileAvatarSource(image: string | null | undefined) {
  if (isCatalogAvatar(image)) return image;
  if (
    !image ||
    !/^profile-avatars\/[a-f0-9]{64}\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(
      image,
    )
  )
    return null;
  return `/api/conta/foto?v=${image.slice(image.lastIndexOf("/") + 1)}`;
}
