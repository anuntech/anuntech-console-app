import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SymbolView } from "@/components/symbol";
import { space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/**
 * A decision that needs a few more words: a page sheet on iOS (swipe down to
 * close), full screen on Android. While `busy` it stays open, so a request in
 * flight is never left without its answer on screen.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  busy = false,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal={!busy}
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space.md,
            paddingHorizontal: space.gutter,
            // A page sheet starts below the status bar; Android's full-screen modal does not.
            paddingTop: Platform.OS === "android" ? insets.top + space.md : space.form,
            paddingBottom: space.sm,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="subhead" tone="muted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            hitSlop={8}
            onPress={close}
            style={({ pressed }) => ({
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? palette.separator : palette.fill,
            })}
          >
            <SymbolView name="xmark" size={13} weight="bold" tintColor={palette.muted} accessible={false} />
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: space.gutter, gap: space.lg, paddingBottom: space.xxl + insets.bottom }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
