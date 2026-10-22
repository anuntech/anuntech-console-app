import { Alert, Linking, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File, FileMode } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { sessionHeaders } from "./api";
import { CONSOLE_URL } from "./config";

/*
 * Attachments for tickets and tasks, as the web's field takes them
 * (src/lib/tickets/attachment-rules.ts): PDF, PNG, JPEG or WebP, up to 5
 * files and 20 MB in total. Each file goes to POST /api/v1/anexos as soon as
 * it is picked; the reply, the ticket or the comment then sends its uploadId.
 */

export type PickedFile = { uri: string; name: string; mime: string; size: number };
export type UploadTarget = { kind: "ticket"; companyId: string } | { kind: "task"; engagementId: string };

/** The web's rules for ticket and task files (DOCUMENT_ATTACHMENTS). */
export const ATTACHMENT_RULES = {
  accept: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  max: 5,
  maxBytes: 20 * 1024 * 1024,
  /** The hint under the field, as attachmentHint() writes it. */
  hint: "PDF, PNG, JPEG ou WebP · até 5 arquivos, 20 MB no total",
  /** What the web says for another kind of file. */
  kindError: "Envie PDF, PNG, JPEG ou WebP.",
  /** What the web says past the count or the size (attachmentLimitError). */
  limitError: "Até 5 arquivos, com 20 MB no total.",
} as const;

/** A refusal worth showing as is (the Console's words, or the same rule checked here). */
export class UploadError extends Error {}

const FAILED = "O envio do anexo falhou. Tente de novo.";
/** One request stays under what the Console's host takes (4.5 MB); bigger files go in parts. */
const PART_BYTES = 3 * 1024 * 1024;
/** Pictures larger than this are reduced, as the Console does to 2048 px anyway. */
const MAX_SIDE = 2048;

const settingsWord = Platform.OS === "ios" ? "nos Ajustes do iPhone" : "nas configurações do Android";

/** The camera needs the person's yes; when it was refused, the way to Settings. */
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

/**
 * A photo as a JPEG of at most 2048 px on its longer side: iPhone photos
 * (HEIC) become a kind the Console takes, and big ones travel lighter.
 */
async function asJpeg(asset: ImagePicker.ImagePickerAsset, index: number): Promise<PickedFile> {
  const context = ImageManipulator.manipulate(asset.uri);
  const wide = (asset.width ?? 0) >= (asset.height ?? 0);
  const side = wide ? asset.width : asset.height;
  if (!side || side > MAX_SIDE) context.resize(wide ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const base = asset.fileName?.replace(/\.[^.]+$/, "") || `Foto ${index + 1}`;
  return { uri: saved.uri, name: `${base}.jpg`, mime: "image/jpeg", size: new File(saved.uri).size };
}

/**
 * Files from the camera, the photo library or the Files app, up to `max`
 * (what is left of the 5); an empty list when the person gave up. Another
 * kind of document is refused with the web's words.
 */
export async function pickFiles(source: "camera" | "photos" | "files", max: number): Promise<PickedFile[]> {
  if (max < 1) throw new UploadError(ATTACHMENT_RULES.limitError);
  if (source === "camera") {
    if (!(await cameraAllowed())) return [];
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    } catch {
      throw new UploadError("Não foi possível abrir a câmera. Escolha uma foto da galeria.");
    }
    return result.canceled ? [] : Promise.all(result.assets.slice(0, 1).map(asJpeg));
  }
  if (source === "photos") {
    let result: ImagePicker.ImagePickerResult;
    try {
      // The library picker needs no permission: only what the person picks reaches the app.
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: max > 1,
        selectionLimit: max,
        quality: 0.8,
      });
    } catch {
      throw new UploadError("Não foi possível abrir a galeria. Tente novamente.");
    }
    if (result.canceled) return [];
    if (result.assets.length > max) throw new UploadError(ATTACHMENT_RULES.limitError);
    return Promise.all(result.assets.map(asJpeg));
  }
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: [...ATTACHMENT_RULES.accept],
      multiple: max > 1,
      copyToCacheDirectory: true,
    });
  } catch {
    throw new UploadError("Não foi possível abrir os arquivos. Tente novamente.");
  }
  if (result.canceled) return [];
  if (result.assets.length > max) throw new UploadError(ATTACHMENT_RULES.limitError);
  return result.assets.map((asset) => {
    const mime = (asset.mimeType ?? "").toLowerCase();
    if (!(ATTACHMENT_RULES.accept as readonly string[]).includes(mime)) throw new UploadError(ATTACHMENT_RULES.kindError);
    return { uri: asset.uri, name: asset.name, mime, size: asset.size ?? new File(asset.uri).size };
  });
}

