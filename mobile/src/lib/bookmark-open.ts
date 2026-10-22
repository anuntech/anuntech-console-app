import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { openAttachment } from "./files";

/** A bookmark as the API sends it (bookmarks.list and overview.get). */
export type BookmarkTarget = {
  title: string;
  kind: "link" | "file" | "board";
  url: string | null;
  fileName: string | null;
  filePath: string | null;
};

/** Opens what a bookmark points at: a link in the browser, a file or a board's picture in the share sheet. */
export async function openBookmark(item: BookmarkTarget) {
  try {
    if (item.kind === "link" && item.url) await WebBrowser.openBrowserAsync(item.url);
    else if (item.filePath) await openAttachment(item.filePath, item.kind === "board" ? `${item.title}.png` : (item.fileName ?? item.title));
    else Alert.alert("Abra no Console", "Esta lousa ainda não tem imagem para ver no app.");
  } catch {
    Alert.alert("Não foi possível abrir", "Confira a internet e tente de novo.");
  }
}
