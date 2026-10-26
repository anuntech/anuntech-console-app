import { useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { ORPCError } from "@orpc/client";
import { fetch as binaryFetch } from "expo/fetch";
import { File, FileMode, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
import { BookmarkFileError, MAX_FILE_BYTES, cameraAllowed, refreshBookmarks, uploadBookmarkFile } from "./bookmarks";
import { haptic } from "./haptics";
import { PARALLEL_FILES, PART_TRIES, fileTitle, partBatches, partRange, retryDelay } from "./upload-plan";
import { documentPicker, type PickedFile } from "./uploads";

/*
 * Arquivos from the phone, the web's way (src/components/bookmarks/r2-upload.ts
 * and bulk-upload.tsx): the Console starts the upload and signs each part
 * (files.*), the app reads the file 16 MB at a time and PUTs each part
 * straight to R2, the Console finishes it, and bookmarks.create names the
 * finished upload. Two files at a time, in a queue that outlives the screen
 * (the list shows it). The app's own process does the sending: when the
 * phone puts it in the background the upload may stop, and the person
 * sends it again (the Console lets the abandoned one expire).
 */

export type UploadTarget = { companyId: string; folderId: string };

export type UploadItem = PickedFile & {
  key: string;
  title: string;
  target: UploadTarget;
  /** Bytes already in R2. */
  sent: number;
  state: "waiting" | "sending" | "saving" | "done" | "error" | "cancelled";
  error?: string;
  /** The app left the screen while it was going. */
  interrupted?: boolean;
};

/** A refusal worth showing as is. */
class UploadProblem extends Error {}

/** Part addresses asked for at a time: few, so none expires (they last an hour) on a slow connection. */
const PHONE_BATCH = 5;
/** At most this many files per pick, as a sane batch. */
const MAX_PICK = 20;
const FAILED = "Não foi possível enviar o arquivo. Confira a internet e tente de novo.";
const INTERRUPTED = "O envio parou porque o app saiu da tela. Toque em Enviar de novo.";

/* ---------- Picking ---------- */

const today = () => new Date().toISOString().slice(0, 10);
const extensionOf = (uri: string) => /\.([a-z0-9]{1,5})(?:\?|$)/i.exec(uri)?.[1]?.toLowerCase();
const sizeOf = (uri: string, given?: number | null) => {
  if (given) return given;
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
};

/**
 * Files of any kind and size for Arquivos, as they are (no reduction): from
 * the Files app (builds with the document picker), photos and videos from the
 * gallery, or a photo from the camera. An empty list when the person gave up.
 */
export async function pickArquivos(source: "files" | "library" | "camera"): Promise<PickedFile[]> {
  if (source === "files") {
    if (!documentPicker) return [];
    let result;
    try {
      result = await documentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    } catch {
      throw new BookmarkFileError("Não foi possível abrir os arquivos. Tente novamente.");
    }
    if (result.canceled) return [];
    return result.assets.slice(0, MAX_PICK).map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      mime: asset.mimeType || "application/octet-stream",
      size: sizeOf(asset.uri, asset.size),
    }));
  }
  let result: ImagePicker.ImagePickerResult;
  try {
    if (source === "camera") {
      if (!(await cameraAllowed())) return [];
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    } else {
      // The library needs no permission: only what the person picks reaches the app.
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: MAX_PICK,
        orderedSelection: true,
      });
    }
  } catch {
    throw new BookmarkFileError(source === "camera" ? "Não foi possível abrir a câmera. Escolha uma foto da galeria." : "Não foi possível abrir a galeria. Tente novamente.");
  }
  if (result.canceled) return [];
  return result.assets.slice(0, MAX_PICK).map((asset, index) => {
    const video = asset.type === "video";
    const extension = extensionOf(asset.fileName ?? asset.uri) ?? (video ? "mp4" : "jpg");
    const fallback = `${video ? "Vídeo" : "Foto"} ${today()}${result.assets.length > 1 ? ` ${index + 1}` : ""}.${extension}`;
    return {
      uri: asset.uri,
      name: asset.fileName || fallback,
      mime: asset.mimeType || (video ? "video/mp4" : "image/jpeg"),
      size: sizeOf(asset.uri, asset.fileSize),
    };
  });
}

