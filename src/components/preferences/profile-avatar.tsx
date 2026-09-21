"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { Notification } from "@/components/notifications";
import styles from "./profile-avatar.module.css";

/** The private proxy always resolves the current user's photo on the server. */
export function profileAvatarSource(image: string | null | undefined) {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const id = useId();
  const [change, setChange] = useState<{
    previous: string | null;
    image: string | null;
  } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const current = change?.previous === image ? change.image : image;
  const source = profileAvatarSource(current);
  const initials = name
    .trim()
    .split(/\s+/)
    .filter((_, index, parts) => index === 0 || index === parts.length - 1)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");

  async function update(file: File | null) {
    if (lock.current) return;
    setFeedback(null);
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
    setPending(file ? "upload" : "remove");
    try {
      const response = await fetch("/api/conta/foto", {
        method: file ? "POST" : "DELETE",
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
      setFeedback({
        kind: "success",
        message: file
          ? "Foto de perfil atualizada."
          : "Foto de perfil removida.",
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
        aria-describedby={`${id}-hint${feedback?.kind === "error" ? ` ${id}-feedback` : ""}`}
        onClick={() => {
          if (!lock.current) inputRef.current?.click();
        }}
      >
        <span className={styles.portrait} aria-hidden="true">
          {source && source !== failedSource ? (
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
      {source && (
        <div className={styles.actions}>
          <button
            type="button"
            className={`button ghost ${styles.button}`}
            aria-disabled={!!pending}
            aria-describedby={
              feedback?.kind === "error" ? `${id}-feedback` : undefined
            }
            onClick={() => void update(null)}
          >
            <Trash2 size={14} aria-hidden="true" /> Remover foto
          </button>
        </div>
      )}
      <p id={`${id}-hint`} className={styles.hint}>
        PNG, JPEG ou WebP. Até 2 MB.
      </p>
      <div role="status" aria-atomic="true" className={styles.progress}>
        {pending && (
          <>
            <progress
              aria-label={
                pending === "upload" ? "Enviando foto" : "Removendo foto"
              }
            />
            <span>
              {pending === "upload" ? "Enviando foto…" : "Removendo foto…"}
            </span>
          </>
        )}
      </div>
      {feedback && (
        <Notification
          id={`${id}-feedback`}
          kind={feedback.kind}
          message={feedback.message}
        />
      )}
    </div>
  );
}
