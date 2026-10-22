import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { radius, rounded, space, usePalette } from "@/lib/theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * "Colar código", as on the sign-in: WhatsApp's "Copiar código" leaves the
 * six numbers on the clipboard; anything else explains what to copy.
 */
export function PasteCodeButton({
  onCode,
  onError,
  disabled,
  testID,
}: {
  onCode: (code: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Button
      title="Colar código"
      icon="doc.on.clipboard"
      variant="secondary"
      testID={testID}
      disabled={disabled}
      onPress={async () => {
        const pasted = (await Clipboard.getStringAsync()).replace(/\D/g, "").slice(0, 6);
        if (pasted.length !== 6) onError("Copie o código de 6 números no WhatsApp ou no e-mail e toque em Colar código.");
        else onCode(pasted);
      }}
    />
  );
}

/** Where the code went, with "Alterar" to go back and fix the contact (the sign-in's box). */
export function SentTo({
  icon,
  destination,
  onChange,
  disabled,
}: {
  icon: SFSymbol;
  destination: string;
  onChange?: () => void;
  disabled?: boolean;
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        ...rounded(radius.lg),
        backgroundColor: palette.card,
        paddingLeft: space.lg,
        paddingRight: space.xs,
        minHeight: space.row,
        ...(palette.dark ? { borderWidth: 1, borderColor: palette.border } : {}),
      }}
    >
      <SymbolView name={icon} size={18} tintColor={palette.primary} accessible={false} />
      <View accessible style={{ flex: 1, paddingVertical: space.md }}>
        <Text variant="caption" tone="muted">
          Código enviado para
        </Text>
        <Text variant="label" numberOfLines={1}>
          {destination}
        </Text>
      </View>
      {onChange ? <Button title="Alterar" variant="plain" size="small" disabled={disabled} onPress={onChange} /> : null}
    </View>
  );
}
