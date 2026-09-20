// Run with: node --conditions=react-server --import tsx --test tests/profile-avatar.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  MAX_AVATAR_BYTES,
  ProfileAvatarError,
  isOwnedProfileAvatar,
  normalizeProfileAvatar,
  readAvatarBytes,
} from "../src/lib/profile-avatar";

const input = () =>
  sharp({
    create: { width: 800, height: 600, channels: 3, background: "#1a428a" },
  });
const rejectsWith = (status: number) => (error: unknown) =>
  error instanceof ProfileAvatarError && error.status === status;

test("PNG, JPEG e WebP são decodificados e normalizados para um avatar WebP de 512px", async () => {
  for (const [format, mime] of [
    ["png", "image/png"],
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
  ] as const) {
    const source = await input().toFormat(format).toBuffer();
    const output = await normalizeProfileAvatar(source, mime);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    assert.ok(output.byteLength <= MAX_AVATAR_BYTES);
    assert.ok((await sharp(output).raw().toBuffer()).length > 0);
  }
});

test("A normalização aplica orientação e remove EXIF e ICC do arquivo final", async () => {
  const source = await input()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: {
        Artist: "Fixture privada",
        Copyright: "Dado que deve ser removido",
      },
    })
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(source).metadata()).exif);
  const metadata = await sharp(
    await normalizeProfileAvatar(source, "image/jpeg"),
  ).metadata();
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(metadata.xmp, undefined);
});

test("SVG, formatos divergentes, arquivos corrompidos e nomes herdados não passam pela validação", async () => {
  const png = await input().png().toBuffer();
  await assert.rejects(
    normalizeProfileAvatar(
      Buffer.from('<svg onload="alert(1)"/>'),
      "image/svg+xml",
    ),
    rejectsWith(415),
  );
  await assert.rejects(
    normalizeProfileAvatar(
      Buffer.from('<svg onload="alert(1)"/>'),
      "image/png",
    ),
    rejectsWith(422),
  );
  await assert.rejects(
    normalizeProfileAvatar(png, "image/jpeg"),
    rejectsWith(422),
  );
  await assert.rejects(
    normalizeProfileAvatar(png.subarray(0, 24), "image/png"),
    rejectsWith(422),
  );
  await assert.rejects(
    normalizeProfileAvatar(png, "constructor"),
    rejectsWith(415),
  );
  await assert.rejects(
    normalizeProfileAvatar(Buffer.alloc(MAX_AVATAR_BYTES + 1), "image/png"),
    rejectsWith(413),
  );
});

test("Limites de lado e quantidade de pixels são aplicados antes de processar a imagem", async () => {
  const long = await sharp({
    create: { width: 8193, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    normalizeProfileAvatar(long, "image/png"),
    rejectsWith(422),
  );
  const big = await sharp({
    create: { width: 4097, height: 4097, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  assert.ok(big.length < MAX_AVATAR_BYTES);
  await assert.rejects(
    normalizeProfileAvatar(big, "image/png"),
    rejectsWith(422),
  );
});

test("WebP animado é recusado mesmo quando apenas o primeiro frame seria decodificado", async () => {
  const bytes = Buffer.concat([
    Buffer.alloc(32 * 32 * 3, 0),
    Buffer.alloc(32 * 32 * 3, 255),
  ]);
  const animated = await sharp(bytes, {
    raw: { width: 32, height: 64, channels: 3, pageHeight: 32 },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  await assert.rejects(
    normalizeProfileAvatar(animated, "image/webp"),
    rejectsWith(422),
  );
});

test("Leitura em fluxo aceita o limite e interrompe streams maiores mesmo sem Content-Length", async () => {
  const chunk = new Uint8Array(64 * 1024);
  let chunks = 0;
  const valid = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunks++ === 32) controller.close();
      else controller.enqueue(chunk);
    },
  });
  assert.equal((await readAvatarBytes(valid)).length, MAX_AVATAR_BYTES);
  let cancelled = false;
  const overflow = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readAvatarBytes(overflow), rejectsWith(413));
  assert.equal(cancelled, true);
  assert.equal(overflow.locked, false);
  await assert.rejects(readAvatarBytes(null), rejectsWith(400));
  await assert.rejects(
    readAvatarBytes(
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    ),
    rejectsWith(400),
  );
});

test("Pathnames são exclusivos da conta e recusam URLs, travessia e identificadores fora do formato", () => {
  const userId = "avatar-test-user";
  const prefix = `profile-avatars/${createHash("sha256").update(userId).digest("hex")}/`;
  const path = `${prefix}${randomUUID()}.webp`;
  assert.equal(isOwnedProfileAvatar(path, userId), true);
  assert.equal(isOwnedProfileAvatar(path, "another-user"), false);
  for (const image of [
    null,
    undefined,
    "",
    `https://example.invalid/${path}`,
    `${prefix}../x.webp`,
    `${path}?x=1`,
    `${prefix}${randomUUID()}.svg`,
    `other/${path}`,
  ])
    assert.equal(isOwnedProfileAvatar(image, userId), false);
});
