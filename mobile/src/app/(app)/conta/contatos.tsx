import { RefreshControl, ScrollView } from "react-native";
import { router } from "expo-router";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { IconTile } from "@/components/tile";
import { errorMessage } from "@/lib/api";
import { formatPhone } from "@/lib/config";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { space, usePalette } from "@/lib/theme";

/**
 * "Contatos de acesso" of Minha conta: the main e-mail and the WhatsApp that
 * sign in. With the second step on, both are locked (a rule in the database too).
 */
export default function Contacts() {
  const palette = usePalette();
  const me = useMe();
  const bottom = useTabBarSpace();
  const loading = useDelayed(me.isPending);
  const locked = !!me.data?.twoFactorEnabled;
  const phone = me.data?.phone ?? null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => void me.refetch()} />}
    >
      {me.error ? <Notice kind="error">{errorMessage(me.error)}</Notice> : null}
      {loading ? <SkeletonRows count={2} inset={0} /> : null}
      {me.data ? (
        <>
          {locked ? (
            <Notice kind="warning">
              Com a verificação em duas etapas ativa, e-mail e WhatsApp ficam protegidos. Desative em Segurança para
              alterá-los.
            </Notice>
          ) : null}
          <Section footer="Por onde você entra e recebe os códigos.">
            <ListRow
              testID="contact-email"
              title="E-mail de acesso"
              subtitle={me.data.email}
              leading={<IconTile icon="envelope.fill" color="violet" />}
              accessibilityHint={locked ? undefined : "Alterar o e-mail de acesso"}
              onPress={locked ? undefined : () => router.push("/conta/email")}
            />
            <ListRow
              testID="contact-whatsapp"
              title="WhatsApp"
              subtitle={phone ? formatPhone(phone) : "Não vinculado"}
              meta={!phone && !locked ? "Vincule para entrar por código no WhatsApp." : undefined}
              leading={<IconTile icon="message.fill" color="green" />}
              accessibilityHint={locked ? undefined : phone ? "Alterar ou remover o WhatsApp" : "Vincular o WhatsApp"}
              onPress={locked ? undefined : () => router.push("/conta/whatsapp")}
            />
          </Section>
          {locked ? (
            <Section>
              <ListRow
                title="Abrir Segurança"
                leading={<IconTile icon="lock.shield.fill" color="green" />}
                onPress={() => router.push("/conta/seguranca")}
              />
            </Section>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
