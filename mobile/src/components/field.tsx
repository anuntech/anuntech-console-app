import { useState, type ComponentRef, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { SymbolView } from "@/components/symbol";
import { fonts, rounded, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** The red line under an invalid field: icon plus words, never color alone. */
function FieldError({ message }: { message: string }) {
  const palette = usePalette();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <SymbolView name="exclamationmark.circle.fill" size={14} tintColor={palette.destructive} accessible={false} />
      <Text variant="caption" tone="destructive" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

/**
 * A labelled input. The label is drawn but VoiceOver hears it from the input,
 * with the hint (or the error) and ", inválido" when it is wrong. Focus and
 * error draw a 2pt border; the padding shrinks by 1 so the text never moves.
 */
export function Field({
  label,
  hint,
  invalid,
  error,
  style,
  ref,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  invalid?: boolean;
  /** The message under an invalid field; implies `invalid`. */
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  const wrong = invalid || !!error;
  const thick = wrong || focused;
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" accessible={false}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={wrong ? `${label}, inválido` : label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={palette.muted}
        maxFontSizeMultiplier={2}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          {
            minHeight: 50,
            ...rounded(12),
            borderWidth: thick ? 2 : 1,
            borderColor: wrong ? palette.destructive : focused ? palette.primary : palette.fieldBorder,
            backgroundColor: palette.field,
            paddingHorizontal: thick ? 13 : 14,
            paddingVertical: thick ? 11 : 12,
            fontFamily: fonts.regular,
            fontSize: 17,
            color: palette.foreground,
            // Explicit defaults: iOS recycles native inputs, and a field
            // reused after another one kept its spacing and centering.
            letterSpacing: 0,
            textAlign: "left",
          },
          style,
        ]}
        {...props}
      />
      {error ? <FieldError message={error} /> : null}
      {hint && !error ? (
        <Text variant="caption" tone="muted" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const LENGTH = 6;

/**
 * The 6-digit code: six boxes drawn over one invisible input, so the
 * keyboard's one-time-code suggestion and paste fill all of them at once.
 */
export function CodeField({
  value,
  onChange,
  label = "Código de acesso",
  invalid,
  error,
  autoFocus = true,
  testID = "code",
}: {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  invalid?: boolean;
  error?: string;
  autoFocus?: boolean;
  /** For the e2e tests; a screen with two codes names each. */
  testID?: string;
}) {
  const palette = usePalette();
  const [focused, setFocused] = useState(autoFocus);
  const wrong = invalid || !!error;
  const active = Math.min(value.length, LENGTH - 1);
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" accessible={false}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {Array.from({ length: LENGTH }, (_, i) => {
          const current = focused && i === active;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 48,
                height: 56,
                ...rounded(12),
                borderWidth: current || wrong ? 2 : 1,
                borderColor: wrong ? palette.destructive : current ? palette.primary : palette.fieldBorder,
                backgroundColor: palette.field,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {value[i] ? (
                <Text variant="title" maxFontSizeMultiplier={1.2} style={{ fontVariant: ["tabular-nums"] }}>
                  {value[i]}
                </Text>
              ) : current ? (
                <View style={{ width: 2, height: 24, borderRadius: 1, backgroundColor: palette.primary }} />
              ) : null}
            </View>
          );
        })}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, LENGTH))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          autoFocus={autoFocus}
          caretHidden
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={wrong ? `${label}, inválido` : label}
          accessibilityHint={error ?? "6 números"}
          accessibilityValue={{ text: value.split("").join(" ") }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.02,
            color: "transparent",
            fontSize: 17,
            letterSpacing: 0,
            textAlign: "left",
          }}
        />
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}
