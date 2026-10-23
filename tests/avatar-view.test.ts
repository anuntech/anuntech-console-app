import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { PROFILE_AVATARS, isCatalogAvatar, isPickableAvatar } from "../src/lib/account/avatar-catalog";
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

test("the catalog is the brand's 48 avatars, each with its own file", () => {
  assert.equal(PROFILE_AVATARS.length, 48);
  assert.equal(new Set(PROFILE_AVATARS.map((avatar) => avatar.image)).size, 48);
  for (const avatar of PROFILE_AVATARS) assert.match(avatar.image, /^\/brand\/avatars\/marca-\d{2}\.(svg|png)$/);
});

test("a retired illustration draws a brand avatar, always the same one, and cannot be picked again", () => {
  const stand = PROFILE_AVATARS[6];
  for (const userId of [undefined, "someone"])
    assert.deepEqual(avatarView("/brand/avatars/avatar-07.svg", userId), {
      kind: "illustration",
      path: stand.image,
      color: stand.background,
    });
  assert.equal(avatarView("/brand/avatars/avatar-89.svg").path, PROFILE_AVATARS[88 % 48].image);
  assert.equal(isCatalogAvatar("/brand/avatars/avatar-07.svg"), true);
  assert.equal(isPickableAvatar("/brand/avatars/avatar-07.svg"), false);
  assert.equal(isPickableAvatar(stand.image), true);
  for (const image of ["/brand/avatars/avatar-00.svg", "/brand/avatars/avatar-90.svg", "/brand/avatars/avatar-7.svg"])
    assert.equal(isCatalogAvatar(image), false);
});
