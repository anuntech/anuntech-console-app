import { useRef, useState, type ComponentRef } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "@/components/symbol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Card, Notice } from "@/components/surface";
import { Pill } from "@/components/pill";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { StatusTile } from "@/components/tile";
import { DocumentFacts } from "@/components/document-facts";
import { ConsentRow } from "@/components/consent-row";
import { Field } from "@/components/field";
import { Sheet } from "@/components/sheet";
import { PdfRow } from "@/components/pdf-button";
import { VersionsSection } from "@/components/versions-section";
import { ContractBlocks, RequestCard, blockLabel, type ChangeRequest, type ContractBlock } from "@/components/contract-review";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDocument } from "@/lib/br-input";
import { civilDate, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { openHelp } from "@/lib/help-link";
import { useTabBarSpace } from "@/lib/layout";
import { confirmIdentity, lockAvailable } from "@/lib/lock";
import { useMe } from "@/lib/me";
import { space, usePalette } from "@/lib/theme";
import { contractTone } from "@/lib/tones";

type Detail = Awaited<ReturnType<typeof api.contracts.get>>;
type Signature = Detail["signatures"][number];
/** The request sheet: a new request on a block, or an edit of a draft. */
type Editing = { block: ContractBlock; request?: ChangeRequest };

const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const dayOf = (iso: string) => day.format(new Date(iso));
const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** After the client signs a contract: the web's "Próximos passos". */
const nextSteps = [
  { title: "Financeiro", text: "As cobranças aparecem em Financeiro.", href: "/financeiro" as const },
  { title: "Chamados", text: "Acessos, dúvidas e pedidos seguem por chamado.", href: "/chamados" as const },
  { title: "Projetos", text: "O andamento de um projeto fica em Projetos.", href: "/projetos" as const },
  { title: "Como trabalhamos", text: "Mostra os prazos e o que ajuda a equipe.", href: "/como-trabalhamos" as const },
];

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

/**
 * One contract: the text that went out (with what changed since the last
 * version), both signatures, change requests per clause and the round sent
 * to Anuntech, earlier rounds with the answers, the term, amendments,
 * versions and, when it is the viewer's turn, signing (contracts.get,
 * contracts.sign, contracts.saveRequest/discardRequest/submitRequests).
 */
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
  const [showChanges, setShowChanges] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [comment, setComment] = useState("");
  const [proposal, setProposal] = useState("");
  const [commentError, setCommentError] = useState<string | undefined>();
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contract", id] }),
      queryClient.invalidateQueries({ queryKey: ["contracts"] }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
    ]);
  const sign = useMutation({
    mutationFn: () => api.contracts.sign({ id, consent: true }),
    onSuccess: async ({ message }) => {
      haptic.success();
      setSignedMessage(message);
      setReviewMessage(null);
      setConsent(false);
      await refresh();
    },
    onError: () => haptic.error(),
  });
  const save = useMutation({
    mutationFn: (input: { blockIndex: number; requestId?: string; comment: string; proposedText: string }) =>
      api.contracts.saveRequest({ contractId: id, ...input }),
    onSuccess: async ({ message }) => {
      haptic.success();
      setReviewMessage(message);
      setEditing(null);
      await refresh();
    },
    onError: () => haptic.error(),
  });
  const discard = useMutation({
    mutationFn: (requestId: string) => api.contracts.discardRequest({ id: requestId }),
    onSuccess: async ({ message }) => {
      haptic.success();
      setReviewMessage(message);
      await refresh();
    },
    onError: (error) => {
      haptic.error();
      Alert.alert("Não foi possível descartar", errorMessage(error));
    },
  });
  const submit = useMutation({
    mutationFn: () => api.contracts.submitRequests({ contractId: id }),
    onSuccess: async ({ message }) => {
      haptic.success();
      setReviewMessage(message);
      await refresh();
    },
    onError: () => haptic.error(),
  });

  const c = contract.data;
  const amendment = c?.kind === "amendment";
  const noun = amendment ? "aditivo" : "contrato";
  const signer = me.data ? me.data.name.trim() || me.data.email : "";
  const busy = confirming || sign.isPending;
  const signedBy = (party: "client" | "anuntech") => c?.signatures.find((s) => s.party === party);
  const review = c?.review;
  const drafts = review?.requests.filter((r) => r.status === "draft") ?? [];
  const marked = showChanges && !!c?.previousVersion;
  const reviewing = save.isPending || discard.isPending || submit.isPending;

  const signNow = async () => {
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

  const openRequest = (block: ContractBlock, request?: ChangeRequest) => {
    save.reset();
    setCommentError(undefined);
    setComment(request?.comment ?? "");
    // As on the web, the proposed text starts as the clause itself: leaving it is only a comment.
    setProposal(request?.proposedText ?? block.text);
    setEditing({ block, request });
  };
  const saveRequest = () => {
    if (!editing || editing.block.index === null) return;
    if (!comment.trim()) {
      haptic.error();
      setCommentError("Explique o que precisa mudar.");
      return;
    }
    haptic.medium();
    save.mutate({ blockIndex: editing.block.index, requestId: editing.request?.id, comment, proposedText: proposal });
  };
  const confirmDiscard = (request: ChangeRequest) =>
    Alert.alert("Descartar este pedido?", `O pedido em ${request.label} ainda não foi enviado e sai da sua lista.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => discard.mutate(request.id) },
    ]);
  const confirmSubmit = () => {
    const n = drafts.length;
    Alert.alert(
      n === 1 ? "Enviar o pedido à Anuntech?" : `Enviar os ${n} pedidos à Anuntech?`,
      `A Anuntech responde cada pedido e manda uma nova versão do ${noun}. Até lá, esta versão não pode ser assinada.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar pedidos",
          onPress: () => {
            haptic.medium();
            submit.mutate();
          },
        },
      ],
    );
  };
  /** A draft's edit and discard buttons. */
  const draftActions = (request: ChangeRequest) =>
    request.status === "draft" && review?.canRequest ? (
      <>
        <Button
          title="Editar"
          size="small"
          variant="secondary"
          icon="pencil"
          accessibilityLabel={`Editar pedido em ${request.label}`}
          disabled={reviewing}
          onPress={() => {
            const block = c?.blocks.find((b) => b.index === request.blockIndex);
            if (block) openRequest(block, request);
          }}
        />
        <Button
          title="Descartar"
          size="small"
          variant="plain"
          icon="trash"
          accessibilityLabel={`Descartar pedido em ${request.label}`}
          disabled={reviewing}
          onPress={() => confirmDiscard(request)}
        />
      </>
    ) : undefined;

  const description = !c
    ? null
    : [
        c.status === "signed"
          ? null
          : c.status === "in_review"
            ? `Versão ${c.version ?? 1}, como foi enviada. Os pedidos de alteração estão com a Anuntech.`
            : review?.canRequest
              ? "Texto enviado para assinatura. Para pedir uma mudança, use o botão ao lado da cláusula."
              : c.status === "sent"
                ? "Texto enviado para assinatura. Não muda mais."
                : null,
        marked ? `A barra na margem marca o que mudou desde a versão ${c.previousVersion}.` : null,
      ]
        .filter(Boolean)
        .join(" ") || null;

  /** The client's round: what is ready to send, or what Anuntech is reviewing. */
  const roundCard =
    c && c.party === "client" && review && (review.canRequest || c.status === "in_review") ? (
      c.status === "in_review" ? (
        <Section
          header="Em revisão pela Anuntech"
          footer={(() => {
            const sent = review.requests.filter((r) => r.status !== "draft");
            const at = sent.map((r) => r.submittedAt).filter((v): v is string => !!v).sort().at(-1);
            return `Você enviou ${count(sent.length, "pedido", "pedidos")} de alteração${at ? ` em ${dayOf(at)}` : ""}. A nova versão chega por e-mail, com a resposta a cada pedido.`;
          })()}
          indent={space.lg}
        >
          {review.requests
            .filter((r) => r.status !== "draft")
            .map((request) => (
              <View key={request.id} style={{ padding: space.md }}>
                <RequestCard request={request} showLabel />
              </View>
            ))}
        </Section>
      ) : (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <StatusTile icon="text.bubble.fill" tone={drafts.length ? "attention" : "info"} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline" accessibilityRole="header">
                Pedir alterações
              </Text>
              <Text variant="subhead" tone="muted">
                {drafts.length
                  ? `${count(drafts.length, "pedido pronto", "pedidos prontos")} para enviar. A Anuntech responde cada um e manda uma nova versão.`
                  : `Algo para mudar no ${noun}? Use o botão ao lado da cláusula. Os pedidos ficam aqui até você enviar.`}
              </Text>
            </View>
          </View>
          {drafts.map((request) => (
            <RequestCard key={request.id} request={request} showLabel actions={draftActions(request)} />
          ))}
          {submit.error ? <Notice kind="error">{errorMessage(submit.error)}</Notice> : null}
          {drafts.length ? (
            <Button
              testID="submit-requests"
              title={submit.isPending ? "Enviando…" : `Enviar ${drafts.length === 1 ? "pedido" : `${drafts.length} pedidos`} à Anuntech`}
              icon="paperplane.fill"
              busy={submit.isPending}
              disabled={reviewing}
              onPress={confirmSubmit}
            />
          ) : null}
        </Card>
      )
    ) : null;

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
      {c && review ? (
        <>
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              <Pill label={c.statusLabel} tone={contractTone(c.status)} />
              {/* The web's term badge: only a signed contract near or past its end. */}
              {c.term?.label && c.term.state !== "upcoming" ? (
                <Pill label={c.term.label} tone={c.term.state === "expired" ? "danger" : "attention"} />
              ) : null}
            </View>
            <Text variant="title" accessibilityRole="header">
              {c.title}
            </Text>
            <Text variant="subhead" tone="muted">
              {[c.kindLabel, c.company, c.engagement].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {c.parent ? (
            <Section>
              <ListRow
                title="Contrato original"
                subtitle={c.parent.title}
                onPress={() => router.push({ pathname: "/contratos/[id]", params: { id: c.parent!.id } })}
              />
            </Section>
          ) : null}
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
          {reviewMessage ? <Notice kind="success">{reviewMessage}</Notice> : null}
          {roundCard}
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
              {description || c.previousVersion ? (
                <View style={{ gap: space.sm }}>
                  {description ? (
                    <Text variant="caption" tone="muted">
                      {description}
                    </Text>
                  ) : null}
                  {c.previousVersion ? (
                    <Button
                      title={showChanges ? "Esconder mudanças" : "Marcar mudanças"}
                      variant="secondary"
                      size="small"
                      onPress={() => {
                        haptic.select();
                        setShowChanges((value) => !value);
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
              <ContractBlocks
                blocks={c.blocks}
                marked={marked}
                onRequest={review.canRequest && !reviewing ? (block) => openRequest(block) : undefined}
                under={
                  c.party === "client"
                    ? (block) => {
                        const here = review.requests.filter((r) => r.blockIndex === block.index);
                        return here.length ? (
                          <View style={{ gap: space.sm }}>
                            {here.map((request) => (
                              <RequestCard key={request.id} request={request} actions={draftActions(request)} />
                            ))}
                          </View>
                        ) : null;
                      }
                    : undefined
                }
              />
            </View>
          </Section>
          {review.history.length ? (
            <View style={{ gap: space.lg }}>
              <View style={{ gap: 2, marginHorizontal: space.lg }}>
                <Text variant="heading" accessibilityRole="header">
                  Revisões
                </Text>
                <Text variant="subhead" tone="muted">
                  {c.party === "anuntech"
                    ? "O que o cliente pediu em cada versão e a resposta da Anuntech."
                    : "O que você pediu em cada versão e a resposta da Anuntech."}
                </Text>
              </View>
              {review.history.map((round) => (
                <Section key={round.version} header={`Versão ${round.version} · ${count(round.requests.length, "pedido", "pedidos")}`} indent={space.lg}>
                  {round.requests.map((request) => (
                    <View key={request.id} style={{ padding: space.md }}>
                      <RequestCard request={request} showLabel />
                    </View>
                  ))}
                </Section>
              ))}
            </View>
          ) : null}
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
                      disabled={!consent || !signer || reviewing}
                      onPress={() => void signNow()}
                    />
                    <Text variant="caption" tone={drafts.length ? "warning" : "muted"}>
                      Ficam registrados seu nome, e-mail, data, IP e o hash do texto.
                      {drafts.length > 0 &&
                        ` Assinar descarta ${drafts.length === 1 ? "o pedido de alteração não enviado" : `os ${drafts.length} pedidos de alteração não enviados`}.`}
                    </Text>
                  </View>
                  {c.party === "client" ? (
                    <Button
                      title="Como assinar e pedir alteração"
                      variant="plain"
                      size="small"
                      icon="questionmark.circle"
                      disabled={busy}
                      onPress={() => openHelp("assinar-um-contrato")}
                    />
                  ) : null}
                </Card>
              ) : null}
            </View>
          ) : null}
          {c.party === "client" && c.status === "signed" && !amendment ? (
            <Section header="Próximos passos">
              {nextSteps.map((step) => (
                <ListRow key={step.title} title={step.title} subtitle={step.text} onPress={() => router.push(step.href)} />
              ))}
            </Section>
          ) : null}
          {c.status !== "draft" && c.status !== "cancelled" ? (
            <Section
              header="Vigência"
              indent={space.lg}
              footer={
                amendment
                  ? c.startsAt || c.endsAt
                    ? "Ao ser assinado, passa a valer para o contrato original."
                    : "Este aditivo não muda o prazo do contrato."
                  : c.term?.state === "upcoming" && c.term.label
                    ? c.term.label
                    : c.endsAt
                      ? undefined
                      : "Sem prazo definido."
              }
            >
              <ListRow title="Início" value={c.startsAt ? civilDate(c.startsAt) : "—"} />
              <ListRow
                title="Fim"
                value={c.endsAt ? civilDate(c.endsAt) : "—"}
                valueTone={c.term?.state === "expired" ? "destructive" : "muted"}
              />
            </Section>
          ) : null}
          {!amendment && c.amendments.length ? (
            <Section header="Aditivos" indent={space.lg}>
              {c.amendments.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.title}
                  subtitle={`${item.signedAt ? `Assinado em ${dayOf(item.signedAt)}` : item.statusLabel}${item.endsAt ? ` · vigência até ${civilDate(item.endsAt)}` : ""}`}
                  onPress={() => router.push({ pathname: "/contratos/[id]", params: { id: item.id } })}
                />
              ))}
            </Section>
          ) : null}
          <VersionsSection
            versions={c.versions}
            name={c.title}
            footer="Cada envio congela um texto. As anteriores ficam para consulta, sem efeito."
          />
          {c.documentHash ? (
            <DocumentFacts
              hash={c.documentHash}
              version={c.version}
              sent={c.sentAt ? when(c.sentAt) : null}
              facts={c.template ? [{ title: "Modelo", value: c.template }] : []}
            />
          ) : null}
          <Sheet
            visible={editing !== null}
            onClose={() => setEditing(null)}
            title="Pedir alteração"
            subtitle={editing ? blockLabel(editing.block) : undefined}
            busy={save.isPending}
          >
            {editing ? (
              <>
                <View style={{ gap: space.xs }}>
                  <Text variant="caption" tone="muted">
                    Texto atual
                  </Text>
                  <Text variant="subhead" tone="muted" selectable>
                    {editing.block.text}
                  </Text>
                </View>
                <Field
                  label="O que precisa mudar"
                  testID="request-comment"
                  placeholder="Ex.: o prazo de pagamento precisa ser de 15 dias."
                  value={comment}
                  onChangeText={(text) => {
                    setComment(text);
                    if (commentError) setCommentError(undefined);
                  }}
                  error={commentError}
                  multiline
                  maxLength={2000}
                  autoFocus={!editing.request}
                  editable={!save.isPending}
                  style={{ minHeight: 96, textAlignVertical: "top" }}
                />
                <Field
                  label="Texto proposto (opcional)"
                  testID="request-proposal"
                  hint="Reescreva a cláusula como ela deveria ficar, ou deixe como está para só comentar."
                  value={proposal}
                  onChangeText={setProposal}
                  multiline
                  maxLength={8000}
                  editable={!save.isPending}
                  style={{ minHeight: 140, textAlignVertical: "top" }}
                />
                {save.error ? <Notice kind="error">{errorMessage(save.error)}</Notice> : null}
                <View style={{ gap: space.xs }}>
                  <Button
                    testID="save-request"
                    title={save.isPending ? "Salvando…" : editing.request ? "Salvar pedido" : "Adicionar pedido"}
                    busy={save.isPending}
                    onPress={saveRequest}
                  />
                  <Button title="Cancelar" variant="plain" disabled={save.isPending} onPress={() => setEditing(null)} />
                </View>
              </>
            ) : null}
          </Sheet>
        </>
      ) : null}
    </ScrollView>
  );
}
