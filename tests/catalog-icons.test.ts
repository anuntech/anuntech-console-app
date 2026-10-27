import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  CATALOG_ICON_GALLERY,
  catalogIconSrc,
  isGalleryIcon,
  isStoredCatalogIcon,
  suggestGalleryIcon,
} from "../src/lib/catalog/catalog-icons";

const itemId = randomUUID();
const file = randomUUID();
const stored = `catalog-icons/${itemId}/${file}.webp`;

test("A galeria lista arquivos que existem em public/brand/catalog-icons, um por slug", () => {
  assert.equal(CATALOG_ICON_GALLERY.length, 15);
  assert.equal(new Set(CATALOG_ICON_GALLERY.map((icon) => icon.slug)).size, CATALOG_ICON_GALLERY.length);
  for (const icon of CATALOG_ICON_GALLERY) {
    assert.equal(icon.path, `/brand/catalog-icons/${icon.slug}.webp`);
    assert.ok(existsSync(`public${icon.path}`), `${icon.path} existe`);
    assert.ok(icon.label.trim(), `${icon.slug} tem nome`);
    assert.equal(isGalleryIcon(icon.path), true);
  }
  for (const value of [
    null,
    undefined,
    "",
    "/brand/catalog-icons/nao-existe.webp",
    "/brand/catalog-icons/../avatars/avatar-01.svg",
    "brand/catalog-icons/synova.webp",
    "https://example.invalid/brand/catalog-icons/synova.webp",
    "/brand/catalog-icons/synova.webp?x=1",
    stored,
  ])
    assert.equal(isGalleryIcon(value), false, String(value));
});

test("Ícone guardado só vale no formato catalog-icons/<item>/<uuid>.webp e, com o item, só para ele", () => {
  assert.equal(isStoredCatalogIcon(stored), true);
  assert.equal(isStoredCatalogIcon(stored, itemId), true);
  assert.equal(isStoredCatalogIcon(stored, randomUUID()), false);
  for (const value of [
    null,
    undefined,
    42,
    "",
    `/${stored}`,
    `${stored}?v=1`,
    `https://store.private.blob.vercel-storage.com/${stored}`,
    `catalog-icons/${itemId}/../${file}.webp`,
    `catalog-icons/${itemId}/${file}.png`,
    `catalog-icons/${itemId}/${file.toUpperCase()}.webp`,
    `catalog-icons/${itemId}/${"-".repeat(36)}.webp`,
    `catalog-icons//${file}.webp`,
    `profile-avatars/${itemId}/${file}.webp`,
    "/brand/catalog-icons/synova.webp",
  ])
    assert.equal(isStoredCatalogIcon(value), false, String(value));
});

test("O endereço do ícone: galeria como está, guardado pela rota com a versão, o resto não carrega", () => {
  assert.equal(catalogIconSrc(itemId, "/brand/catalog-icons/email.webp"), "/brand/catalog-icons/email.webp");
  assert.equal(catalogIconSrc(itemId, stored), `/api/catalogo/${itemId}/icone?v=${file}`);
  // Another item's file never loads under this item.
  assert.equal(catalogIconSrc(randomUUID(), stored), null);
  for (const icon of [
    null,
    undefined,
    "",
    "https://example.invalid/icon.png",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zy8+",
    "/brand/avatars/avatar-01.svg",
    `catalog-icons/${itemId}/x.webp`,
  ])
    assert.equal(catalogIconSrc(itemId, icon), null, String(icon));
  assert.equal(catalogIconSrc(null, stored), null);
  assert.equal(catalogIconSrc(undefined, "/brand/catalog-icons/email.webp"), null);
});

test("A sugestão pelo nome escolhe o ícone da galeria que combina", () => {
  const cases: [string, string | null][] = [
    ["Synova", "synova"],
    ["E-mail corporativo", "email"],
    ["Servidor de e-mail", "email"],
    ["Máquina virtual", "servidor"],
    ["Infraestrutura em nuvem", "infra"],
    ["Suporte técnico e sustentação de sistemas", "suporte"],
    ["Licença de uso de software (SaaS)", "desenvolvimento"],
    ["Equipe alocada (Squad)", "equipe"],
    ["Registro de domínio", "dominio"],
    ["Banco de horas", "horas"],
    ["Xyzzy", null],
    ["", null],
  ];
  for (const [name, slug] of cases) assert.equal(suggestGalleryIcon(name)?.slug ?? null, slug, name);
  // "WhatsApp" contains "app" but is not an app of its own.
  assert.notEqual(suggestGalleryIcon("Integração com WhatsApp")?.slug, "app");
});
