import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { ListRow } from "@/components/list-row";
import { Pill } from "@/components/pill";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { IconTile } from "@/components/tile";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { openConsole } from "@/lib/console-web";
import { useTabBarSpace } from "@/lib/layout";
import { mailKey, quotaLine } from "@/lib/mail";
import { space } from "@/lib/theme";

/**
 * The company's e-mail, opened by its e-mail product (mail.mailboxes), as the
 * web's /email: the team and the Administrador see every mailbox of one of
 * the company's domains, a Membro only their own. A mailbox opens its space,
 * the password and the devices' setup; creating, editing, deleting, forwards,
 * adding a domain and the DNS are on the web, one tap away.
 */
export default function CompanyMail() {
  const { company } = useLocalSearchParams<{ company: string }>();
  const bottom = useTabBarSpace();
  const [domain, setDomain] = useState<string | undefined>();
  const mail = useQuery({ queryKey: mailKey(company, domain), queryFn: () => api.mail.mailboxes({ companyId: company, domain }) });
  const loading = useDelayed(mail.isPending);
  const data = mail.data;
  const manages = data ? data.role !== "member" : false;
  const pending = data?.pendingDomains ?? [];
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={mail.isRefetching} onRefresh={() => void mail.refetch()} />}
    >
      {loading ? <SkeletonRows count={4} inset={48} /> : null}
      {mail.error ? (
        <View style={{ gap: space.md }}>
          <Notice kind="error">{errorMessage(mail.error)}</Notice>
          <Button title="Tentar de novo" variant="secondary" onPress={() => void mail.refetch()} />
        </View>
      ) : null}
      {data ? (
        <>
          <View style={{ gap: space.xs }}>
            <Text variant="caption" tone="muted">
              {data.company}
            </Text>
            <Text tone="muted">
              {manages
                ? "As caixas do domínio, com o espaço usado. Ler e enviar fica no aplicativo de e-mail de cada pessoa."
                : "A sua caixa da empresa. Ler e enviar fica no seu aplicativo de e-mail."}
            </Text>
          </View>
          {manages && data.domains.length > 1 ? (
            <FilterChips
              group="Domínio"
              options={data.domains.map((value) => ({ value, label: value }))}
              value={data.domain ?? data.domains[0]}
              onChange={setDomain}
            />
          ) : null}
          {pending.length ? (
            <Section header="Esperando a confirmação" footer="Crie no DNS do domínio o registro que o Console mostra e confira lá. Depois disso, as caixas já podem ser criadas.">
              {pending.map((name) => (
                <ListRow
                  key={name}
                  leading={<IconTile icon="hourglass" color="amber" />}
                  title={name}
                  subtitle="Falta a prova de posse"
                  trailing="external"
                  onPress={() => void openConsole(`/email/dns?dominio=${encodeURIComponent(name)}&empresa=${company}`)}
                />
              ))}
            </Section>
          ) : null}
          {!data.domains.length ? (
            pending.length ? null : (
              <EmptyState
                icon="envelope"
                title="Nenhum domínio de e-mail ainda"
                text={
                  data.canAddDomain
                    ? "Adicione o domínio da empresa no Console na web: ele mostra os registros para publicar no DNS do domínio e confere se ficaram certos."
                    : manages && data.canAddDomain === false
                      ? "Contrate o e-mail em Produtos no Console na web para adicionar o domínio."
                      : manages
                        ? "A empresa ainda não tem um domínio no servidor de e-mail da Anuntech. Abra um chamado para a equipe preparar o domínio."
                        : "A empresa ainda não tem um domínio de e-mail. Peça ao Administrador da empresa."
                }
                action={
                  data.canAddDomain
                    ? { label: "Adicionar domínio", icon: "plus", onPress: () => void openConsole(`/email?empresa=${company}`) }
                    : // An older Console without canAddDomain: the team prepares the domain, as before.
                      manages && data.canAddDomain === undefined
                      ? { label: "Abrir chamado", icon: "square.and.pencil", onPress: () => router.push("/chamados/novo") }
                      : undefined
                }
              />
            )
          ) : !data.mailboxes.length ? (
            <EmptyState
              icon="envelope"
              title={manages ? "Nenhuma caixa ainda" : "Nenhuma caixa ligada a você"}
              text={
                manages
                  ? "Crie a primeira caixa do domínio no Console na web."
                  : "Sua caixa aparece aqui quando o endereço dela é um dos e-mails da sua conta. Peça ao Administrador da empresa."
              }
            />
          ) : (
            <Section header={manages ? (data.domain ?? undefined) : undefined}>
              {data.mailboxes.map((box) => {
                const quota = quotaLine(box.usedBytes, box.quotaBytes);
                return (
                  <ListRow
                    key={box.id}
                    leading={<IconTile icon="envelope.fill" color={quota.percent !== null && quota.percent >= 95 ? "red" : "violet"} />}
                    title={box.address}
                    subtitle={[box.name, quota.label].filter(Boolean).join(" · ")}
                    meta={!box.managed ? <Pill label="Gerenciada no servidor" /> : box.own && manages ? <Pill label="Sua caixa" tone="good" /> : undefined}
                    trailing={box.managed ? "chevron" : "none"}
                    accessibilityLabel={[box.address, box.name, quota.label, box.managed ? null : "Gerenciada no servidor"].filter(Boolean).join(", ")}
                    onPress={
                      box.managed
                        ? () => router.push({ pathname: "/produtos/email/caixa", params: { company, id: box.id, ...(domain ? { domain } : {}) } })
                        : undefined
                    }
                  />
                );
              })}
            </Section>
          )}
          {manages && data.domains.length ? (
            <Section footer="Criar, editar e excluir caixas, os redirecionamentos e a saúde do DNS ficam no Console na web.">
              <ListRow
                leading={<IconTile icon="safari" color="gray" />}
                title="Gerenciar no Console"
                trailing="external"
                onPress={() => void openConsole(`/email?${data.domain ? `dominio=${encodeURIComponent(data.domain)}` : `empresa=${company}`}`)}
              />
            </Section>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
