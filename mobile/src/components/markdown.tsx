import type { ReactNode } from "react";
import { View } from "react-native";
import { space } from "@/lib/theme";
import { Text } from "./text";

/*
 * The little Markdown the assistant writes: paragraphs, "- " and "1. " lists,
 * "#" titles, **bold**, `code` and [links](/path). Anything else shows as
 * plain text. Links go to onLink, which decides between a screen of the app
 * and the browser.
 */

const inline = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function Inline({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(inline)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    if (token.startsWith("**")) {
      parts.push(
        <Text key={at} variant="label" style={{ fontSize: 16, lineHeight: 24 }}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (token.startsWith("`")) {
      parts.push(token.slice(1, -1));
    } else {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? [];
      parts.push(
        <Text key={at} tone="primary" accessibilityRole="link" onPress={() => onLink(href)} style={{ textDecorationLine: "underline" }}>
          {label}
        </Text>,
      );
    }
    last = at + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function Markdown({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <View style={{ gap: space.sm }}>
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((line) => line.trim());
        const list = lines.length > 0 && lines.every((line) => /^\s*([-*]|\d+\.)\s+/.test(line));
        if (list)
          return (
            <View key={b} style={{ gap: space.xs }}>
              {lines.map((line, i) => {
                const marker = line.match(/^\s*(\d+\.)/)?.[1] ?? "•";
                return (
                  <View key={i} style={{ flexDirection: "row", gap: space.sm }}>
                    <Text tone="muted">{marker}</Text>
                    <Text selectable style={{ flex: 1 }}>
                      <Inline text={line.replace(/^\s*([-*]|\d+\.)\s+/, "")} onLink={onLink} />
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        const heading = block.match(/^#{1,6}\s+(.*)$/);
        if (heading)
          return (
            <Text key={b} variant="label" accessibilityRole="header" style={{ fontSize: 16 }}>
              {heading[1]}
            </Text>
          );
        return (
          <Text key={b} selectable>
            <Inline text={lines.join("\n")} onLink={onLink} />
          </Text>
        );
      })}
    </View>
  );
}
