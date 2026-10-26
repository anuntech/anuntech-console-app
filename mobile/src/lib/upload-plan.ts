import { fileSize } from "./format";

/*
 * The arithmetic of Arquivos' uploads and of the space meter, in the web's
 * words (src/components/bookmarks/r2-upload.ts, bulk-upload.tsx and the
 * SpaceMeter of bookmarks-view.tsx). Pure and dependency-free, so the root
 * tests check it (tests/mobile-upload-plan.test.ts).
 */

/** How many part addresses the app asks for at a time (the Console's PART_URL_BATCH). */
export const PART_URL_BATCH = 100;
/** Tries per part before the upload gives up, as the web. */
export const PART_TRIES = 3;
/** Files sent at the same time, as the web's tray. */
export const PARALLEL_FILES = 2;
/** Above this, a file opens through the system (browser) instead of the app's cache. */
export const LARGE_DOWNLOAD_BYTES = 50 * 1024 * 1024;

/** The part numbers in batches of `size`, in order: [[1..100], [101..200], …]. */
export function partBatches(partCount: number, size = PART_URL_BATCH): number[][] {
  const batches: number[][] = [];
  for (let first = 1; first <= partCount; first += size)
    batches.push(Array.from({ length: Math.min(size, partCount - first + 1) }, (_, i) => first + i));
  return batches;
}

/** Where a part starts in the file and how many bytes it has (the last one is smaller). */
export function partRange(partNumber: number, partSize: number, fileSize: number) {
  const start = (partNumber - 1) * partSize;
  return { start, length: Math.max(0, Math.min(partSize, fileSize - start)) };
}

/** Wait before trying a part again: 1 s, then 2 s. */
export const retryDelay = (attempt: number) => 1000 * attempt;

/** The share sent, 0 to 1. */
export const progressShare = (sent: number, total: number) => Math.min(1, Math.max(0, sent / Math.max(1, total)));

/** "42%", rounded down so 100% means done. */
export const percentLabel = (sent: number, total: number) => `${Math.floor(progressShare(sent, total) * 100)}%`;

/** "3,4 MB de 120,0 MB", as the web's tray. */
export const sentLabel = (sent: number, total: number) => `${fileSize(sent || 1)} de ${fileSize(total)}`;

/** The title a file gets: its name without the extension (the web's titleOf). */
export const fileTitle = (name: string) => (name.replace(/\.[^.]+$/, "") || name).slice(0, 160);

/** Whether a file is better opened through the system than downloaded into the app. */
export const opensOutside = (size: number | null | undefined) => (size ?? 0) > LARGE_DOWNLOAD_BYTES;

/** The meter's heading: "Espaço usado", or "Espaço · Empresa" when there are several (or for the team). */
export const spaceHeading = (name: string | null) => (name ? `Espaço · ${name}` : "Espaço usado");

/** "1,2 GB de 5,0 GB", or "300 MB usados, sem limite" for Anuntech's own space. */
export const spaceLabel = (used: number, quota: number | null) =>
  `${used ? fileSize(used) : "0 KB"} ${quota === null ? "usados, sem limite" : `de ${fileSize(quota)}`}`;

/** The filled share of the bar (0 without a limit). */
export const spaceShare = (used: number, quota: number | null) => (quota ? Math.min(1, used / quota) : 0);

/** Red above 90%, as the web. */
export const spaceAlmostFull = (used: number, quota: number | null) => spaceShare(used, quota) > 0.9;
