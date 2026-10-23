import { useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useQuery, type InfiniteData } from "@tanstack/react-query";
import { api, queryClient, sessionHeaders } from "./api";
import { CONSOLE_URL } from "./config";
import { openAttachment } from "./files";
import { documentPicker } from "./uploads";
export { audience, deleteNote, describe, hostOf, letterTile } from "./bookmark-text";

export type BookmarkList = Awaited<ReturnType<typeof api.bookmarks.list>>;
export type Bookmark = BookmarkList["items"][number];
export type BookmarkFolder = BookmarkList["folders"][number];

/** Every bookmarks list (company, folder, search) starts with this key. */
export const bookmarksKey = ["bookmarks"] as const;

/** The Console's limit for a file bookmark (BOOKMARK_FILE): 1 MB. */
export const MAX_FILE_BYTES = 1024 * 1024;
export const FILE_TOO_LARGE = "Escolha um arquivo de até 1 MB.";

/** Folders and companies for the forms (the first page of everything). */
const choicesKey = ["bookmark-choices"] as const;

/** Lists change after any change to a bookmark or a folder. */
export const refreshBookmarks = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: bookmarksKey }),
    queryClient.invalidateQueries({ queryKey: choicesKey }),
  ]);

/** The pages of every bookmarks list already loaded, newest first. */
function cachedPages() {
  return queryClient
    .getQueriesData<InfiniteData<BookmarkList>>({ queryKey: bookmarksKey })
    .sort(([a], [b]) => (queryClient.getQueryState(b)?.dataUpdatedAt ?? 0) - (queryClient.getQueryState(a)?.dataUpdatedAt ?? 0))
    .flatMap(([, data]) => data?.pages ?? []);
}

/** A bookmark the list showed, for the screens it opens (edit, move). */
export function cachedBookmark(id: string) {
  for (const page of cachedPages()) {
    const item = page.items.find((i) => i.id === id);
    if (item) return item;
  }
  return null;
}

/**
 * One bookmark for the screens the list opens (edit, move): what the list
 * already showed, or bookmarks.get when they open without it (a link, a
 * restored screen). Kept as it opened, so a form does not change under the person.
 */
export function useBookmark(id: string) {
  const [cached] = useState(() => cachedBookmark(id));
  return useQuery({
    queryKey: ["bookmark", id],
    queryFn: () => api.bookmarks.get({ id }),
    initialData: cached ?? undefined,
    enabled: !cached && !!id,
    staleTime: Infinity,
    // Dropped when the screen closes, so the next one starts from the list again.
    gcTime: 0,
  });
}

/** Folders and companies as the list last saw them (all folders, whichever company was picked). */
export function cachedChoices() {
  const folders = new Map<string, BookmarkFolder>();
  let companies: BookmarkList["companies"] = [];
  for (const page of cachedPages()) {
    if (!companies.length) companies = page.companies;
    for (const f of page.folders) if (!folders.has(f.id)) folders.set(f.id, f);
  }
  return { folders: [...folders.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), companies };
}

export const cachedFolder = (id: string) => cachedChoices().folders.find((f) => f.id === id) ?? null;

/**
 * Where a bookmark or a folder can go: the person's companies and every
 * folder they see (bookmarks.list, all companies). Starts from what the list
 * already has, so a form opens filled.
 */
export function useBookmarkChoices() {
  return useQuery({
    queryKey: choicesKey,
    queryFn: async () => {
      const { folders, companies } = await api.bookmarks.list({});
      return { folders, companies };
    },
    placeholderData: () => {
      const cached = cachedChoices();
      return cached.companies.length ? cached : undefined;
    },
  });
}

/** Where a whiteboard opens on the web, to draw. */
export const boardUrl = (id: string) => `${CONSOLE_URL}/bookmarks/${id}/lousa`;

/** A bookmark as bookmarks.list and Início (overview.get) send it. */
export type BookmarkTarget = Pick<Bookmark, "id" | "title" | "kind" | "url" | "fileName" | "filePath"> & { updatedAt?: string };

/**
 * Opens what a bookmark points at, the same from every screen (the web's
 * `boardHref`): a link in the browser, a file in the share sheet, a board
 * full screen in the viewer (which also saves or shares its picture).
 */
export async function openBookmark(item: BookmarkTarget) {
  try {
    if (item.kind === "board")
      router.push({ pathname: "/bookmarks/[id]/lousa", params: { id: item.id, title: item.title, ...(item.updatedAt ? { v: item.updatedAt } : {}) } });
    else if (item.kind === "link" && item.url) await WebBrowser.openBrowserAsync(item.url);
    else if (item.filePath) await openAttachment(item.filePath, item.fileName ?? item.title);
  } catch {
    Alert.alert("Não foi possível abrir", "Confira a internet e tente de novo.");
  }
}

