import { useState } from "react";
import { View } from "react-native";
import { decideCard, type Card as ProposalCard, type PageAction } from "@/lib/assistant";
import { space } from "@/lib/theme";
import { Button } from "./button";
import { Card, Notice } from "./surface";
import { Text } from "./text";

type Outcome = { kind: "done"; text: string } | { kind: "dismissed" } | { kind: "error"; text: string };

/**
 * A change the assistant prepared: nothing happens until the person taps
 * Confirmar, and the Console checks their access again when they do.
 */
export function ProposalCardView({ card, onDone }: { card: ProposalCard; onDone: (actions: PageAction[]) => void }) {
  const [busy, setBusy] = useState<"confirmar" | "descartar" | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Checked when the card shows; the Console refuses an expired one anyway.
  const [expired] = useState(() => new Date(card.expiresAt).getTime() < Date.now());
  const decide = async (decision: "confirmar" | "descartar") => {
    setBusy(decision);
    try {
      const result = await decideCard(card, decision);
      if (decision === "descartar") setOutcome({ kind: "dismissed" });
      else {
        setOutcome({ kind: "done", text: result.summary ?? "Feito." });
        onDone(result.actions);
      }
    } catch (error) {
      setOutcome({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível concluir." });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="label">{card.title}</Text>
      {card.details.map((d) => (
        <View key={d.label} style={{ gap: 2 }}>
          <Text variant="caption" tone="muted">
            {d.label}
          </Text>
          <Text selectable>{d.value}</Text>
        </View>
      ))}
      {card.tainted ? (
        <Notice kind="info">Preparado depois de ler um texto escrito por outra pessoa. Confira antes de confirmar.</Notice>
      ) : null}
      {outcome?.kind === "done" ? (
        <Notice kind="info">{outcome.text}</Notice>
      ) : outcome?.kind === "dismissed" ? (
        <Text variant="caption" tone="muted">
          Descartado.
        </Text>
      ) : expired ? (
        <Text variant="caption" tone="muted">
          Esta confirmação expirou. Peça de novo ao assistente.
        </Text>
      ) : (
        <>
          {outcome?.kind === "error" ? <Notice kind="error">{outcome.text}</Notice> : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Descartar" variant="outline" busy={busy === "descartar"} disabled={!!busy} onPress={() => void decide("descartar")} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Confirmar" busy={busy === "confirmar"} disabled={!!busy} onPress={() => void decide("confirmar")} />
            </View>
          </View>
        </>
      )}
    </Card>
  );
}
