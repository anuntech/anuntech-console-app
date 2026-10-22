import { useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { openAttachment } from "@/lib/files";
import { usePalette } from "@/lib/theme";
import { ListRow } from "./list-row";
import { IconTile } from "./tile";

/**
 * A row that downloads a PDF the Console serves with the session and opens
 * the share sheet. Goes inside a Section.
 */
export function PdfRow({
  path,
  name,
  title = "Baixar PDF",
  icon = "arrow.down.doc.fill",
}: {
  path: string;
  name: string;
  title?: string;
  icon?: SFSymbol;
}) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  return (
    <ListRow
      leading={<IconTile icon={icon} color="gray" />}
      title={busy ? "Baixando…" : title}
      trailing={busy ? <ActivityIndicator size="small" color={palette.muted} /> : "chevron"}
      onPress={async () => {
        if (busy) return;
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
