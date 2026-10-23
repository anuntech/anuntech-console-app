import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { SymbolView } from "@/components/symbol";
import type { api } from "@/lib/api";
import { when } from "@/lib/format";
import { diffSummary, diffWords } from "@/lib/word-diff";
import type { ToneName } from "@/lib/status";
import { rounded, space, usePalette } from "@/lib/theme";
import { Pill } from "./pill";
import { Text } from "./text";

type Detail = Awaited<ReturnType<typeof api.contracts.get>>;
export type ContractBlock = Detail["blocks"][number];
export type ChangeRequest = Detail["review"]["requests"][number];

const requestTones: Record<ChangeRequest["status"], ToneName> = {
  draft: "neutral",
  pending: "attention",
  accepted: "good",
  declined: "danger",
};

/** How a request names its block, as the web's blockLabel: "Cláusula 3.2", "Contratante", "Parágrafo". */
export function blockLabel(block: ContractBlock) {
  if (block.type === "clause" && block.number) return `Cláusula ${block.number}`;
  if (block.type === "party" && block.label) return block.label.charAt(0) + block.label.slice(1).toLowerCase();
  return "Parágrafo";
}

/** One block of the text, set like the web's ContractText: title, headings, parties and numbered clauses. */
function BlockText({ block, removed }: { block: ContractBlock; removed: boolean }) {
  const strike = removed ? ({ textDecorationLine: "line-through" } as const) : null;
  const tone = removed ? "muted" : "foreground";
  switch (block.type) {
    case "title":
      return (
        <Text variant="headline" tone={tone} accessibilityRole="header" selectable style={[{ textAlign: "center", textTransform: "uppercase" }, strike]}>
          {block.text}
        </Text>
      );
    case "heading":
      return (
        <Text variant="label" tone={tone} accessibilityRole="header" selectable style={[{ textTransform: "uppercase", marginTop: space.sm }, strike]}>
          {block.text}
        </Text>
      );
    case "party":
      return (
        <Text tone={tone} selectable style={[{ lineHeight: 26 }, strike]}>
          <Text variant="label" tone={tone}>
            {block.label}:
          </Text>{" "}
          {block.text}
        </Text>
      );
    case "clause":
      return (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Text tone="muted" style={[{ width: 40, lineHeight: 26, fontVariant: ["tabular-nums"] }, strike]}>
            {block.number}
          </Text>
          <Text tone={tone} selectable style={[{ flex: 1, lineHeight: 26 }, strike]}>
            {block.text}
          </Text>
        </View>
      );
    default:
      return (
        <Text tone={tone} selectable style={[{ lineHeight: 26 }, strike]}>
          {block.text}
        </Text>
      );
  }
}

/**
 * The contract as blocks. With `marked`, what changed since the previous
 * version gets a violet bar in the margin and what left the text stays
 * struck through, as on the web. `onRequest` puts a "pedir alteração"
 * button beside each clause; `under` draws a block's requests below it.
 */
