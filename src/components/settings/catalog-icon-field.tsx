"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGridIcon, Loader2Icon, RefreshCwIcon, SparklesIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductIcon } from "@/components/console/product-icon";
import { toast } from "@/components/shell/notifications";
import { optimizeImage } from "@/lib/client-image";
import {
  CATALOG_ICON_GALLERY,
  catalogIconSrc,
  isGalleryIcon,
  suggestGalleryIcon,
} from "@/lib/catalog/catalog-icons";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
/** Before the browser shrinks it to 512 px; the server takes up to 2 MB after that. */
const MAX_PICK_BYTES = 20 * 1024 * 1024;
const MAX_HINT = 200;
const SAVE_ERROR = "Não foi possível alterar o ícone. Tente de novo.";
const AI_ERROR = "Não foi possível gerar agora. Tente de novo ou envie uma imagem.";

type Pending = "upload" | "gallery" | "remove" | "ai";

/** "data:image/webp;base64,..." back to bytes, to send the chosen option. */
function dataUrlBytes(url: string) {
  const binary = atob(url.slice(url.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The "Ícone" field of the catalog editor. An existing item saves each change
 * at once through /api/catalogo/<id>/icone (upload, AI option, gallery,
 * removal). A new item has no id yet: it only stages a gallery icon in the
 * form, and without one the server picks the gallery icon that fits the name.
 */
export function CatalogIconField({
  itemId,
  name,
  initialIcon,
  iconAi,
}: {
  itemId?: string;
  name: string;
  initialIcon: string | null;
  /** Whether "Gerar com IA" is on (OpenRouter configured and ICON_AI not off). */
  iconAi: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const promptId = useId();
  const lock = useRef(false);
  const generation = useRef<AbortController | null>(null);
  const [icon, setIcon] = useState(initialIcon);
  const [pending, setPending] = useState<Pending | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => () => generation.current?.abort(), []);

  const saved = isGalleryIcon(icon) ? icon : catalogIconSrc(itemId, icon);
  // A new item without a pick gets the icon that fits its name when saved: show that one.
  const preview = saved ?? (itemId ? null : (suggestGalleryIcon(name)?.path ?? null));
  const busy = !!pending;

  /** Sends one change and reports it; the lock keeps double clicks from racing. */
  async function run(kind: Pending, send: () => Promise<Response>) {
    if (!itemId || lock.current) return false;
    lock.current = true;
    setPending(kind);
    try {
      const response = await send();
      const result = await response.json().catch(() => null);
      if (!response.ok || !(result?.icon === null || typeof result?.icon === "string")) {
        toast.error(typeof result?.error === "string" ? result.error : SAVE_ERROR);
        return false;
      }
      setIcon(result.icon);
      toast.success(result.icon ? "Ícone atualizado." : "Ícone removido.");
      router.refresh();
      return true;
    } catch (error) {
      // optimizeImage explains itself; a dropped connection does not.
      toast.error(error instanceof Error && error.name === "Error" && error.message ? error.message : SAVE_ERROR);
      return false;
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  const endpoint = `/api/catalogo/${itemId}/icone`;

  function upload(file: File) {
    if (!ACCEPT.includes(file.type)) return void toast.error("Use uma imagem PNG, JPEG ou WebP.");
    if (!file.size || file.size > MAX_PICK_BYTES) return void toast.error("Escolha uma imagem de até 20 MB.");
    void run("upload", async () => {
      const optimized = await optimizeImage(file, 512);
      return fetch(endpoint, { method: "POST", headers: { "Content-Type": optimized.type }, body: optimized });
    });
  }

  async function pick(path: string) {
    if (!itemId || path === icon) {
      setIcon(path);
      setGalleryOpen(false);
      return;
    }
    const ok = await run("gallery", () =>
      fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon: path }),
      }),
    );
    if (ok) setGalleryOpen(false);
  }

  function remove() {
    if (!itemId) return setIcon(null);
    void run("remove", () => fetch(endpoint, { method: "DELETE" }));
  }

  function resetAi() {
    generation.current?.abort();
    generation.current = null;
    setGenerating(false);
    setGenerated(false);
    setOptions([]);
    setChoice(null);
    setAiError("");
    setPrompt("");
  }

  async function generate() {
    if (!itemId || busy) return;
    generation.current?.abort();
    const controller = new AbortController();
    generation.current = controller;
    setGenerating(true);
    setGenerated(true);
    setAiError("");
    setChoice(null);
    setOptions([]);
    try {
      const response = await fetch(`${endpoint}/gerar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint: prompt.trim() }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      const images = Array.isArray(result?.options)
        ? result.options.filter((option: unknown): option is string => typeof option === "string" && option.startsWith("data:image/webp;base64,"))
        : [];
      if (!response.ok || !images.length) {
        setAiError(typeof result?.error === "string" && result.error ? result.error : AI_ERROR);
        return;
      }
      setOptions(images.slice(0, 4));
    } catch {
      if (!controller.signal.aborted) setAiError(AI_ERROR);
    } finally {
      if (generation.current === controller) {
        generation.current = null;
        setGenerating(false);
      }
    }
  }

  async function applyChoice() {
    const option = choice === null ? undefined : options[choice];
    if (!option) return;
    const ok = await run("ai", async () =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "image/webp", "x-icon-source": "ai" },
        body: dataUrlBytes(option),
      }),
    );
    if (ok) {
      setAiOpen(false);
      resetAi();
    }
  }

  return (
    <fieldset className="min-w-0" aria-describedby={hintId}>
      <legend className="mb-1.5 text-sm font-medium text-foreground">Ícone</legend>
      <div className="flex items-center gap-4">
        <ProductIcon key={preview ?? "none"} src={preview} name={name.trim() || "Item"} size={64} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {itemId && (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
                {pending === "upload" ? <Loader2Icon className="motion-safe:animate-spin" /> : <UploadIcon />}
                Enviar imagem
              </Button>
            )}
            {itemId && iconAi && (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setAiOpen(true)}>
                <SparklesIcon />
                Gerar com IA
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setGalleryOpen(true)}>
              <LayoutGridIcon />
              Galeria
            </Button>
            {icon && (
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={remove}>
                {pending === "remove" ? <Loader2Icon className="motion-safe:animate-spin" /> : <Trash2Icon />}
                Remover
              </Button>
            )}
          </div>
          <p id={hintId} className="m-0 text-xs text-muted-foreground">
            {itemId ? "PNG, JPEG ou WebP, quadrada, a partir de 512 px." : "Envie ou gere um ícone depois de salvar o item."}
          </p>
        </div>
      </div>
      {!itemId && <input type="hidden" name="icon" value={isGalleryIcon(icon) ? icon : ""} />}
      {itemId && (
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          hidden
          aria-label="Escolher imagem do ícone"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) upload(file);
          }}
        />
      )}
      <p className="sr-only" role="status" aria-atomic="true">
        {pending === "upload" ? "Enviando ícone…" : pending === "remove" ? "Removendo ícone…" : ""}
      </p>

      <Dialog
        open={galleryOpen}
        onOpenChange={(open) => {
          if (!lock.current) setGalleryOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Galeria de ícones</DialogTitle>
            <DialogDescription>Ícones prontos para produtos e serviços.</DialogDescription>
          </DialogHeader>
          <div role="group" aria-label="Ícones da galeria" className="grid max-h-[60vh] grid-cols-4 gap-1 overflow-y-auto p-1 sm:grid-cols-7">
            {CATALOG_ICON_GALLERY.map((option) => (
              <button
                key={option.slug}
                type="button"
                aria-label={option.label}
                aria-pressed={icon === option.path}
                disabled={busy}
                onClick={() => void pick(option.path)}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                  icon === option.path && "bg-accent ring-2 ring-primary",
                )}
              >
                <ProductIcon src={option.path} name={option.label} size={52} />
                <span aria-hidden="true" className="w-full truncate text-center text-xs text-muted-foreground">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
          <p className="sr-only" role="status">
            {pending === "gallery" ? "Salvando ícone…" : ""}
          </p>
        </DialogContent>
      </Dialog>

      {itemId && iconAi && (
        <Dialog
          open={aiOpen}
          onOpenChange={(open) => {
            if (lock.current) return;
            setAiOpen(open);
            if (!open) resetAi();
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Gerar ícone com IA</DialogTitle>
              <DialogDescription>Quatro opções a partir do nome e da descrição salvos do item.</DialogDescription>
            </DialogHeader>
            <div className="grid min-w-0 gap-4">
              <div className="min-w-0">
                <Label htmlFor={promptId} className="mb-1.5">
                  Descreva o ícone (opcional)
                </Label>
                <Textarea
                  id={promptId}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={MAX_HINT}
                  rows={2}
                  disabled={generating || busy}
                  placeholder={`Ex.: um símbolo simples para ${name.trim() || "o item"}`}
                  className="min-h-16"
                />
              </div>
              {!generated && (
                <Button type="button" className="w-full sm:w-auto sm:justify-self-start" disabled={busy} onClick={() => void generate()}>
                  <SparklesIcon />
                  Gerar 4 opções
                </Button>
              )}
              {(generating || options.length > 0) && (
                <div role="group" aria-label="Opções geradas" aria-busy={generating} className="mx-auto grid w-full max-w-xs grid-cols-2 gap-3">
                  {generating
                    ? Array.from({ length: 4 }, (_, index) => (
                        <div key={index} aria-hidden="true" className="aspect-square rounded-[22%] bg-muted motion-safe:animate-pulse" />
                      ))
                    : options.map((option, index) => (
                        <button
                          key={option}
                          type="button"
                          aria-label={`Opção ${index + 1}`}
                          aria-pressed={choice === index}
                          disabled={busy}
                          onClick={() => setChoice(index)}
                          className={cn(
                            "aspect-square overflow-hidden rounded-[22%] bg-white ring-1 ring-black/5 transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 dark:ring-white/10",
                            choice === index && "ring-[3px] ring-primary dark:ring-primary",
                          )}
                        >
                          <Image src={option} alt="" width={256} height={256} unoptimized className="size-full object-cover" />
                        </button>
                      ))}
                </div>
              )}
              {aiError && (
                <p role="alert" className="m-0 text-sm text-destructive">
                  {aiError}
                </p>
              )}
              <p className="m-0 text-xs text-muted-foreground">
                O nome e a descrição do item vão para um serviço de geração de imagens. As opções não escolhidas são descartadas.
              </p>
              <p className="sr-only" role="status" aria-atomic="true">
                {generating ? "Gerando opções…" : options.length ? `${options.length} opções prontas. Escolha uma.` : ""}
              </p>
            </div>
            <DialogFooter>
              {generated && (
                <Button type="button" variant="ghost" disabled={generating || busy} onClick={() => void generate()}>
                  {generating ? <Loader2Icon className="motion-safe:animate-spin" /> : <RefreshCwIcon />}
                  {generating ? "Gerando…" : "Gerar de novo"}
                </Button>
              )}
              <Button type="button" disabled={choice === null || generating || busy} onClick={() => void applyChoice()}>
                {pending === "ai" && <Loader2Icon className="motion-safe:animate-spin" />}
                Usar este ícone
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </fieldset>
  );
}
