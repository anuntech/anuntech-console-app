import { Alert } from "react-native";
import { ORPCError } from "@orpc/client";
import * as WebBrowser from "expo-web-browser";
import { api, errorMessage } from "./api";
import { CONSOLE_URL } from "./config";
import { haptic } from "./haptics";

/** Opens the Console page as it is, after saying the person will have to sign in there. */
function openSignedOut(path: string) {
  Alert.alert("Abrir no Console", "O Console abre no navegador e pede para você entrar de novo.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Abrir", onPress: () => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}${path}`).catch(() => undefined) },
  ]);
}

/**
 * Opens a page of the web Console (`path`, "/bookmarks/<id>/lousa") in the
 * app's browser, already signed in: the Console hands the app session over
 * with a single-use address that lasts two minutes (account.openWeb). A
 * Console without the hand-off still opens, after a warning that it asks
 * to sign in.
 */
export async function openConsole(path: string) {
  let handoff: string;
  try {
    handoff = (await api.account.openWeb({ next: path })).path;
  } catch (error) {
    // A Console from before the hand-off answers 404 for the procedure.
    if (error instanceof ORPCError && error.status === 404) return openSignedOut(path);
    haptic.error();
    Alert.alert("Não foi possível abrir", errorMessage(error));
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(`${CONSOLE_URL}${handoff}`);
  } catch {
    Alert.alert("Não foi possível abrir", "Confira a internet e tente de novo.");
  }
}
