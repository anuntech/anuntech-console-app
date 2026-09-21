"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Trash2, Smile } from "lucide-react";
import { toast } from "@/components/notifications";
import { PROFILE_AVATARS, isCatalogAvatar } from "@/lib/avatar-catalog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { IllustratedAvatar } from "./illustrated-avatar";
import styles from "./profile-avatar.module.css";

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

export function ProfileAvatar({
  name,
  image,
  children,
}: {
  name: string;
  image: string | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const [change, setChange] = useState<{
    previous: string | null;
    image: string | null;
  } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [pending, setPending] = useState<"upload" | "remove" | "select" | null>(
    null,
  );
  const setFeedback = (feedback: { kind: "success" | "error"; message: string }) => {
    toast[feedback.kind](feedback.message);
  };
  const current = change?.previous === image ? change.image : image;
  const source = profileAvatarSource(current);
  const initials = name
    .trim()
    .split(/\s+/)
    .filter((_, index, parts) => index === 0 || index === parts.length - 1)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");

  async function update(file: File | null, selected?: string) {
    if (lock.current) return;
    if (file && (!file.size || file.size > 2 * 1024 * 1024)) {
      setFeedback({ kind: "error", message: "A foto deve ter até 2 MB." });
      return;
    }
    if (
      file &&
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setFeedback({
        kind: "error",
        message: "Use uma imagem PNG, JPEG ou WebP.",
      });
      return;
    }
    lock.current = true;
    setPending(selected ? "select" : file ? "upload" : "remove");
    try {
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
        setFeedback({
          kind: "error",
          message:
            typeof result?.error === "string"
              ? result.error
              : "Não foi possível alterar a foto. Tente novamente.",
        });
        return;
      }
      setChange({ previous: image, image: result.image ?? null });
      setFailedSource(null);
      setGalleryOpen(false);
      setFeedback({
        kind: "success",
        message: selected
          ? "Avatar atualizado."
          : file
            ? "Foto de perfil atualizada."
            : "Foto removida e avatar atribuído.",
      });
      // The remove button disappears after success; retain a meaningful focus target.
      if (!file) uploadRef.current?.focus();
      router.refresh();
    } catch {
      setFeedback({
        kind: "error",
        message: "Não foi possível alterar a foto. Tente novamente.",
      });
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  return (
    <div className={styles.profile}>
      <button
        ref={uploadRef}
        type="button"
        className={styles.avatar}
        aria-label={
          source ? "Alterar foto de perfil" : "Adicionar foto de perfil"
        }
        aria-disabled={!!pending}
        onClick={() => {
          if (!lock.current) inputRef.current?.click();
        }}
      >
        <span className={styles.portrait} aria-hidden="true">
          {source && isCatalogAvatar(current) ? (
            <IllustratedAvatar image={source} />
          ) : source && source !== failedSource ? (
            <Image
              key={source}
              src={source}
              alt=""
              width={88}
              height={88}
              unoptimized
              onError={() => setFailedSource(source)}
            />
          ) : (
            <span>{initials || "?"}</span>
          )}
        </span>
        <span className={styles.overlay} aria-hidden="true">
          <Camera size={24} />
        </span>
      </button>
      {children && <div className={styles.identity}>{children}</div>}
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
      <div className={styles.actions}>
        <button
          type="button"
          className={`button ghost ${styles.button}`}
          disabled={!!pending}
          onClick={() => setGalleryOpen(true)}
        >
          <Smile size={14} aria-hidden="true" /> Escolher avatar
        </button>
        <button
          type="button"
          className={`button ghost ${styles.button}`}
          disabled={!!pending}
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={14} aria-hidden="true" /> Enviar foto
        </button>
      </div>
      <Dialog
        open={galleryOpen}
        onOpenChange={(open) => {
          if (!lock.current) setGalleryOpen(open);
        }}
      >
        <DialogContent busy={!!pending}>
          <DialogTitle>Escolher avatar</DialogTitle>
          <DialogDescription>
            Selecione uma ilustração para usar no seu perfil.
          </DialogDescription>
          <div className={styles.gallery} aria-label="Avatares disponíveis">
            {PROFILE_AVATARS.map((avatar) => (
              <button
                key={avatar.image}
                type="button"
                className={styles.option}
                aria-label={avatar.label}
                aria-pressed={current === avatar.image}
                disabled={!!pending}
                onClick={() => void update(null, avatar.image)}
              >
                <IllustratedAvatar image={avatar.image} size={72} />
              </button>
            ))}
          </div>
          <p role="status">{pending === "select" ? "Salvando avatar…" : ""}</p>
        </DialogContent>
      </Dialog>
      {source && !isCatalogAvatar(current) && (
        <div className={styles.actions}>
          <button
            type="button"
            className={`button ghost ${styles.button}`}
            aria-disabled={!!pending}
            onClick={() => void update(null)}
          >
            <Trash2 size={14} aria-hidden="true" /> Remover foto
          </button>
        </div>
      )}
      <div role="status" aria-atomic="true" className={styles.progress}>
        {pending && (
          <>
            <progress
              aria-label={
                pending === "select"
                  ? "Salvando avatar"
                  : pending === "upload"
                    ? "Enviando foto"
                    : "Removendo foto"
              }
            />
            <span>
              {pending === "select"
                ? "Salvando avatar…"
                : pending === "upload"
                  ? "Enviando foto…"
                  : "Removendo foto…"}
            </span>
          </>
        )}
      </div>

    </div>
  );
}
