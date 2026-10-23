import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StatusBar, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { registerImageViewer, shareFile, type ViewedImage } from "@/lib/files";
import { space } from "@/lib/theme";
import { Text } from "./text";

/** A photo reads on black in either theme, as in Fotos. */
const BACKDROP = "#000000";
const ON_BACKDROP = "#ffffff";
const BUTTON = "rgba(255,255,255,0.16)";

function RoundButton({ symbol, label, onPress }: { symbol: SFSymbol; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BUTTON,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <SymbolView name={symbol} size={17} weight="semibold" tintColor={ON_BACKDROP} accessible={false} />
    </Pressable>
  );
}

/**
 * The full-screen viewer for photos attached to tickets, tasks and bookmarks:
 * mounted once under the tabs, it opens when openAttachment gets an image.
 * Pinch to zoom on iOS; Compartilhar keeps the share sheet a tap away.
 */
export function ImageViewer() {
  const [image, setImage] = useState<ViewedImage | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => registerImageViewer(setImage), []);
  const close = () => setImage(null);
  const share = () => {
    if (!image) return;
    void shareFile(image.uri, image.name).catch(() => Alert.alert("Não foi possível compartilhar", "Tente de novo."));
  };
  return (
    <Modal
      visible={!!image}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={close}
    >
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: BACKDROP }}>
        {image ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: image.uri }}
              style={{ width, height }}
              contentFit="contain"
              cachePolicy="none"
              accessible
              accessibilityRole="image"
              accessibilityLabel={image.name}
            />
          </ScrollView>
        ) : null}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            paddingTop: insets.top + space.sm,
            paddingLeft: insets.left + space.lg,
            paddingRight: insets.right + space.lg,
            paddingBottom: space.sm,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <RoundButton symbol="xmark" label="Fechar" onPress={close} />
          <Text variant="label" numberOfLines={1} style={{ flex: 1, textAlign: "center", color: ON_BACKDROP }}>
            {image?.name}
          </Text>
          <RoundButton symbol="square.and.arrow.up" label="Compartilhar" onPress={share} />
        </View>
      </View>
    </Modal>
  );
}
