import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { authClient } from "./auth";
import { CONSOLE_URL } from "./config";
import { isViewableImage } from "./file-kind";

export { isViewableImage };

/** An image already on the phone, for the viewer. */
export type ViewedImage = { uri: string; name: string };

let viewer: ((image: ViewedImage) => void) | null = null;

/** The full-screen viewer (components/image-viewer.tsx) listens here while it is mounted. */
export function registerImageViewer(show: (image: ViewedImage) => void) {
  viewer = show;
  return () => {
    if (viewer === show) viewer = null;
  };
}

/** Downloads a file with the session (the Console checks access again) into the cache. */
async function download(href: string, name: string) {
  const cookie = await authClient.getCookie();
  // One folder per file: two attachments with the same name never overwrite each other.
  const folder = new Directory(Paths.cache, "anexos", href.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "arquivo");
  if (!folder.exists) folder.create({ intermediates: true });
  const target = new File(folder, name.replace(/[/\\]/g, "-"));
  return File.downloadFileAsync(`${CONSOLE_URL}${href}`, target, {
    headers: cookie ? { Cookie: cookie } : {},
    idempotent: true,
  });
}

/** The share sheet for a file on the phone, where the person saves it or opens it elsewhere. */
export async function shareFile(uri: string, name: string) {
  await Sharing.shareAsync(uri, { dialogTitle: name });
}

/**
 * Downloads an attachment with the session and shows it: a photo opens in the
 * app's full-screen viewer (with Compartilhar there); anything else, or a
 * photo while no viewer is mounted, opens the share sheet, where iOS previews
 * PDFs and the person views or saves the file. `mime` is optional: without it
 * the file name decides.
 */
export async function openAttachment(href: string, name: string, mime?: string | null) {
  const file = await download(href, name);
  if (viewer && isViewableImage(name, mime)) return viewer({ uri: file.uri, name });
  await shareFile(file.uri, name);
}
