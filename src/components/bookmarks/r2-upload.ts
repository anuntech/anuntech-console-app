"use client";
import { PART_URL_BATCH } from "@/lib/drive/drive-rules";

/*
 * Sends a file to R2 the way Arquivos keeps it (lib/drive/uploads.ts): the
 * Console starts the upload and signs each part; the browser PUTs the parts
 * straight to the bucket, a few at a time, and asks the Console to finish.
 * Returns the upload's id, which the bookmark form then names.
 */

export type UploadTarget = { companyId: string; folderId: string };
export type UploadProgress = { sent: number; total: number };

const PARALLEL = 4;
const RETRIES = 3;

async function api<T>(path: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Não foi possível enviar o arquivo. Tente de novo.");
  return data as T;
}

/** One part, with its upload progress (fetch has none) and the ETag R2 gives back. */
function putPart(url: string, blob: Blob, onBytes: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => onBytes(event.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader("ETag");
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
      else reject(new Error(`Parte recusada (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("A conexão caiu durante o envio."));
    xhr.onabort = () => reject(new DOMException("Envio cancelado.", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

export async function uploadToR2(file: File, target: UploadTarget, onProgress: (progress: UploadProgress) => void, signal: AbortSignal) {
  const started = await api<{ id: string; partSize: number; partCount: number }>(
    "/api/arquivos/envios",
    "POST",
    { companyId: target.companyId, folderId: target.folderId, fileName: file.name, size: file.size, mime: file.type },
    signal,
  );
  const { id, partSize, partCount } = started;
  const sentByPart = new Map<number, number>();
  const report = () => onProgress({ sent: [...sentByPart.values()].reduce((a, b) => a + b, 0), total: file.size });
  const etags: { partNumber: number; etag: string }[] = [];
  try {
    for (let first = 1; first <= partCount; first += PART_URL_BATCH) {
      const numbers = Array.from({ length: Math.min(PART_URL_BATCH, partCount - first + 1) }, (_, i) => first + i);
      const urls = await api<{ partNumber: number; url: string }[]>(`/api/arquivos/envios/${id}/partes`, "POST", { parts: numbers }, signal);
      const queue = [...urls];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { partNumber, url } = next;
          const blob = file.slice((partNumber - 1) * partSize, Math.min(file.size, partNumber * partSize));
          for (let attempt = 1; ; attempt++) {
            try {
              const etag = await putPart(url, blob, (loaded) => ((sentByPart.set(partNumber, loaded), report())), signal);
              sentByPart.set(partNumber, blob.size);
              report();
              etags.push({ partNumber, etag });
              break;
            } catch (error) {
              sentByPart.set(partNumber, 0);
              if (signal.aborted || attempt >= RETRIES) throw error;
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, urls.length) }, worker));
    }
    await api(`/api/arquivos/envios/${id}/concluir`, "POST", { parts: etags }, signal);
    return id;
  } catch (error) {
    // The parts already in R2 are let go; nothing counts against the space.
    void fetch(`/api/arquivos/envios/${id}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}