/* ---------- Sending one file ---------- */

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

/** One part to its signed address; R2 answers with the part's ETag. */
async function putPart(url: string, bytes: Uint8Array<ArrayBuffer>, signal: AbortSignal) {
  const response = await binaryFetch(url, { method: "PUT", body: bytes, signal });
  const etag = response.headers.get("etag");
  if (!response.ok || !etag) throw new Error(`Parte recusada (${response.status}).`);
  return etag;
}

/**
 * Sends a file to R2 and returns the finished upload's id. Reads one part at
 * a time from disk (never the whole file), tries each part up to three
 * times (with a fresh address after a failure) and, on any failure, lets
 * the upload go on the Console.
 */
export async function sendToR2(file: PickedFile, target: UploadTarget, onSent: (bytes: number) => void, signal: AbortSignal) {
  const { id, partSize, partCount } = await api.files.startUpload(
    { companyId: target.companyId, folderId: target.folderId, fileName: file.name, size: file.size, mime: file.mime },
    { signal },
  );
  let handle: ReturnType<File["open"]> | null = null;
  try {
    try {
      handle = new File(file.uri).open(FileMode.ReadOnly);
    } catch {
      throw new UploadProblem("Não foi possível ler o arquivo. Selecione de novo.");
    }
    const parts: { partNumber: number; etag: string }[] = [];
    let sent = 0;
    for (const batch of partBatches(partCount, PHONE_BATCH)) {
      const signed = await api.files.signParts({ id, parts: batch }, { signal });
      for (const { partNumber, url } of signed.parts) {
        const { start, length } = partRange(partNumber, partSize, file.size);
        handle.offset = start;
        const bytes = await handle.readBytes(length);
        if (bytes.byteLength !== length) throw new UploadProblem("O arquivo mudou durante o envio. Selecione de novo.");
        let address = url;
        for (let attempt = 1; ; attempt++) {
          try {
            parts.push({ partNumber, etag: await putPart(address, bytes, signal) });
            break;
          } catch (error) {
            if (signal.aborted || attempt >= PART_TRIES) throw error;
            await wait(retryDelay(attempt), signal);
            address = (await api.files.signParts({ id, parts: [partNumber] }, { signal })).parts[0]?.url ?? address;
          }
        }
        sent += length;
        onSent(sent);
      }
    }
    await api.files.finishUpload({ id, parts }, { signal });
    return id;
  } catch (error) {
    // The parts already in R2 are let go; nothing counts against the space.
    void api.files.cancelUpload({ id }).catch(() => undefined);
    throw error;
  } finally {
    handle?.close();
  }
}

/** What the person reads when a file did not go: the Console's words when it refused, or why it stopped. */
function reason(error: unknown, interrupted: boolean) {
  if (error instanceof UploadProblem || error instanceof BookmarkFileError) return error.message;
  if (error instanceof ORPCError && error.status !== 500 && error.message) return error.message;
  return interrupted ? INTERRUPTED : FAILED;
}

/* ---------- The queue ---------- */

let items: UploadItem[] = [];
const listeners = new Set<() => void>();
const controllers = new Map<string, AbortController>();
let running = 0;
let counter = 0;

function commit(next: UploadItem[]) {
  items = next;
  for (const listener of listeners) listener();
}
const patch = (key: string, change: Partial<UploadItem>) => commit(items.map((item) => (item.key === key ? { ...item, ...change } : item)));
const current = (key: string) => items.find((item) => item.key === key);
const busy = (item: UploadItem) => item.state === "waiting" || item.state === "sending" || item.state === "saving";

// iOS stops an app's network a while after it leaves the screen: what was going is marked, so a failure says why.
AppState.addEventListener("change", (state) => {
  if (state === "background" && items.some((item) => item.state === "sending"))
    commit(items.map((item) => (item.state === "sending" ? { ...item, interrupted: true } : item)));
});

