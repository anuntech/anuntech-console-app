import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { api } from "@/lib/api";
import { enter } from "@/lib/motion";
import { rounded, space, usePalette } from "@/lib/theme";
import { Text } from "./text";

type Article = Awaited<ReturnType<typeof api.help.get>>;
export type HelpBlock = Article["sections"][number]["blocks"][number];
export type HelpSection = { title: string; blocks: HelpBlock[] };

/** A Console path tapped in a help text. */
export type OnLink = (href: string) => void;

/** The glyph of each help subject, close to the web's (lib/help categories). */
export const CATEGORY_SYMBOLS: Record<string, SFSymbol> = {
  comecar: "flag.fill",
  conta: "person.crop.circle.fill",
  chamados: "bubble.left.and.bubble.right.fill",
  projetos: "folder.fill",
  produtos: "shippingbox.fill",
  financeiro: "creditcard.fill",
  orcamentos: "doc.text.fill",
  contratos: "signature",
  condicoes: "clock.fill",
  pessoas: "person.2.fill",
  bookmarks: "bookmark.fill",
  assistente: "sparkles",
  seguranca: "lock.shield.fill",
};

/** "[rótulo](/caminho)" split for rendering; only Console paths become links (lib/help/help-model.ts splitLinks). */
export function splitLinks(text: string): ({ text: string } | { label: string; href: string })[] {
  const parts: ({ text: string } | { label: string; href: string })[] = [];
  const pattern = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ label: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** A help text with its links, inline: each link is a tappable word in the brand color. */
export function HelpText({
  text,
  onLink,
  tone = "foreground",
  variant = "body",
}: {
  text: string;
  onLink: OnLink;
  tone?: "foreground" | "muted";
  variant?: "body" | "subhead";
}) {
  const parts = splitLinks(text);
  return (
    <Text variant={variant} tone={tone} style={variant === "body" ? { lineHeight: 25 } : undefined}>
      {parts.map((part, i) =>
        "text" in part ? (
          part.text
        ) : (
          <Text
            key={i}
            variant={variant}
            tone="primary"
            accessibilityRole="link"
            accessibilityHint="Abre o link"
            onPress={() => onLink(part.href)}
            suppressHighlighting={false}
          >
            {part.label}
          </Text>
        ),
      )}
    </Text>
  );
}

function Bulleted({ marker, children }: { marker: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
      {marker}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/** One block of an article or of the guide: paragraph, list, steps, term and meaning, or a note. */
export function HelpBlockView({ block, onLink }: { block: HelpBlock; onLink: OnLink }) {
  const palette = usePalette();
  if (block.kind === "p") return <HelpText text={block.text} onLink={onLink} />;
  if (block.kind === "note") {
    const attention = block.tone === "attention";
    return (
      <View
        accessible
        accessibilityLabel={`${attention ? "Atenção" : "Observação"}: ${block.text.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")}`}
        style={{
          flexDirection: "row",
          gap: 10,
          padding: 14,
          ...rounded(16),
          borderWidth: 1,
          borderColor: attention ? palette.warningEdge : palette.infoEdge,
          backgroundColor: attention ? palette.warningSoft : palette.accent,
        }}
      >
        <SymbolView
          name={attention ? "exclamationmark.triangle.fill" : "info.circle.fill"}
          size={17}
          tintColor={attention ? palette.warning : palette.primary}
          accessible={false}
          style={{ marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <HelpText text={block.text} onLink={onLink} variant="subhead" />
        </View>
      </View>
    );
  }
  if (block.kind === "list")
    return (
      <View style={{ gap: space.sm }}>
        {block.items.map((item) => (
          <Bulleted key={item} marker={<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.tertiary, marginTop: 10 }} />}>
            <HelpText text={item} onLink={onLink} />
          </Bulleted>
        ))}
      </View>
    );
  if (block.kind === "steps")
    return (
      <View style={{ gap: space.md }}>
        {block.items.map((item, i) => (
          <Bulleted
            key={item}
            marker={
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                <Text variant="micro" tone="primary" accessibilityLabel={`Passo ${i + 1}`}>
                  {i + 1}
                </Text>
              </View>
            }
          >
            <HelpText text={item} onLink={onLink} />
          </Bulleted>
        ))}
      </View>
    );
  return (
    <View style={{ gap: space.md }}>
      {block.items.map((item) => (
        <View key={item.term} style={{ gap: 2 }}>
          <Text variant="label">{item.term}</Text>
          <HelpText text={item.text} onLink={onLink} tone="muted" variant="subhead" />
        </View>
      ))}
    </View>
  );
}

/** An article's (or the guide's) sections: a heading and its blocks. */
export function HelpSections({ sections, onLink }: { sections: HelpSection[]; onLink: OnLink }) {
  return (
    <View style={{ gap: space.xl }}>
      {sections.map((section) => (
        <View key={section.title} style={{ gap: space.md }}>
          <Text variant="heading" accessibilityRole="header">
            {section.title}
          </Text>
          {section.blocks.map((block, i) => (
            <HelpBlockView key={i} block={block} onLink={onLink} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** One question that opens to its answer; `more` adds a link under it ("Ler o artigo"). */
function FaqItem({ q, a, onLink, more }: { q: string; a: string; onLink: OnLink; more?: { label: string; onPress: () => void } }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={q}
        onPress={() => setOpen((v) => !v)}
        android_ripple={{ color: palette.fill }}
        style={({ pressed }) => ({
          minHeight: space.row,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          backgroundColor: pressed ? palette.fill : "transparent",
        })}
      >
        <Text variant="body" style={{ flex: 1 }}>
          {q}
        </Text>
        <SymbolView name={open ? "chevron.up" : "chevron.down"} size={13} weight="semibold" tintColor={palette.tertiary} accessible={false} />
      </Pressable>
      {open ? (
        <Animated.View entering={enter} style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
          <HelpText text={a} onLink={onLink} tone="muted" variant="subhead" />
          {more ? (
            <Pressable accessibilityRole="link" hitSlop={8} onPress={more.onPress} style={{ alignSelf: "flex-start" }}>
              <Text variant="label" tone="primary">
                {more.label}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** "Perguntas frequentes": each question opens in place. */
export function FaqList({
  faq,
  onLink,
  more,
}: {
  faq: { q: string; a: string; slug?: string }[];
  onLink: OnLink;
  more?: (item: { slug?: string }) => { label: string; onPress: () => void } | undefined;
}) {
  const palette = usePalette();
  if (!faq.length) return null;
  return (
    <View style={{ backgroundColor: palette.card, ...rounded(24), overflow: "hidden", ...(palette.dark ? { borderWidth: 1, borderColor: palette.border } : {}) }}>
      {faq.map((item, i) => (
        <View key={item.q}>
          {i > 0 ? <View style={{ marginLeft: space.lg, height: 0.5, backgroundColor: palette.separator }} /> : null}
          <FaqItem q={item.q} a={item.a} onLink={onLink} more={more?.(item)} />
        </View>
      ))}
    </View>
  );
}
