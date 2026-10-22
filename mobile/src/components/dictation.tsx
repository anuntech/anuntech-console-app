import { useEffect } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { clockLabel, PRIVACY_LINE, type Dictation } from "@/lib/dictation";
import { space, usePalette } from "@/lib/theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * The microphone inside a message box: "Falar" to record, the red square to
 * stop, a spinner while the text comes back.
 */
export function MicButton({ dictation, testID }: { dictation: Dictation; testID?: string }) {
  const palette = usePalette();
  const recording = dictation.phase === "recording";
  const waiting = dictation.busy && !recording;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={recording ? "Parar gravação" : waiting ? (dictation.phase === "starting" ? "Abrindo o microfone" : "Transcrevendo") : "Falar"}
      accessibilityHint={recording || waiting ? undefined : "Grava sua voz e escreve o texto na caixa"}
      accessibilityState={{ busy: waiting }}
      hitSlop={7}
      onPress={() => {
        if (recording) dictation.stop();
        else if (!dictation.busy) dictation.start();
      }}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: recording ? palette.destructiveSolid : pressed ? palette.fill : "transparent",
      })}
    >
      {waiting ? (
        <ActivityIndicator size="small" color={palette.muted} />
      ) : (
        <SymbolView
          name={recording ? "stop.fill" : "mic"}
          size={recording ? 13 : 18}
          weight={recording ? "bold" : "regular"}
          tintColor={recording ? palette.onDestructive : palette.muted}
          accessible={false}
        />
      )}
    </Pressable>
  );
}

/**
 * What the microphone is doing, above the box: the timer and where the audio
 * goes while it records, then the outcome, with Cancelar or Tentar de novo.
 * Nothing when there is nothing to say.
 */
export function DictationStatus({ dictation }: { dictation: Dictation }) {
  const palette = usePalette();
  const { phase, notice, busy, canRetry } = dictation;
  // VoiceOver hears each change (recording, transcribed, failed), as the web's live region.
  useEffect(() => {
    if (!notice) return;
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(notice, { queue: true });
    else AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);
  if (!notice && !busy) return null;
  const recording = phase === "recording";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: space.sm,
        paddingHorizontal: space.sm,
      }}
    >
      <View style={{ flex: 1, minWidth: 160, gap: 2 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {recording ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.destructive }} />
            <Text variant="caption">
              Gravando {clockLabel(dictation.seconds)}
              {dictation.ending ? <Text variant="caption" tone="destructive"> · Faltam 10 segundos</Text> : null}
            </Text>
          </View>
        ) : (
          <Text variant="caption" tone={phase === "error" ? "destructive" : "muted"}>
            {notice}
          </Text>
        )}
        {busy ? (
          <Text variant="caption" tone="muted">
            {PRIVACY_LINE}
          </Text>
        ) : null}
      </View>
      {busy ? <Button title="Cancelar gravação" variant="plain" size="small" onPress={dictation.cancel} /> : null}
      {canRetry ? <Button title="Tentar de novo" variant="secondary" size="small" icon="arrow.clockwise" onPress={dictation.retry} /> : null}
    </View>
  );
}

/**
 * "Falar" under a text field, as the web's DictationButton: the status on
 * the left, the button on the right (Parar while it records).
 */
export function DictationBar({ dictation, testID }: { dictation: Dictation; testID?: string }) {
  const recording = dictation.phase === "recording";
  const waiting = dictation.busy && !recording;
  if (!dictation.available) return null;
  return (
    <View style={{ gap: space.sm }}>
      <DictationStatus dictation={dictation} />
      <View style={{ alignSelf: "flex-end" }}>
        <Button
          testID={testID}
          title={recording ? "Parar" : waiting ? (dictation.phase === "starting" ? "Abrindo o microfone…" : "Transcrevendo…") : "Falar"}
          accessibilityLabel={recording ? "Parar gravação" : undefined}
          variant={recording ? "destructive" : "secondary"}
          size="small"
          icon={recording ? "stop.fill" : "mic"}
          busy={waiting}
          onPress={recording ? dictation.stop : dictation.start}
        />
      </View>
    </View>
  );
}
