import { Fragment, useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { decideCard, type Card as ProposalCard, type PageAction } from "@/lib/assistant";
import { haptic } from "@/lib/haptics";
import { enter, exit, layout, popSpring } from "@/lib/motion";
import { rounded, space, usePalette } from "@/lib/theme";
import { Button } from "./button";
import { Card, Notice } from "./surface";
import { StatusTile } from "./tile";
import { Text } from "./text";

type Outcome = { kind: "done"; text: string } | { kind: "dismissed" } | { kind: "error"; text: string };

/** One fact of the change: label and value side by side, or stacked when long or the text is large. */
function Fact({ label, value, stacked }: { label: string; value: string; stacked: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        minHeight: 40,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        ...(stacked ? { gap: 2 } : { flexDirection: "row", alignItems: "center", gap: space.md }),
      }}
    >
      <Text variant="subhead" tone="muted">
        {label}
      </Text>
      <Text
        variant={stacked ? "subhead" : "label"}
        selectable
        style={stacked ? undefined : { flex: 1, flexShrink: 1, textAlign: "right" }}
      >
        {value}
      </Text>
    </View>
  );
}

/** The line that replaces the buttons once the card is decided. */
function Result({ icon, size, tint, children }: { icon: SFSymbol; size: number; tint: string; children: string }) {
  return (
    <Animated.View entering={enter} exiting={exit} layout={layout} accessible style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <SymbolView name={icon} size={size} tintColor={tint} accessible={false} />
      <Text variant="subhead" style={{ flex: 1 }}>
        {children}
      </Text>
    </Animated.View>
  );
}

/**
 * A change the assistant prepared: nothing happens until the person taps
 * Confirmar, and the Console checks their access again when they do.
 */
export function ProposalCardView({ card, onDone }: { card: ProposalCard; onDone: (actions: PageAction[]) => void }) {
  const palette = usePalette();
  const { fontScale } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState<"confirmar" | "descartar" | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Checked when the card shows; the Console refuses an expired one anyway.
  const [expired] = useState(() => new Date(card.expiresAt).getTime() < Date.now());

  // Appears with a small pop (scale 0.96 → 1 and a fade).
  const scale = useSharedValue(reduce ? 1 : 0.96);
  const opacity = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    scale.set(withSpring(1, popSpring));
    opacity.set(withTiming(1, { duration: 200 }));
  }, [scale, opacity]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  const decide = async (decision: "confirmar" | "descartar") => {
    if (decision === "confirmar") haptic.medium();
    setBusy(decision);
    try {
      const result = await decideCard(card, decision);
      if (decision === "descartar") setOutcome({ kind: "dismissed" });
      else {
        setOutcome({ kind: "done", text: result.summary ?? "Feito." });
        haptic.success();
        onDone(result.actions);
      }
    } catch (error) {
      setOutcome({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível concluir." });
      haptic.error();
    } finally {
      setBusy(null);
    }
  };

  const done = outcome?.kind === "done";
  const dismissed = outcome?.kind === "dismissed";
  const pending = !done && !dismissed && !expired;
  const big = fontScale > 1.3;

  return (
    <Animated.View style={pop}>
      <Card raised={pending} tone={done ? "success" : pending ? "warning" : undefined} style={{ gap: 14, opacity: dismissed ? 0.6 : 1 }}>
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <StatusTile icon="hand.raised.fill" tone={pending ? "attention" : "neutral"} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline" accessibilityRole="header">
                {card.title}
              </Text>
              {pending ? (
                <Text variant="caption" tone="warning">
                  Aguardando sua confirmação
                </Text>
              ) : null}
            </View>
          </View>
          {pending ? (
            <Text variant="caption" tone="muted">
              Nada muda até você confirmar.
            </Text>
          ) : null}
        </View>

        {card.details.length ? (
          <View style={{ backgroundColor: palette.background, ...rounded(12), overflow: "hidden" }}>
            {card.details.map((d, i) => (
              <Fragment key={`${d.label}-${i}`}>
                {i > 0 ? <View style={{ marginLeft: space.md, height: StyleSheet.hairlineWidth, backgroundColor: palette.separator }} /> : null}
                <Fact label={d.label} value={d.value} stacked={big || d.value.length > 40} />
              </Fragment>
            ))}
          </View>
        ) : null}

        {card.tainted ? (
          <Notice kind="warning">Preparado depois de ler um texto escrito por outra pessoa. Confira antes de confirmar.</Notice>
        ) : null}

        {done ? (
          <Result icon="checkmark.circle.fill" size={18} tint={palette.success}>
            {outcome.text}
          </Result>
        ) : dismissed ? (
          <Result icon="xmark.circle" size={15} tint={palette.muted}>
            Descartado
          </Result>
        ) : expired ? (
          <Result icon="clock.badge.xmark" size={15} tint={palette.muted}>
            Esta confirmação expirou. Peça de novo ao assistente.
          </Result>
        ) : (
          <Animated.View exiting={exit} layout={layout} style={{ gap: space.xs }}>
            {outcome?.kind === "error" ? <Notice kind="error">{outcome.text}</Notice> : null}
            <Button
              title={busy === "confirmar" ? "Confirmando…" : "Confirmar"}
              icon="checkmark"
              busy={busy === "confirmar"}
              disabled={!!busy}
              onPress={() => void decide("confirmar")}
            />
            <Button
              title={busy === "descartar" ? "Descartando…" : "Descartar"}
              variant="plain"
              busy={busy === "descartar"}
              disabled={!!busy}
              onPress={() => void decide("descartar")}
            />
          </Animated.View>
        )}
      </Card>
    </Animated.View>
  );
}
