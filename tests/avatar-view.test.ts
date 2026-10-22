import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { PROFILE_AVATARS } from "../src/lib/account/avatar-catalog";
import { avatarView, catalogAvatars } from "../src/lib/account/avatar-view";

const photoOf = (userId: string, file = `${randomUUID()}.webp`) => ({
  file,
  image: `profile-avatars/${createHash("sha256").update(userId).digest("hex")}/${file}`,
});

test("an illustration of the catalog keeps its path and background", () => {
  const avatar = PROFILE_AVATARS[6];
  assert.deepEqual(avatarView(avatar.image), { kind: "illustration", path: avatar.image, color: avatar.background });
  assert.deepEqual(avatarView(avatar.image, "someone"), {
    kind: "illustration",
    path: avatar.image,
    color: avatar.background,
  });
});

test("the person's own photo goes through /api/conta/foto, never the Blob pathname", () => {
  const { file, image } = photoOf("me");
  assert.deepEqual(avatarView(image), { kind: "photo", path: `/api/conta/foto?v=${file}`, color: null });
});

test("another person's photo goes through /api/pessoas/<id>/foto only when it is theirs", () => {
  const { file, image } = photoOf("person-1");
  assert.deepEqual(avatarView(image, "person-1"), {
    kind: "photo",
    path: `/api/pessoas/person-1/foto?v=${file}`,
    color: null,
  });
  assert.deepEqual(avatarView(image, "person-2"), { kind: "initials", path: null, color: null });
});

test("anything else is initials", () => {
  const initials = { kind: "initials", path: null, color: null };
  for (const image of [
    null,
    undefined,
    "",
    "/brand/avatars/avatar-90.svg",
    "/brand/avatars/../x.svg",
    "https://example.invalid/a.png",
    `${photoOf("me").image}?x=1`,
    `profile-avatars/${"a".repeat(64)}/${randomUUID()}.svg`,
  ])
    assert.deepEqual(avatarView(image), initials);
});

test("the catalog the app picks from is the web's, with the same colors", () => {
  const list = catalogAvatars();
  assert.equal(list.length, PROFILE_AVATARS.length);
  assert.deepEqual(list[0], {
    image: PROFILE_AVATARS[0].image,
    path: PROFILE_AVATARS[0].image,
    color: PROFILE_AVATARS[0].background,
  });
});
