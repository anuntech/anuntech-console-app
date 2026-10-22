import { View } from "react-native";
import { roleTone, type Person } from "@/lib/manager";
import { Pill } from "./pill";
import { Text } from "./text";

/** Role, then the state the web shows next to it: amber while the invite waits, what a Membro sees. */
export function PersonMeta({ person }: { person: Person }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
      {person.self ? <Pill label="Você" tone="good" /> : null}
      <Pill label={person.roleLabel} tone={roleTone(person.role)} />
      {person.pending ? (
        <Text variant="caption" tone="warning">
          {person.statusLabel}
        </Text>
      ) : null}
      {person.role === "member" ? (
        <Text variant="caption" tone="muted">
          {person.scopeLabel}
        </Text>
      ) : null}
    </View>
  );
}

/** What VoiceOver reads for a person's row. */
export function personLabel(person: Person) {
  return [
    person.name ?? person.email,
    person.name ? person.email : null,
    person.self ? "Você" : null,
    person.roleLabel,
    person.pending ? person.statusLabel : null,
    person.role === "member" ? person.scopeLabel : null,
  ]
    .filter(Boolean)
    .join(", ");
}
