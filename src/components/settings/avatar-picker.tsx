"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, Loader2Icon, SmileIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/notifications";
import { optimizeImage } from "@/lib/client-image";
import { PROFILE_AVATARS, isCatalogAvatar } from "@/lib/avatar-catalog";
import { initials } from "@/lib/format";
import { IllustratedAvatar, profileAvatarSource } from "./illustrated-avatar";

/** The profile picture: a photo, one of the illustrations, or initials. */
export function AvatarPicker({
  name,
  image,
}: {
  name: string;
  image: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [change, setChange] = useState<{
    previous: string | null;
    image: string | null;
  } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [pending, setPending] = useState<"upload" | "remove" | "select" | null>(
    null,
  );
  const current = change?.previous === image ? change.image : image;
  const source = profileAvatarSource(current);
  const photo = !!source && !isCatalogAvatar(current) && source !== failedSource;

  async function update(file: File | null, selected?: string) {
    if (lock.current) return;
    if (file && (!file.size || file.size > 20 * 1024 * 1024)) {
      toast.error("A foto deve ter até 20 MB.");
      return;
    }
    if (file && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Use uma imagem PNG, JPEG ou WebP.");
      return;
    }
    lock.current = true;
    setPending(selected ? "select" : file ? "upload" : "remove");
    try {
      if (file) file = await optimizeImage(file, 512);
      const response = await fetch("/api/conta/foto", {
        method: selected ? "PATCH" : file ? "POST" : "DELETE",
        ...(selected
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image: selected }),
            }
          : {}),
        ...(file ? { headers: { "Content-Type": file.type }, body: file } : {}),
      });
      const result = await response.json().catch(() => null);
      if (
        !response.ok ||
        !(result?.image === null || typeof result?.image === "string")
      ) {
        toast.error(
          typeof result?.error === "string"
            ? result.error
            : "Não foi possível alterar a foto. Tente novamente.",
        );
        return;
      }
      setChange({ previous: image, image: result.image ?? null });
      setFailedSource(null);
      setGalleryOpen(false);
      toast.success(
        selected
          ? "Avatar atualizado."
          : file
            ? "Foto de perfil atualizada."
            : "Foto removida.",
      );
      router.refresh();
    } catch {
      toast.error("Não foi possível alterar a foto. Tente novamente.");
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <span
        aria-hidden="true"
        className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-xl font-semibold text-primary"
      >
        {source && isCatalogAvatar(current) ? (
          <IllustratedAvatar image={source} size={80} />
        ) : photo ? (
          <Image
            key={source}
            src={source}
            alt=""
            width={80}
            height={80}
            unoptimized
            className="size-full object-cover"
            onError={() => setFailedSource(source)}
          />
        ) : (
          initials(name)
        )}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending === "upload" ? <Loader2Icon className="animate-spin" /> : <CameraIcon />}
          Enviar foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!pending}
          onClick={() => setGalleryOpen(true)}
        >
          <SmileIcon />
          Escolher avatar
        </Button>
        {photo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={!!pending}
            onClick={() => void update(null)}
          >
            {pending === "remove" ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            Remover foto
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        aria-label="Escolher foto de perfil"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void update(file);
        }}
      />
      <Dialog
        open={galleryOpen}
        onOpenChange={(open) => {
          if (!lock.current) setGalleryOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Escolher avatar</DialogTitle>
            <DialogDescription>
              Uma ilustração para o seu perfil.
            </DialogDescription>
          </DialogHeader>
          <div
            className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-6 md:grid-cols-8"
            aria-label="Avatares disponíveis"
          >
            {PROFILE_AVATARS.map((avatar) => (
              <button
                key={avatar.image}
                type="button"
                aria-label={avatar.label}
                aria-pressed={current === avatar.image}
                disabled={!!pending}
                onClick={() => void update(null, avatar.image)}
                className={cn(
                  "flex items-center justify-center rounded-full p-0.5 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                  current === avatar.image && "ring-2 ring-primary",
                )}
              >
                <IllustratedAvatar image={avatar.image} size={56} />
              </button>
            ))}
          </div>
          <p className="sr-only" role="status">
            {pending === "select" ? "Salvando avatar…" : ""}
          </p>
        </DialogContent>
      </Dialog>
      <p className="sr-only" role="status" aria-atomic="true">
        {pending === "upload"
          ? "Enviando foto…"
          : pending === "remove"
            ? "Removendo foto…"
            : ""}
      </p>
    </div>
  );
}
