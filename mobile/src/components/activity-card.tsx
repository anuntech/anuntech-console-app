import { useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Section } from "@/components/section";
import { Bar, useDelayed } from "@/components/skeleton";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import {
  buildHeatmap,
  countLabel,
  dayAt,
  dayLabel,
  formatCount,
  levelColors,
  levelRanges,
  noun,
  summary,
  weekdayLabels,
} from "@/lib/activity-heatmap";
import { haptic } from "@/lib/haptics";
import { fonts, space, usePalette } from "@/lib/theme";

/** Minha conta's "Atividade" (profile.activity); pull to refresh on the screen refetches it. */
export const activityKey = ["profile-activity"] as const;

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LABEL = 30;
const PERIOD = "nos últimos 12 meses";

/**
 * The person's year in the Console, as the web's Atividade card: one square
 * per day, weeks as columns, darker on busier days, "Menos … Mais" below.
 * Only they see it. Touching a square (or swiping up and down with VoiceOver
 * or TalkBack) says that day's count.
 */
export function ActivityCard() {
  const palette = usePalette();
  const query = useQuery({ queryKey: activityKey, queryFn: () => api.profile.activity({}) });
  const loading = useDelayed(query.isPending);
  const [selected, setSelected] = useState<number | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  if (query.isPending)
    return loading ? (
      <Section header="Atividade">
        <View accessible accessibilityLabel="Carregando" style={{ padding: space.lg, gap: space.md }}>
          <Bar width={220} height={18} />
          <Bar width="100%" height={7 * STEP + 18} radius={12} />
        </View>
      </Section>
    ) : null;
  if (!query.data)
    return (
      <Section header="Atividade">
        <View style={{ padding: space.lg }}>
          <Text variant="subhead" tone="muted">
            {errorMessage(query.error)}
          </Text>
        </View>
      </Section>
    );

  const map = buildHeatmap(query.data.days);
  const colors = levelColors(palette.primary, palette.foreground, palette.card);
  const ranges = levelRanges(map.thresholds);
  const last = map.counts.length - 1;
  const chosen = selected !== null && selected <= last ? selected : null;
  const choose = (index: number | null) => {
    if (index === null || index === chosen) return;
    haptic.select();
    setSelected(index);
  };
  const ring = chosen !== null ? { col: Math.floor((chosen + map.lead) / 7), row: (chosen + map.lead) % 7 } : null;

  return (
    <Section header="Atividade">
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text variant="subhead" tone="muted">
          <Text variant="label">
            {formatCount(map.total)} {noun(map.total)}
          </Text>{" "}
          {PERIOD}
        </Text>
        <View style={{ flexDirection: "row" }}>
          {/* Weekday labels stay put while the weeks scroll. */}
          <View accessible={false} style={{ width: LABEL, paddingTop: 18, gap: GAP }}>
            {weekdayLabels.map((label, row) => (
              <View key={row} style={{ height: CELL, justifyContent: "center" }}>
                <Text variant="micro" tone="muted" maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.regular, fontSize: 10, lineHeight: 12 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
          <ScrollView
            ref={scroller}
            horizontal
            showsHorizontalScrollIndicator={false}
            // The latest weeks first, as the web's grid reads on a narrow card.
            onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
          >
            <View style={{ width: map.weeks * STEP - GAP }}>
              <View accessible={false} style={{ height: 18 }}>
                {map.months.map((month) => (
                  <Text
                    key={`${month.col}-${month.label}`}
                    variant="micro"
                    tone="muted"
                    maxFontSizeMultiplier={1.2}
                    style={{ position: "absolute", left: month.col * STEP, fontFamily: fonts.regular, fontSize: 10, lineHeight: 12 }}
                  >
                    {month.label}
                  </Text>
                ))}
              </View>
              <Pressable
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={`Suas interações no Console ${PERIOD}. ${summary(map.total, PERIOD)}. Quanto mais escuro o quadrado, mais interações. Níveis: ${ranges.join(", ")}.`}
                accessibilityHint="Deslize para cima ou para baixo para ouvir cada dia."
                accessibilityValue={{ text: chosen !== null ? `${countLabel(map.counts[chosen])}, ${dayLabel(map, chosen)}` : "" }}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={({ nativeEvent }) => {
                  const from = chosen ?? last + 1;
                  const next = nativeEvent.actionName === "increment" ? Math.min(last, from + 1) : Math.max(0, from - 1);
                  choose(next);
                }}
                onPress={({ nativeEvent }) =>
                  choose(dayAt(map, Math.floor(nativeEvent.locationX / STEP), Math.floor(nativeEvent.locationY / STEP)))
                }
                style={{ flexDirection: "row", gap: GAP }}
              >
                {Array.from({ length: map.weeks }, (_, col) => (
                  // Not touchable themselves, so a touch's position is read on the grid.
                  <View key={col} pointerEvents="none" style={{ gap: GAP }}>
                    {Array.from({ length: 7 }, (_, row) => {
                      const index = dayAt(map, col, row);
                      return (
                        <View
                          key={row}
                          style={{
                            width: CELL,
                            height: CELL,
                            borderRadius: 3,
                            backgroundColor: index === null ? "transparent" : colors[map.levels[index]],
                          }}
                        />
                      );
                    })}
                  </View>
                ))}
                {ring ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: ring.col * STEP - 2,
                      top: ring.row * STEP - 2,
                      width: CELL + 4,
                      height: CELL + 4,
                      borderRadius: 5,
                      borderWidth: 1.5,
                      borderColor: palette.foreground,
                    }}
                  />
                ) : null}
              </Pressable>
            </View>
          </ScrollView>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Text variant="caption" tone="muted" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {chosen !== null ? `${countLabel(map.counts[chosen])} · ${dayLabel(map, chosen)}` : ""}
          </Text>
          <View accessible={false} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text variant="caption" tone="muted">
              Menos
            </Text>
            {colors.map((color, level) => (
              <View key={level} style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: color }} />
            ))}
            <Text variant="caption" tone="muted">
              Mais
            </Text>
          </View>
        </View>
      </View>
    </Section>
  );
}
