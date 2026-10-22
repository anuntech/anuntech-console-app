import { useRef, useState, type ComponentRef } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SymbolView } from "expo-symbols";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Card, Notice } from "@/components/surface";
import { Pill } from "@/components/pill";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { StatusTile } from "@/components/tile";
import { DocumentText } from "@/components/document-text";
import { DocumentFacts } from "@/components/document-facts";
import { ConsentRow } from "@/components/consent-row";
import { PdfRow } from "@/components/pdf-button";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDocument } from "@/lib/br-input";
import { CONSOLE_URL } from "@/lib/config";
import { civilDate, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { confirmIdentity, lockAvailable } from "@/lib/lock";
import { useMe } from "@/lib/me";
import { space, usePalette } from "@/lib/theme";
import { contractTone } from "@/lib/tones";

type Detail = Awaited<ReturnType<typeof api.contracts.get>>;
type Signature = Detail["signatures"][number];

/** One side of the contract, as the web's Party: who it is and whether (and when) it signed. */
function PartyRow({ label, who, signature, pending }: { label: string; who: string; signature?: Signature; pending: boolean }) {
  const palette = usePalette();
  const line = signature ? `${signature.name} · ${when(signature.signedAt)}` : pending ? "Aguardando assinatura" : "—";
  return (
    <ListRow
      leading={
        <SymbolView
          name={signature ? "checkmark.seal.fill" : "circle.dashed"}
          size={20}
          tintColor={signature ? palette.success : palette.tertiary}
          accessible={false}
          style={{ width: 24, height: 24 }}
        />
      }
      title={label}
      subtitle={who}
      meta={
        <Text variant="caption" tone={signature ? "foreground" : "muted"}>
          {line}
        </Text>
      }
      accessibilityLabel={`${label}, ${who}, ${line}`}
    />
  );
}

/** One contract: the text that went out, both signatures, the document's hash and, when it is the viewer's turn, signing (contracts.get, contracts.sign). */
export default function Contract() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const queryClient = useQueryClient();
  const me = useMe();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const contract = useQuery({ queryKey: ["contract", id], queryFn: () => api.contracts.get({ id }) });
  const loading = useDelayed(contract.isPending);
  const [consent, setConsent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [signedMessage, setSignedMessage] = useState<string | null>(null);
  const sign = useMutation({
    mutationFn: () => api.contracts.sign({ id, consent: true }),
    onSuccess: async ({ message }) => {
      haptic.success();
      setSignedMessage(message);
      setConsent(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contract", id] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
    onError: () => haptic.error(),
  });
  const c = contract.data;
  // The API sends the kind only as its label: "Contrato" or "Aditivo".
  const amendment = c?.kindLabel === "Aditivo";
  const noun = amendment ? "aditivo" : "contrato";
  const signer = me.data ? me.data.name.trim() || me.data.email : "";
  const busy = confirming || sign.isPending;
  const signedBy = (party: "client" | "anuntech") => c?.signatures.find((s) => s.party === party);

  const submit = async () => {
    if (!consent || busy) return;
    haptic.medium();
    sign.reset();
    setConfirming(true);
    try {
      // Face ID is only a local check that the phone's owner is the one signing;
      // the Console's proof is the session opened with a code, as on the web.
      const available = await lockAvailable().catch(() => false);
      if (available && !(await confirmIdentity(amendment ? "Assinar o aditivo" : "Assinar o contrato").catch(() => false))) return;
    } finally {
      setConfirming(false);
    }
    sign.mutate();
  };

  const description = !c
    ? null
    : c.status === "signed"
      ? `Versão assinada${c.version && c.version > 1 ? ` (${c.version}ª)` : ""}. O hash abaixo identifica este texto.`
      : c.status === "in_review"
        ? `Versão ${c.version ?? 1}, como foi enviada. Os pedidos de alteração estão com a Anuntech.`
        : c.status === "sent"
          ? "Texto enviado para assinatura. Não muda mais."
          : null;

  return (
    <ScrollView
      ref={scroll}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={contract.isRefetching} onRefresh={() => void contract.refetch()} />}
    >
      {loading ? (
        <>
          <SkeletonHeader />
          <SkeletonRows count={2} inset={0} />
        </>
      ) : null}
      {contract.error ? <Notice kind="error">{errorMessage(contract.error)}</Notice> : null}
      {c ? (
        <>
          <View style={{ gap: space.sm }}>
            <Pill label={c.statusLabel} tone={contractTone(c.status)} />
            <Text variant="title" accessibilityRole="header">
              {c.title}
            </Text>
            <Text variant="subhead" tone="muted">
              {[c.kindLabel, c.company, c.engagement].filter(Boolean).join(" · ")}
            </Text>
            {c.startsAt ? (
              <Text variant="caption" tone="muted">
                Vigência {civilDate(c.startsAt)}
                {c.endsAt ? ` a ${civilDate(c.endsAt)}` : " por prazo indeterminado"}
              </Text>
            ) : null}
          </View>
          {c.canSign ? (
            <Card raised tone="warning">
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <StatusTile icon="signature" tone="attention" />
                <Text variant="subhead" style={{ flex: 1 }}>
                  Leia o {noun} até o fim. A assinatura fica logo depois do texto.
                </Text>
              </View>
              <Button
                title="Ir para a assinatura"
                variant="secondary"
                trailingIcon="arrow.down"
                onPress={() => scroll.current?.scrollToEnd({ animated: true })}
              />
            </Card>
          ) : null}
          {c.status !== "draft" ? (
            <Section
              header="Assinaturas"
              indent={52}
              footer={
                c.status === "signed"
                  ? "Assinado pelas duas partes."
                  : c.status === "sent"
                    ? "Cada parte assina com o próprio acesso ao Console."
                    : c.status === "in_review"
                      ? "Disponíveis quando a nova versão chegar."
                      : undefined
              }
            >
              <PartyRow
                label="Contratante"
                who={c.companyDocument ? `${c.company} · ${formatDocument(c.companyDocument)}` : c.company}
                signature={signedBy("client")}
                pending={c.status === "sent"}
              />
              <PartyRow label="Contratada" who="Anuntech" signature={signedBy("anuntech")} pending={c.status === "sent"} />
            </Section>
          ) : null}
          <Section>
            <PdfRow path={c.pdfPath} name={`${c.title}.pdf`} title={c.status === "signed" ? "Baixar PDF assinado" : "Baixar PDF"} />
          </Section>
          <Section header={amendment ? "Texto do aditivo" : "Texto do contrato"}>
            <View style={{ padding: 20, gap: space.lg }}>
              {description ? (
                <Text variant="caption" tone="muted">
                  {description}
                </Text>
              ) : null}
              <DocumentText body={c.body} />
            </View>
          </Section>
          {signedMessage || c.canSign ? (
            <View style={{ gap: space.block }}>
              {signedMessage ? (
                <Notice kind="success" title={amendment ? "Aditivo assinado" : "Contrato assinado"}>
                  {signedMessage}
                </Notice>
              ) : null}
              {c.canSign && c.party ? (
                <Card raised tone="warning" style={{ gap: space.lg }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                    <StatusTile icon="signature" tone="attention" />
                    <Text variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
                      {amendment ? "Assinar o aditivo" : "Assinar o contrato"}
                    </Text>
                  </View>
                  <ConsentRow
                    testID="sign-consent"
                    checked={consent}
                    onChange={setConsent}
                    disabled={busy || !signer}
                    label={`Li o ${noun} e concordo com todos os termos, assinando como ${signer}${c.party === "client" ? ` por ${c.company}` : " pela Anuntech"}.`}
                  >
                    Li o {noun} e concordo com todos os termos, assinando como <Text variant="label">{signer}</Text>
                    {c.party === "client" ? ` por ${c.company}` : " pela Anuntech"}.
                  </ConsentRow>
                  {sign.error ? <Notice kind="error">{errorMessage(sign.error)}</Notice> : null}
                  <View style={{ gap: space.sm }}>
                    <Button
                      testID="sign-contract"
                      title={sign.isPending ? "Assinando…" : amendment ? "Assinar aditivo" : "Assinar contrato"}
                      icon="signature"
                      busy={busy}
                      disabled={!consent || !signer}
                      onPress={() => void submit()}
                    />
                    <Text variant="caption" tone="muted">
                      Ficam registrados seu nome, e-mail, data, IP e o hash do texto.
                    </Text>
                  </View>
                  {c.party === "client" ? (
                    // Requests per clause stay on the web: they hang on each clause of the text.
                    <Button
                      title="Pedir alteração no navegador"
                      variant="plain"
                      size="small"
                      trailingIcon="arrow.up.right"
                      accessibilityHint="Abre no navegador"
                      disabled={busy}
                      onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}/contratos/${c.id}`)}
                    />
                  ) : null}
                </Card>
              ) : null}
            </View>
          ) : null}
          {c.documentHash ? <DocumentFacts hash={c.documentHash} version={c.version} /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}
