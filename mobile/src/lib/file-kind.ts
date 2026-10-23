/** Photos the app draws itself (expo-image); SVG and the rest go to the share sheet. */
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]);
const IMAGE_NAME = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

/** Whether a file opens in the in-app viewer: by its type when known, else by its name. */
export function isViewableImage(name: string, mime?: string | null) {
  if (mime) return IMAGE_TYPES.has(mime.toLowerCase());
  return IMAGE_NAME.test(name);
}
