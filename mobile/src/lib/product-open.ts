import { Alert } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

/** A product or service as overview.get and products.list describe it. */
export type ProductTarget = {
  id: string;
  name: string;
  status: string;
  opensAs: "app" | "link" | "service" | "none";
  url: string | null;
  /** The e-mail product: the company whose mailboxes it opens (a Console from before it leaves this out). */
  mailCompanyId?: string;
};

/**
 * Where a product or service goes on a tap, as on the web: the e-mail
 * product to the company's mailboxes, a service to its screen, a protected
 * app to the screen that asks for a pass, any other product to its own link
 * in the browser. A suspended product shows why it is suspended and how to
 * bring it back (the mailboxes still open: receiving goes on).
 */
export function openProduct(product: ProductTarget) {
  if (product.mailCompanyId) return router.push({ pathname: "/produtos/email/[company]", params: { company: product.mailCompanyId } });
  if (product.opensAs === "service" || product.status === "suspended" || product.opensAs === "none")
    return router.push({ pathname: "/produtos/[id]", params: { id: product.id } });
  if (product.opensAs === "app") return router.push({ pathname: "/produtos/app/[id]", params: { id: product.id } });
  if (product.url)
    void WebBrowser.openBrowserAsync(product.url).catch(() =>
      Alert.alert("Não foi possível abrir", "Confira a internet e tente de novo."),
    );
}
