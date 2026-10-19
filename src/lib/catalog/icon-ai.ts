import "server-only";
import { gateway, generateImage, NoImageGeneratedError, type Experimental_GeneratedImage } from "ai";
import { gatewayStatus } from "../ai/gateway-errors";
import { gatewayReady } from "../ai/gateway-env";
import { ICON_DEADLINE_MS, retryIcon } from "./icon-rules";
import { reserveHourly } from "../http/hourly-limit";
import { ImageError, normalizeImage } from "../images/normalize-image";

/*
 * "Gerar com IA" in the catalog editor: four icon options from an image model
 * through the AI Gateway, like every AI call of the Console. The prompt is
 * built here from the catalog row (never from a name the browser sends) in the
 * style of the bundled gallery, so a generated icon sits well next to those.
 * It carries no client data (the item's name and description, and the team's
 * art direction), so it goes without the zero-retention filter the other
 * calls use: Recraft, the best of the icon models, has no such provider. The
 * options only travel back to the screen; nothing is stored until someone
 * picks one, and the prompt is never logged: only model, count, time and cost.
 */

export const ICON_OPTIONS = 4;
/** Generations (one click, four options) per person per rolling hour. */
export const ICON_HOURLY_LIMIT = 20;
export const MAX_ICON_HINT = 200;
const MAX_DESCRIPTION = 300;
/** Largest decoded image accepted from the provider. */
const MAX_GENERATED_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);

export const DEFAULT_ICON_MODEL = "recraft/recraft-v4.1-flash";
export const DEFAULT_ICON_FALLBACK = "openai/gpt-image-1-mini";

export class IconAiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "IconAiError";
  }
}

const GENERIC = "Não foi possível gerar agora. Tente de novo ou envie uma imagem.";

/** On when the AI Gateway is configured, unless ICON_AI=off turns it off. */
export function iconAiEnabled(env: Record<string, string | undefined> = process.env) {
  return gatewayReady(env) && env.ICON_AI !== "off";
}

/** The models to try, in order: the fallback is skipped when "off" or the same as the first. */
export function iconModels(env: Record<string, string | undefined> = process.env) {
  const first = env.ICON_MODEL || DEFAULT_ICON_MODEL;
  const second = env.ICON_FALLBACK_MODEL || DEFAULT_ICON_FALLBACK;
  return second === "off" || second === first ? [first] : [first, second];
}

/** One line of plain text: no control characters, no quotes that could close the subject. */
function clean(value: string | null | undefined, max: number) {
  return (value ?? "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/["“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[\s.,;:]+$/, "");
}

/** The house style of the bundled gallery, around what the item is. */
export function catalogIconPrompt(item: { name: string; description?: string | null; hint?: string | null }) {
  const name = clean(item.name, 160);
  const description = clean(item.description, MAX_DESCRIPTION);
  const hint = clean(item.hint, MAX_ICON_HINT);
  const subject = `the product or service "${name}"${description ? ` (${description})` : ""}`;
  return [
    "One app icon artwork, perfect square, full-bleed background filling the canvas edge to edge, no rounded corners, no border, no frame.",
    "Smooth diagonal gradient background in one strong color.",
    `Centered: one bold, simple white glyph representing ${subject}, soft frosted 3D white with a gentle top highlight and a very subtle soft shadow, about 50% of the canvas.`,
    ...(hint ? [`Art direction from the team: ${hint}.`] : []),
    "Minimal, premium, Apple-style app icon. No text, no letters, no numbers, no logos, no watermark.",
  ].join(" ");
}

/** Per-person throttle shared by every instance (HMAC key on console_otp_limits). */
export function reserveIconGeneration(userId: string) {
  return reserveHourly("catalog-icon", userId, ICON_HOURLY_LIMIT);
}

type Attempt = { status: number; images: Buffer[]; cost: number; detail?: string };

/** The type by its first bytes, for images that come without one (normalizeImage checks it again). */
function sniffType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return "";
}

/** Checks and normalizes what came back; anything odd is dropped. */
async function decode(generated: Experimental_GeneratedImage[]) {
  const images: Buffer[] = [];
  for (const item of generated) {
    const bytes = Buffer.from(item.uint8Array);
    if (!bytes.length || bytes.length > MAX_GENERATED_BYTES) continue;
    const type = ACCEPTED.has(item.mediaType?.toLowerCase() ?? "") ? item.mediaType.toLowerCase() : sniffType(bytes);
    if (!ACCEPTED.has(type)) continue;
    try {
      images.push(
        await normalizeImage(bytes, type, {
          size: 256,
          fit: "cover",
          quality: 82,
          maxBytes: MAX_GENERATED_BYTES,
        }),
      );
    } catch (error) {
      if (!(error instanceof ImageError)) throw error;
    }
  }
  return images;
}

