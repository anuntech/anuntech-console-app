import "server-only";
import { randomInt } from "node:crypto";
import { PROFILE_AVATARS } from "./avatar-catalog";

export function randomProfileAvatar() {
  return PROFILE_AVATARS[randomInt(PROFILE_AVATARS.length)].image;
}