const where = (target: UploadTarget) =>
  target.kind === "ticket" ? `para=chamado&empresa=${target.companyId}` : `para=tarefa&projeto=${target.engagementId}`;

type Answer = { uploadId?: string; received?: number; name?: string; size?: number; mime?: string; error?: unknown };

async function send(path: string, method: "POST" | "PATCH", body: ArrayBuffer, headers: Record<string, string>): Promise<Answer> {
  let response: Response;
  try {
    response = await fetch(`${CONSOLE_URL}${path}`, {
      method,
      headers: { ...(await sessionHeaders()), ...headers },
      body,
      // The cookie goes by hand, as in every API call.
      credentials: "omit",
    });
  } catch {
    throw new UploadError("Não foi possível conectar. Confira a internet e tente novamente.");
  }
  const result = (await response.json().catch(() => null)) as Answer | null;
  if (!response.ok || !result?.uploadId)
    throw new UploadError(typeof result?.error === "string" && result.error ? result.error : FAILED);
  return result;
}

/**
 * Sends one file with the session (POST /api/v1/anexos, then PATCH for the
 * other parts of a big one) and gives back the id the reply, the ticket or
 * the task sends. `onProgress` gets 0 to 1 as the parts arrive.
 */
export async function uploadFile(
  file: PickedFile,
  target: UploadTarget,
  onProgress?: (fraction: number) => void,
): Promise<{ uploadId: string; name: string; size: number; mime: string }> {
  if (!(ATTACHMENT_RULES.accept as readonly string[]).includes(file.mime)) throw new UploadError(ATTACHMENT_RULES.kindError);
  if (!file.size) throw new UploadError("Arquivo vazio.");
  if (file.size > ATTACHMENT_RULES.maxBytes) throw new UploadError("Escolha um arquivo de até 20 MB.");
  let handle: ReturnType<File["open"]>;
  try {
    handle = new File(file.uri).open(FileMode.ReadOnly);
  } catch {
    throw new UploadError("Não foi possível ler o arquivo. Selecione de novo.");
  }
  try {
    const part = async () => {
      const bytes = await handle.readBytes(PART_BYTES);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    };
    onProgress?.(0);
    const first = await part();
    let answer = await send(`/api/v1/anexos?${where(target)}`, "POST", first, {
      "Content-Type": file.mime,
      "X-File-Name": encodeURIComponent(file.name),
      "X-File-Size": String(file.size),
    });
    const uploadId = answer.uploadId!;
    let sent = first.byteLength;
    onProgress?.(sent / file.size);
    try {
      while (!answer.mime) {
        const next = await part();
        if (!next.byteLength) throw new UploadError(FAILED);
        answer = await send(`/api/v1/anexos?id=${uploadId}&offset=${sent}`, "PATCH", next, {
          "Content-Type": "application/octet-stream",
        });
        sent += next.byteLength;
        onProgress?.(sent / file.size);
      }
    } catch (error) {
      void discardUpload(uploadId);
      throw error;
    }
    return { uploadId, name: answer.name ?? file.name, size: answer.size ?? file.size, mime: answer.mime };
  } finally {
    handle.close();
  }
}

/** Drops a file sent but no longer wanted (removed before the reply went). */
export async function discardUpload(uploadId: string) {
  try {
    await fetch(`${CONSOLE_URL}/api/v1/anexos?id=${encodeURIComponent(uploadId)}`, {
      method: "DELETE",
      headers: await sessionHeaders(),
      credentials: "omit",
    });
  } catch {
    // It expires on its own within the hour.
  }
}