/** A refusal worth showing as is (the Console's words or the same rule checked here). */
export class BookmarkFileError extends Error {}

/** A photo picked on the phone, ready to send as a file bookmark. */
export type PickedPhoto = { uri: string; name: string; mime: string; size: number };

const settingsWord = Platform.OS === "ios" ? "nos Ajustes do iPhone" : "nas configurações do Android";

async function cameraAllowed() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.granted) return true;
  Alert.alert(
    "Sem acesso à câmera",
    `Para tirar uma foto, permita o acesso à câmera ${settingsWord}.`,
    permission.canAskAgain
      ? [{ text: "OK" }]
      : [
          { text: "Agora não", style: "cancel" },
          { text: Platform.OS === "ios" ? "Abrir Ajustes" : "Abrir configurações", onPress: () => void Linking.openSettings() },
        ],
  );
  return false;
}

/** Wider photos are reduced, so a phone picture fits the 1 MB the Console keeps. */
const MAX_WIDTH = 1600;

/**
 * A photo from the camera or the library, as a JPEG of at most 1 MB, or null
 * when the person gave up. The library needs no permission: only what the
 * person picks reaches the app.
 */
export async function pickPhoto(source: "camera" | "library"): Promise<PickedPhoto | null> {
  let asset: ImagePicker.ImagePickerAsset | undefined;
  try {
    if (source === "camera") {
      if (!(await cameraAllowed())) return null;
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
      asset = result.canceled ? undefined : result.assets[0];
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      asset = result.canceled ? undefined : result.assets[0];
    }
  } catch {
    throw new BookmarkFileError(source === "camera" ? "Não foi possível abrir a câmera. Escolha uma foto da galeria." : "Não foi possível abrir a galeria. Tente novamente.");
  }
  if (!asset) return null;
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    if (!asset.width || asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    const size = new File(saved.uri).size ?? 0;
    if (size > MAX_FILE_BYTES) throw new BookmarkFileError(FILE_TOO_LARGE);
    const base = (asset.fileName ?? "").replace(/\.[^.]+$/, "") || `foto-${new Date().toISOString().slice(0, 10)}`;
    return { uri: saved.uri, name: `${base}.jpg`, mime: "image/jpeg", size };
  } catch (failure) {
    if (failure instanceof BookmarkFileError) throw failure;
    throw new BookmarkFileError("Não foi possível preparar a foto. Tente outra.");
  }
}

/**
 * A document from the phone's files (PDF, planilha, apresentação…), as it is,
 * or null when the person gave up. Only on builds with the document picker
 * (1.2.0 on): before, file bookmarks are photos.
 */
export async function pickDocument(): Promise<PickedPhoto | null> {
  if (!documentPicker) return null;
  let asset;
  try {
    const result = await documentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    asset = result.canceled ? undefined : result.assets[0];
  } catch {
    throw new BookmarkFileError("Não foi possível abrir os arquivos. Tente novamente.");
  }
  if (!asset) return null;
  const size = asset.size ?? new File(asset.uri).size ?? 0;
  if (size > MAX_FILE_BYTES) throw new BookmarkFileError(FILE_TOO_LARGE);
  return { uri: asset.uri, name: asset.name, mime: asset.mimeType || "application/octet-stream", size };
}

const FAILED = "Não foi possível salvar o bookmark. Tente novamente.";

/**
 * Sends a file bookmark to POST /api/v1/bookmarks/arquivo (multipart, with
 * the session), where the Console applies the web's rules and limit.
 */
export async function uploadBookmarkFile(
  file: PickedPhoto,
  fields: { title: string; companyId: string; folderId: string },
): Promise<{ id: string; message: string }> {
  if (file.size > MAX_FILE_BYTES) throw new BookmarkFileError(FILE_TOO_LARGE);
  let response: Response;
  try {
    const body = new FormData();
    body.append("title", fields.title);
    body.append("companyId", fields.companyId);
    body.append("folderId", fields.folderId);
    // React Native sends a { uri, name, type } part as the file's bytes.
    body.append("file", { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
    response = await fetch(`${CONSOLE_URL}/api/v1/bookmarks/arquivo`, {
      method: "POST",
      headers: await sessionHeaders(),
      body,
      // The cookie goes by hand, as in every API call.
      credentials: "omit",
    });
  } catch {
    throw new BookmarkFileError("Não foi possível conectar. Confira a internet e tente novamente.");
  }
  const result = (await response.json().catch(() => null)) as { id?: string; message?: string; error?: unknown } | null;
  if (!response.ok || !result?.id)
    throw new BookmarkFileError(typeof result?.error === "string" && result.error ? result.error : FAILED);
  return { id: result.id, message: result.message || "Bookmark salvo." };
}
