import { ListRow } from "./list-row";
import { Section } from "./section";
import { IconTile } from "./tile";
import { TEAM_WHATSAPP, leaveHelpTo, talkToTeam } from "@/lib/help-routes";

/**
 * "Não encontrou o que procurava?": the assistant, a ticket of the Dúvida
 * kind, or the team on WhatsApp, as at the end of the web's help pages.
 */
export function NotFoundHelp({ canOpenTicket }: { canOpenTicket: boolean }) {
  return (
    <Section header="Não encontrou o que procurava?">
      <ListRow
        title="Perguntar ao assistente"
        leading={<IconTile icon="sparkles" color="violet" />}
        onPress={() => leaveHelpTo("/assistente")}
      />
      {canOpenTicket ? (
        <ListRow
          title="Abrir chamado"
          subtitle="Uma dúvida para a equipe"
          leading={<IconTile icon="square.and.pencil" color="ink" />}
          onPress={() => leaveHelpTo({ pathname: "/chamados/novo", params: { kind: "question" } })}
        />
      ) : null}
      <ListRow
        title="Conversar com a equipe"
        subtitle={`WhatsApp ${TEAM_WHATSAPP.label}, em dias úteis`}
        leading={<IconTile icon="message.fill" color="green" />}
        trailing="external"
        accessibilityHint="Abre o WhatsApp"
        onPress={talkToTeam}
      />
    </Section>
  );
}
