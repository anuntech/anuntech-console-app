import type { ComponentRef, Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { fonts, radius, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

/** A labelled input with the Console's field colors; `hint` sits below. */
export function Field({
  label,
  hint,
  invalid,
  style,
  ref,
  ...props
}: TextInputProps & { label: string; hint?: string; invalid?: boolean; ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const palette = usePalette();
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={palette.muted}
        style={[
          {
            minHeight: 48,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: invalid ? palette.destructive : palette.fieldBorder,
            backgroundColor: palette.field,
            paddingHorizontal: space.md,
            fontFamily: fonts.regular,
            fontSize: 16,
            color: palette.foreground,
            // Explicit defaults: iOS recycles native inputs, and a field
            // reused after the code field kept its spacing and centering.
            letterSpacing: 0,
            textAlign: "left",
          },
          style,
        ]}
        {...props}
      />
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** The 6-digit code: one field, filled by the keyboard's one-time-code suggestion. */
export function CodeField({
  value,
  onChange,
  label = "Código de acesso",
  invalid,
  autoFocus = true,
}: {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 6))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      autoFocus={autoFocus}
      invalid={invalid}
      testID="code"
      placeholder="000000"
      style={{ fontSize: 24, letterSpacing: 8, textAlign: "center" }}
    />
  );
}
