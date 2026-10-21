import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { authClient } from "./auth";
import { CONSOLE_URL } from "./config";

/**
 * Downloads a ticket attachment with the session (the Console checks access
 * again) and opens the share sheet, where the person views or saves it.
 */
export async function openAttachment(href: string, name: string) {
  const cookie = await authClient.getCookie();
  const folder = new Directory(Paths.cache, "anexos");
  if (!folder.exists) folder.create({ intermediates: true });
  const target = new File(folder, name.replace(/[/\\]/g, "-"));
  const file = await File.downloadFileAsync(`${CONSOLE_URL}${href}`, target, {
    headers: cookie ? { Cookie: cookie } : {},
    idempotent: true,
  });
  await Sharing.shareAsync(file.uri, { dialogTitle: name });
}
