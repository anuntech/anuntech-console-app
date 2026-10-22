import { Alert, Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { AvatarInfo } from "@/components/avatar";
import { queryClient, sessionHeaders } from "./api";
import { CONSOLE_URL } from "./config";

/** The Console refuses bigger photos (src/lib/account/profile-avatar.ts); reduced, they never are. */
const MAX_BYTES = 2 * 1024 * 1024;
const FAILED = "Não foi possível alterar a foto. Tente novamente.";

/** A refusal worth showing as is (the server's words or the same rule checked here). */
export class PhotoError extends Error {}

/** Puts the new picture in Conta right away, then asks the Console again. */
export function showAvatar(avatar: AvatarInfo) {
  queryClient.setQueryData(["me"], (me: { avatar: AvatarInfo } | undefined) => (me ? { ...me, avatar } : me));
  void queryClient.invalidateQueries({ queryKey: ["me"] });
}

const settingsWord = Platform.OS === "ios" ? "nos Ajustes do iPhone" : "nas configurações do Android";

/** The camera needs the person's yes; when it was refused, the way to Settings. */
async function cameraAllowed() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.granted) return true;
  Alert.alert(
    "Sem acesso à câmera",
    `Para tirar uma foto do perfil, permita o acesso à câmera ${settingsWord}.`,
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
 * A square photo from the camera (front, for a selfie) or the library, or
 * null when the person gave up. The library picker of iOS and Android needs
 * no permission: only what the person picks reaches the app.
 */
export async function pickPhoto(source: "camera" | "library") {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  };
  if (source === "camera") {
    if (!(await cameraAllowed())) return null;
    try {
      const result = await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front });
      return result.canceled ? null : (result.assets[0] ?? null);
    } catch {
      throw new PhotoError("Não foi possível abrir a câmera. Escolha uma foto da galeria.");
    }
  }
  try {
    const result = await ImagePicker.launchImageLibraryAsync(options);
    return result.canceled ? null : (result.assets[0] ?? null);
  } catch {
    throw new PhotoError("Não foi possível abrir a galeria. Tente novamente.");
  }
}

/** Wider photos are reduced here: Vercel takes bodies up to 4.5 MB, the Console 2 MB. */
const MAX_WIDTH = 1024;

/** The picked photo as a JPEG at most 1024 px wide (the crop is square), ~0.8 quality. */
async function shrink(asset: ImagePicker.ImagePickerAsset) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (!asset.width || asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return new File(saved.uri).arrayBuffer();
}

/**
 * Sends the photo's bytes to POST /api/v1/conta/foto with the session, as
 * the web's "Enviar foto" does (the browser reduces it first, so does the
 * app). The Console stores it as 512 px WebP.
 */
export async function uploadPhoto(asset: ImagePicker.ImagePickerAsset): Promise<{ avatar: AvatarInfo; message: string }> {
  let response: Response;
  try {
    const body = await shrink(asset);
    if (!body.byteLength) throw new PhotoError("Selecione uma foto para enviar.");
    if (body.byteLength > MAX_BYTES) throw new PhotoError("A foto deve ter até 2 MB.");
    response = await fetch(`${CONSOLE_URL}/api/v1/conta/foto`, {
      method: "POST",
      headers: { ...(await sessionHeaders()), "Content-Type": "image/jpeg" },
      body,
      // The cookie goes by hand, as in every API call.
      credentials: "omit",
    });
  } catch (failure) {
    if (failure instanceof PhotoError) throw failure;
    throw new PhotoError(FAILED);
  }
  const result = (await response.json().catch(() => null)) as { avatar?: AvatarInfo; message?: string; error?: unknown } | null;
  if (!response.ok || !result?.avatar)
    throw new PhotoError(typeof result?.error === "string" && result.error ? result.error : FAILED);
  return { avatar: result.avatar, message: result.message || "Foto de perfil atualizada." };
}
