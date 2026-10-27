import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { cancelAllUploads, cancelUpload, clearUploads, isBusy, retryUpload, type UploadItem } from "@/lib/arquivos";
import { fileSize } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { enter, exit, layout } from "@/lib/motion";
import { fonts, rounded, space, usePalette } from "@/lib/theme";
import {
  percentLabel,
  progressShare,
  sentLabel,
  spaceAlmostFull,
  spaceHeading,
  spaceLabel,
  spacePercent,
  spaceSegments,
  spaceShare,
  type SpaceParts,
} from "@/lib/upload-plan";
import { Text } from "./text";

/** A thin bar, filled to `share` (0 to 1). */
function Bar({ share, color, height = 4 }: { share: number; color: string; height?: number }) {
  const palette = usePalette();
  return (
    <View style={{ height, ...rounded(999), backgroundColor: palette.fill, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(share * 1000) / 10}%`, height, ...rounded(999), backgroundColor: color }} />
    </View>
  );
}

function IconButton({ symbol, label, onPress }: { symbol: SFSymbol; label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? palette.fill : "transparent",
      })}
    >
      <SymbolView name={symbol} size={14} weight="semibold" tintColor={palette.muted} accessible={false} />
    </Pressable>
  );
}

const statusOf = (item: UploadItem) =>
  item.state === "done"
    ? `${fileSize(item.size)} · Enviado`
    : item.state === "error" || item.state === "cancelled"
      ? (item.error ?? "Não foi possível enviar.")
      : item.state === "waiting"
        ? `${fileSize(item.size)} · Na fila`
        : item.state === "saving"
          ? "Salvando…"
          : `${sentLabel(item.sent, item.size)} · ${percentLabel(item.sent, item.size)}`;

/**
 * The files on their way to Arquivos, as the web's tray: each with its
 * progress, cancel while it goes, "Enviar de novo" after a failure, and a
 * check when it arrived. While anything goes, a word that the app must stay open.
 */
export function UploadTray({ items }: { items: UploadItem[] }) {
  const palette = usePalette();
  if (!items.length) return null;
  const going = items.some(isBusy);
  const sent = items.filter((item) => item.state === "done").length;
  return (
    <Animated.View entering={enter} exiting={exit} layout={layout} style={{ marginHorizontal: space.gutter }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 6 }}>
        <Text variant="caption" tone="muted" accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.semibold }}>
          {going ? "Enviando arquivos" : `${sent} de ${items.length} enviados`}
        </Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => {
            haptic.light();
            if (going) cancelAllUploads();
            else clearUploads();
          }}
        >
          <Text variant="caption" tone="primary" style={{ fontFamily: fonts.semibold }}>
            {going ? "Cancelar envios" : "Fechar"}
          </Text>
        </Pressable>
      </View>
      <View style={{ backgroundColor: palette.card, ...rounded(24), overflow: "hidden", ...(palette.dark ? { borderWidth: 1, borderColor: palette.border } : {}) }}>
        {items.map((item, index) => {
          const failed = item.state === "error" || item.state === "cancelled";
          const moving = item.state === "sending" || item.state === "saving";
          const status = statusOf(item);
          const icon: SFSymbol = failed
            ? "exclamationmark.triangle.fill"
            : item.state === "done"
              ? "checkmark.circle.fill"
              : item.mime.startsWith("video/")
                ? "video.fill"
                : item.mime.startsWith("image/")
                  ? "photo"
                  : "doc.fill";
          return (
            <Animated.View key={item.key} entering={enter} layout={layout}>
              {index > 0 ? <View style={{ marginLeft: 60, height: StyleSheet.hairlineWidth, backgroundColor: palette.separator }} /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, paddingLeft: 16, paddingRight: space.sm, paddingVertical: space.sm }}>
                <View
                  accessible
                  accessibilityRole={moving ? "progressbar" : undefined}
                  accessibilityLabel={`${item.name}, ${status}`}
                  accessibilityValue={moving ? { min: 0, max: 100, now: Math.floor(progressShare(item.sent, item.size) * 100) } : undefined}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.md }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      ...rounded(8),
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: failed ? palette.destructiveSoft : item.state === "done" ? palette.successSoft : palette.accent,
                    }}
                  >
                    {item.state === "saving" ? (
                      <ActivityIndicator size="small" color={palette.primary} />
                    ) : (
                      <SymbolView
                        name={icon}
                        size={16}
                        tintColor={failed ? palette.destructive : item.state === "done" ? palette.success : palette.primary}
                        accessible={false}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="label" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" tone={failed ? "destructive" : "muted"} numberOfLines={3}>
                      {status}
                    </Text>
                    {item.state === "sending" ? <Bar share={Math.max(0.02, progressShare(item.sent, item.size))} color={palette.primary} /> : null}
                  </View>
                </View>
                {item.state === "waiting" || item.state === "sending" ? (
                  <IconButton symbol="xmark" label={`Cancelar o envio de ${item.name}`} onPress={() => (haptic.light(), cancelUpload(item.key))} />
                ) : failed ? (
                  <IconButton symbol="arrow.clockwise" label={`Enviar ${item.name} de novo`} onPress={() => (haptic.light(), retryUpload(item.key))} />
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </View>
      {going ? (
        <Text variant="caption" tone="muted" style={{ marginHorizontal: 16, marginTop: 6 }}>
          Mantenha o app aberto até terminar: fora da tela, o envio pode parar.
        </Text>
      ) : null}
    </Animated.View>
  );
}

export type Space = { companyId: string | null; used: number; quota: number | null; parts?: SpaceParts };

/** The parts in shades of the brand violet, as the web's (bg-primary, /55, /25). */
const PART_OPACITY: Record<keyof SpaceParts, number> = { media: 1, documents: 0.55, other: 0.25 };

/**
 * "Armazenamento", as the web's meter: what each space holds, split into
 * photos and videos, documents and the rest, on a bar that fills up to the
 * company's limit, with the percentage and what is left (red above 90%).
 * Anuntech's own space has no limit and shows only the split. The space's
 * name only when there are several on the screen.
 */
export function SpaceMeter({ spaces, nameOf }: { spaces: Space[]; nameOf: (companyId: string | null) => string }) {
  const palette = usePalette();
  if (!spaces.length) return null;
  const named = spaces.length > 1;
  return (
    <View style={{ marginHorizontal: space.gutter, backgroundColor: palette.card, ...rounded(24), overflow: "hidden", ...(palette.dark ? { borderWidth: 1, borderColor: palette.border } : {}) }}>
      {spaces.map((s, index) => {
        const heading = spaceHeading(named ? nameOf(s.companyId) : null);
        const label = spaceLabel(s.used, s.quota);
        const percent = spacePercent(s.used, s.quota);
        const full = spaceAlmostFull(s.used, s.quota);
        const segments = spaceSegments(s.used, s.quota, s.parts);
        const legend = s.used > 0 ? segments : [];
        // What is used reads stronger than the limit and what is left, as on the web.
        const amount = s.used ? fileSize(s.used) : "0 KB";
        const rest = label.slice(amount.length);
        return (
          <View key={s.companyId ?? "anuntech"}>
            {index > 0 ? <View style={{ marginLeft: 16, height: StyleSheet.hairlineWidth, backgroundColor: palette.separator }} /> : null}
            <View
              accessible
              accessibilityRole={s.quota !== null ? "progressbar" : undefined}
              accessibilityLabel={[`${named ? `Armazenamento de ${heading}` : heading}: ${label}`, ...legend.map((part) => `${part.label}, ${fileSize(part.bytes)}`)].join(". ")}
              accessibilityValue={s.quota !== null ? { min: 0, max: 100, now: Math.round(spaceShare(s.used, s.quota) * 100) } : undefined}
              style={{ paddingHorizontal: 16, paddingVertical: space.md, gap: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
                <Text variant="caption" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold }}>
                  {heading}
                </Text>
                {percent ? (
                  <Text variant="caption" tone={full ? "destructive" : "muted"} style={{ fontVariant: ["tabular-nums"] }}>
                    {percent}
                  </Text>
                ) : null}
              </View>
              <View style={{ height: 8, flexDirection: "row", gap: 2, ...rounded(999), backgroundColor: palette.fill, overflow: "hidden" }}>
                {segments.map((part) => (
                  <View
                    key={part.key}
                    style={{
                      width: `${Math.round(part.share * 1000) / 10}%`,
                      height: 8,
                      backgroundColor: full ? palette.destructive : palette.primary,
                      opacity: full ? 1 : PART_OPACITY[part.key],
                    }}
                  />
                ))}
              </View>
              <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
                {amount}
                <Text variant="caption" tone="muted">
                  {rest}
                </Text>
              </Text>
              {legend.length ? (
                <View style={{ gap: 4 }}>
                  {legend.map((part) => (
                    <View key={part.key} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary, opacity: PART_OPACITY[part.key] }} />
                      <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                        {part.label}
                      </Text>
                      <Text variant="caption" tone="muted" style={{ fontVariant: ["tabular-nums"] }}>
                        {fileSize(part.bytes)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