export function ContractBlocks({
  blocks,
  marked,
  onRequest,
  under,
}: {
  blocks: ContractBlock[];
  marked: boolean;
  onRequest?: (block: ContractBlock) => void;
  under?: (block: ContractBlock) => ReactNode;
}) {
  const palette = usePalette();
  return (
    <View style={{ gap: space.md }}>
      {blocks.map((block, position) => {
        const removed = block.change === "removed";
        if (removed && !marked) return null;
        const changed = marked && block.change === "added";
        const ask = onRequest && block.requestable && block.index !== null;
        const extra = under?.(block);
        const label = blockLabel(block);
        return (
          <View
            key={block.index ?? `removed-${position}`}
            style={
              changed || removed
                ? {
                    marginLeft: -space.md,
                    paddingLeft: space.md - 3,
                    borderLeftWidth: 3,
                    borderLeftColor: removed ? palette.destructiveEdge : palette.primary,
                    backgroundColor: changed ? palette.accent : undefined,
                    paddingVertical: 2,
                    gap: space.sm,
                  }
                : { gap: space.sm }
            }
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
              <View
                style={{ flex: 1 }}
                accessible
                accessibilityLabel={`${removed ? "Removido nesta versão: " : changed ? "Mudou nesta versão: " : ""}${
                  block.type === "clause" ? `${block.number} ` : block.type === "party" ? `${block.label}: ` : ""
                }${block.text}`}
              >
                <BlockText block={block} removed={removed} />
              </View>
              {ask ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Pedir alteração em ${label}`}
                  hitSlop={8}
                  onPress={() => onRequest(block)}
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed ? palette.fill : palette.primaryTint,
                  })}
                >
                  <SymbolView name="text.bubble" size={15} tintColor={palette.primary} accessible={false} />
                </Pressable>
              ) : null}
            </View>
            {extra}
          </View>
        );
      })}
    </View>
  );
}

/** What the proposed text keeps, drops (struck, red) and adds (green), word by word, as the web's ProposalDiff. */
function ProposalDiff({ before, after }: { before: string; after: string }) {
  const palette = usePalette();
  const parts = diffWords(before, after);
  const summary = diffSummary(parts);
  return (
    <Text variant="subhead" selectable accessibilityLabel={summary ? `${after}. Em relação ao texto atual: ${summary}.` : after}>
      {parts.map((part, index) =>
        part.change === "removed" ? (
          <Text
            key={index}
            variant="subhead"
            style={{ color: palette.destructive, backgroundColor: palette.destructiveSoft, textDecorationLine: "line-through" }}
          >
            {part.text}
          </Text>
        ) : part.change === "added" ? (
          <Text key={index} variant="subhead" style={{ color: palette.success, backgroundColor: palette.successSoft }}>
            {part.text}
          </Text>
        ) : (
          <Text key={index} variant="subhead">
            {part.text}
          </Text>
        ),
      )}
    </Text>
  );
}

/** One request: where (when asked), its situation, why, the text proposed and Anuntech's answer. */
export function RequestCard({
  request,
  showLabel = false,
  actions,
}: {
  request: ChangeRequest;
  /** The block's name; left out under the block itself, where it is obvious. */
  showLabel?: boolean;
  actions?: ReactNode;
}) {
  const palette = usePalette();
  const at = request.submittedAt ?? request.createdAt;
  return (
    <View
      style={{
        gap: space.sm,
        padding: space.md,
        ...rounded(16),
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.card,
      }}
    >
      <View
        accessible
        accessibilityLabel={[showLabel ? request.label : null, request.statusLabel, `${request.author}, ${when(at)}`, request.comment].filter(Boolean).join(", ")}
        style={{ gap: space.sm }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
          {showLabel ? <Text variant="label">{request.label}</Text> : null}
          <Pill label={request.statusLabel} tone={requestTones[request.status]} />
        </View>
        <Text variant="caption" tone="muted">
          {request.author} · {when(at)}
        </Text>
        <Text variant="subhead" selectable>
          {request.comment}
        </Text>
      </View>
      {request.proposedText ? (
        <View style={{ gap: space.xs, padding: space.sm, ...rounded(10), backgroundColor: palette.secondary }}>
          <Text variant="caption" tone="muted">
            Texto proposto
          </Text>
          <ProposalDiff before={request.excerpt} after={request.proposedText} />
        </View>
      ) : null}
      {request.response || request.applied ? (
        <View style={{ gap: 2, paddingLeft: space.sm, borderLeftWidth: 2, borderLeftColor: palette.infoEdge }}>
          <Text variant="caption" tone="muted">
            Resposta da Anuntech{request.applied ? " · texto aplicado na versão seguinte" : ""}
          </Text>
          {request.response ? (
            <Text variant="subhead" selectable>
              {request.response}
            </Text>
          ) : null}
        </View>
      ) : null}
      {actions ? <View style={{ flexDirection: "row", gap: space.sm }}>{actions}</View> : null}
    </View>
  );
}
