import { useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { openAttachment } from "@/lib/files";
import { space, usePalette } from "@/lib/theme";
import { ListRow } from "./list-row";
import { Pill } from "./pill";
import { Section } from "./section";

type Version = { version: number; sentAt: string; current: boolean; pdfPath: string; signedBy?: string[] };

const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

/** One sent version: when, who signed it, and its PDF (an earlier one is marked as superseded by the Console). */
function VersionRow({ version, name, open }: { version: Version; name: string; open: boolean }) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  const signed = version.signedBy?.length
    ? ` · assinada por ${version.signedBy.map((p) => (p === "client" ? "cliente" : "Anuntech")).join(" e ")}`
    : "";
  const subtitle = `Enviada em ${day.format(new Date(version.sentAt))}${signed}`;
  return (
    <ListRow
      title={`Versão ${version.version}`}
      subtitle={subtitle}
      meta={version.current ? <Pill label="atual" tone="good" /> : undefined}
      trailing={busy ? <ActivityIndicator size="small" color={palette.muted} /> : open ? "chevron" : "none"}
      accessibilityLabel={[`Versão ${version.version}`, version.current ? "atual" : null, subtitle].filter(Boolean).join(", ")}
      accessibilityHint={open ? "Abre o PDF desta versão" : undefined}
      onPress={
        open
          ? async () => {
              if (busy) return;
              setBusy(true);
              try {
                await openAttachment(version.pdfPath, `${name} v${version.version}.pdf`);
              } catch {
                Alert.alert("Não foi possível abrir o PDF", "Confira a internet e tente de novo.");
              } finally {
                setBusy(false);
              }
            }
          : undefined
      }
    />
  );
}

/**
 * The web's "Versões" card: every text sent, newest first, each opening its
 * PDF. Shown only once there is an earlier version; the current one's PDF is
 * the screen's own button.
 */
export function VersionsSection({ versions, name, footer }: { versions: Version[]; name: string; footer: string }) {
  if (!versions.some((v) => !v.current)) return null;
  return (
    <Section header="Versões" footer={footer} indent={space.lg}>
      {versions.map((version) => (
        <VersionRow key={version.version} version={version} name={name} open={!version.current} />
      ))}
    </Section>
  );
}
