import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { fileTypeOf, type FileGroup } from "@/lib/bookmark-text";
import { rounded, usePalette } from "@/lib/theme";

/** The icon of each kind of file, as the web's GROUP_ICONS (file-card.tsx). */
export const GROUP_SYMBOLS: Record<FileGroup, SFSymbol> = {
  image: "photo",
  video: "video.fill",
  audio: "waveform",
  pdf: "doc.richtext.fill",
  document: "doc.text.fill",
  sheet: "tablecells",
  slides: "play.rectangle",
  archive: "doc.zipper",
  code: "chevron.left.forwardslash.chevron.right",
  design: "paintbrush.pointed",
  other: "doc.fill",
};

type Thumbed = { id: string; fileName: string | null; thumbUrl?: string; updatedAt?: string };

/**
 * The cache key of a file's picture: its address changes every five minutes
 * (it is signed), the picture only with the file.
 */
export const thumbCacheKey = (item: Thumbed) => `arquivo-miniatura-${item.id}-${item.updatedAt ?? ""}`;

/**
 * A file's tile in a list, as the web's: its picture (the small WebP the
 * Console made, from bookmarks.list's signed address) or, without one, the
 * icon of its kind. A picture that fails to load gives way to the icon.
 */
export function FileThumb({ item, size = 32 }: { item: Thumbed; size?: number }) {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, ...rounded(8), alignItems: "center", justifyContent: "center", overflow: "hidden" } as const;
  if (item.thumbUrl && !failed)
    return (
      <View accessible={false} style={{ ...box, backgroundColor: palette.secondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border }}>
        <Image
          source={{ uri: item.thumbUrl, cacheKey: thumbCacheKey(item) }}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          accessible={false}
          onError={() => setFailed(true)}
        />
      </View>
    );
  return (
    <View accessible={false} style={{ ...box, backgroundColor: palette.secondary }}>
      <SymbolView name={GROUP_SYMBOLS[fileTypeOf(item.fileName).group]} size={Math.round(size * 0.47)} tintColor={palette.muted} accessible={false} />
    </View>
  );
}