/** The status a failed call counts as, for the retry and fallback rules; 0 when the Gateway was not reached. */
function failed(error: unknown): Attempt {
  if (NoImageGeneratedError.isInstance(error)) return { status: 200, images: [], cost: 0, detail: "no image" };
  const { status, detail } = gatewayStatus(error);
  return { status, images: [], cost: 0, detail: detail.slice(0, 160) };
}

async function requestImages(model: string, prompt: string, n: number, signal: AbortSignal): Promise<Attempt> {
  try {
    const result = await generateImage({
      model: gateway.imageModel(model),
      prompt,
      n,
      aspectRatio: "1:1",
      // GPT Image bills by output tokens: medium is plenty for a 256 px icon.
      ...(model.startsWith("openai/gpt-image") ? { providerOptions: { openai: { quality: "medium" } } } : {}),
      // The retry and the fallback below are the policy; the SDK's own would double them.
      maxRetries: 0,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(50_000)]),
    });
    const cost = Number((result.providerMetadata?.gateway as { cost?: unknown } | undefined)?.cost ?? 0);
    return { status: 200, images: await decode(result.images), cost: Number.isFinite(cost) ? cost : 0 };
  } catch (error) {
    // The person closed the dialog: nobody is waiting for the images.
    if (signal.aborted) throw new IconAiError(499, "");
    return failed(error);
  }
}

/** Several single-image calls at once, for models that take n=1 only (or sent fewer than asked). */
async function singles(model: string, prompt: string, count: number, signal: AbortSignal) {
  const results = await Promise.all(Array.from({ length: count }, () => requestImages(model, prompt, 1, signal)));
  return {
    images: results.flatMap((r) => r.images),
    cost: results.reduce((sum, r) => sum + r.cost, 0),
    status: results.find((r) => r.images.length)?.status ?? results[0]?.status ?? 0,
    detail: results.find((r) => r.detail)?.detail,
  };
}

/**
 * Up to four 256 px WebP options for a catalog item. Tries the main model
 * (one retry when it is busy), then the fallback; a key or credit problem
 * stops at once, since the other model would fail the same way.
 */
export async function generateCatalogIcons(
  item: { name: string; description?: string | null; hint?: string | null },
  signal: AbortSignal,
): Promise<Buffer[]> {
  if (!iconAiEnabled())
    throw new IconAiError(503, "A geração de ícones está desligada. Envie uma imagem ou escolha um ícone da galeria.");
  const prompt = catalogIconPrompt(item);
  const models = iconModels();
  const begun = Date.now();
  let lastStatus = 0;
  for (const [index, model] of models.entries()) {
    const started = Date.now();
    let attempt = await requestImages(model, prompt, ICON_OPTIONS, signal);
    let cost = attempt.cost;
    if (retryIcon(attempt.status, Date.now() - started, index === models.length - 1, ICON_DEADLINE_MS - (Date.now() - begun) - 1500)) {
      // Busy models hiccup; one short pause usually clears it.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (signal.aborted) throw new IconAiError(499, "");
      attempt = await requestImages(model, prompt, ICON_OPTIONS, signal);
      cost += attempt.cost;
    }
    let images = attempt.images;
    let status = attempt.status;
    let detail = attempt.detail;
    if (status === 400 || status === 422) {
      // Some providers refuse n > 1: ask for the options one by one.
      const one = await singles(model, prompt, ICON_OPTIONS, signal);
      ({ images, status, detail } = one);
      cost += one.cost;
    } else if (images.length && images.length < ICON_OPTIONS) {
      const more = await singles(model, prompt, ICON_OPTIONS - images.length, signal);
      images = [...images, ...more.images];
      cost += more.cost;
    }
    if (images.length) {
      console.info("[icon-ai]", { model, count: images.length, ms: Date.now() - started, cost, fallback: index > 0 });
      return images.slice(0, ICON_OPTIONS);
    }
    lastStatus = status;
    console.warn("[icon-ai] Gateway refused", { model, status, detail: detail ?? "no usable image", ms: Date.now() - started });
    if (status === 401) throw new IconAiError(503, "O AI Gateway recusou o acesso do Console. Confira a credencial do projeto na Vercel.");
    if (status === 403)
      throw new IconAiError(503, "O AI Gateway não liberou a geração de imagens para esta conta. Confira os créditos no painel da Vercel.");
    if (status === 402)
      throw new IconAiError(503, "A conta do AI Gateway está sem créditos. Adicione créditos no painel da Vercel, em AI Gateway, para gerar ícones.");
    if (signal.aborted) throw new IconAiError(499, "");
  }
  if (lastStatus === 429)
    throw new IconAiError(429, "O serviço de imagens está no limite de uso agora. Tente de novo em instantes ou envie uma imagem.");
  throw new IconAiError(502, GENERIC);
}
