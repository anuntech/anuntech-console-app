import Image from "next/image";
import { PROFILE_AVATARS } from "@/lib/avatar-catalog";
import styles from "./illustrated-avatar.module.css";

/** One crop and color everywhere: picker, account, navigation and members. */
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
      className={styles.frame}
      style={{ backgroundColor: avatar.background }}
    >
      <Image src={image} alt="" width={size} height={size} unoptimized />
    </span>
  );
}
