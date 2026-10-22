import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { SymbolView } from "expo-symbols";
import { haptic } from "@/lib/haptics";
import { space, usePalette } from "@/lib/theme";
import { ListRow } from "./list-row";
import { Section } from "./section";
import { Text } from "./text";

const mono = Platform.select({ ios: "Menlo", default: "monospace" });

/**
 * The web's "Documento" card: when it was sent, the version when there was
 * more than one send, the facts a screen adds, and the SHA-256 that
 * identifies the text, with a copy button.
 */
export function DocumentFacts({
  hash,
  version,
  sent,
  facts = [],
}: {
  hash: string;
  version: number | null;
  /** When it was sent, as the screen writes it. */
  sent?: string | null;
  /** More of the record after the version: who answered, the template. */
  facts?: { title: string; value: string }[];
}) {
  const palette = usePalette();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    await Clipboard.setStringAsync(hash);
    setCopied(true);
    haptic.success();
    AccessibilityInfo.announceForAccessibility("Hash copiado");
  };
  return (
    <Section header="Documento" indent={space.lg}>
      {sent ? <ListRow title="Enviado em" value={sent} /> : null}
      {version && version > 1 ? <ListRow title="Versão" value={`${version}ª`} /> : null}
      {facts.map((fact) => (
        <ListRow key={fact.title} title={fact.title} value={fact.value} />
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md }}>
        <View accessible accessibilityLabel={`Hash SHA-256: ${hash}`} style={{ flex: 1, gap: 2 }}>
          <Text variant="body">Hash SHA-256</Text>
          <Text variant="caption" tone="muted" selectable style={{ fontFamily: mono }}>
            {hash}
          </Text>
        </View>
        <Pressable
          testID="copy-hash"
          accessibilityRole="button"
          accessibilityLabel={copied ? "Hash copiado" : "Copiar hash"}
          hitSlop={8}
          onPress={() => void copy()}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? palette.fill : palette.primaryTint,
          })}
        >
          <SymbolView
            name={copied ? "checkmark" : "doc.on.doc"}
            size={16}
            weight="semibold"
            tintColor={copied ? palette.success : palette.primary}
            accessible={false}
          />
        </Pressable>
      </View>
    </Section>
  );
}