/** The picker's copy in the app's cache goes away once the file is in Arquivos. */
function dropCachedCopy(uri: string) {
  try {
    if (uri.startsWith(Paths.cache.uri)) new File(uri).delete();
  } catch {
    // The system clears the cache anyway.
  }
}

async function run(key: string) {
  const item = current(key)!;
  const controller = new AbortController();
  controllers.set(key, controller);
  try {
    let uploadId: string;
    try {
      uploadId = await sendToR2(item, item.target, (sent) => patch(key, { sent }), controller.signal);
    } catch (error) {
      // R2 switched off since the list loaded: a file that fits goes the 1 MB way, as before.
      if (error instanceof ORPCError && error.status === 503 && item.size <= MAX_FILE_BYTES) {
        patch(key, { state: "saving" });
        await uploadBookmarkFile(item, { title: item.title, ...item.target });
        return finished(key);
      }
      throw error;
    }
    // From here the bookmark is being saved: no cancelling half way.
    controllers.delete(key);
    patch(key, { state: "saving", sent: item.size });
    try {
      await api.bookmarks.create({ ...item.target, title: item.title, url: "", kind: "file", uploadId });
    } catch (error) {
      // Not saved: the file leaves R2 instead of holding the space until it expires.
      void api.files.cancelUpload({ id: uploadId }).catch(() => undefined);
      throw error;
    }
    finished(key);
  } catch (error) {
    const latest = current(key);
    if (controller.signal.aborted) patch(key, { state: "cancelled", error: "Cancelado." });
    else {
      haptic.error();
      patch(key, { state: "error", error: reason(error, !!latest?.interrupted) });
    }
  } finally {
    controllers.delete(key);
  }
}

function finished(key: string) {
  const item = current(key);
  patch(key, { state: "done", sent: item?.size ?? 0, error: undefined });
  if (item) {
    dropCachedCopy(item.uri);
    AccessibilityInfo.announceForAccessibility(`${item.name} enviado`);
  }
  if (!items.some(busy)) haptic.success();
  void refreshBookmarks();
}

function pump() {
  while (running < PARALLEL_FILES) {
    const next = items.find((item) => item.state === "waiting");
    if (!next) return;
    running++;
    patch(next.key, { state: "sending", sent: 0, error: undefined, interrupted: false });
    void run(next.key).finally(() => {
      running--;
      pump();
    });
  }
}

/**
 * Sends files to a company (and folder), each becoming a file bookmark. One
 * file takes `title` when given; otherwise each its name without the extension.
 */
export function enqueueUploads(files: PickedFile[], target: UploadTarget, title?: string) {
  const added = files.map(
    (file): UploadItem => ({
      ...file,
      key: `arquivo-${++counter}`,
      title: (files.length === 1 && title?.trim()) || fileTitle(file.name),
      target,
      sent: 0,
      state: "waiting",
    }),
  );
  commit([...items.filter((item) => item.state !== "done"), ...added]);
  pump();
}

/** Stops one file (a waiting one never starts); the parts already sent leave R2. */
export function cancelUpload(key: string) {
  const item = current(key);
  if (!item) return;
  if (item.state === "waiting") return patch(key, { state: "cancelled", error: "Cancelado." });
  controllers.get(key)?.abort();
}

/** Every file still going stops. */
export function cancelAllUploads() {
  for (const item of items) if (item.state === "waiting" || item.state === "sending") cancelUpload(item.key);
}

/** "Enviar de novo": from the start, as a new upload. */
export function retryUpload(key: string) {
  patch(key, { state: "waiting", sent: 0, error: undefined, interrupted: false });
  pump();
}

/** Clears what is over (sent, failed, cancelled) from the tray. */
export function clearUploads() {
  commit(items.filter(busy));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
/** The files on their way (and the ones that just arrived or failed), for the tray. */
export const useUploads = () => useSyncExternalStore(subscribe, () => items);
export const isBusy = busy;
