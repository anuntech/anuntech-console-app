import { useState } from "react";
import { Alert } from "react-native";
import { openAttachment } from "@/lib/files";
import { Button } from "./button";

/** Downloads a PDF the Console serves with the session and opens the share sheet. */
export function PdfButton({ path, name, title = "Baixar PDF" }: { path: string; name: string; title?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title={busy ? "Baixando…" : title}
      variant="outline"
      busy={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await openAttachment(path, name);
        } catch {
          Alert.alert("Não foi possível abrir o PDF", "Confira a internet e tente de novo.");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
