import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Alert, AppState, Platform, Pressable, RefreshControl, ScrollView, Share, View } from "react-native";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { lateLabel } from "@/components/invoice-card";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { Bar, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { IconTile, StatusTile, toneColors } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { CONSOLE_URL } from "@/lib/config";
import { openAttachment } from "@/lib/files";
import { civilDate, dueLine, money, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { openHelp } from "@/lib/help-link";
import { invoiceLook } from "@/lib/status";
import { rounded, space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

type Invoice = Awaited<ReturnType<typeof api.finance.get>>;
type Copied = "pix" | "line" | "link";

const mono = Platform.select({ ios: "Menlo", default: "monospace" });
/** While it can still be paid, the screen asks again this often (the web's payment page does 15 s too). */
const POLL_MS = 15_000;
const open = (display: string | undefined) => display === "issued" || display === "overdue";
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const copiedText: Record<Copied, string> = { pix: "Código Pix copiado", line: "Linha digitável copiada", link: "Link de pagamento copiado" };

/** The hero's shape while the invoice loads. */
function HeroSkeleton() {
  return (
    <View accessible accessibilityLabel="Carregando" style={{ alignItems: "center", gap: 10, paddingTop: space.sm }}>
      <Bar width={56} height={56} radius={28} />
      <Bar width="55%" height={40} />
      <Bar width="70%" height={17} />
      <Bar width="40%" height={15} />
    </View>
  );
}

/** "Próxima cobrança": the later period already at the bank, or the subscription's next due date. */
function NextCharge({ recurrence }: { recurrence: NonNullable<Invoice["recurrence"]> }) {
  const { ahead, next } = recurrence;
  if (ahead) {
    const title = `${money(ahead.amountCents)}, vence ${civilDate(ahead.dueDate)}`;
    const note = ahead.status === "paid" ? "Já paga." : "Boleto e Pix já disponíveis.";
    return (
      <ListRow
        title="Próxima cobrança"
        subtitle={`${title}. ${note}`}
        accessibilityHint="Abre a fatura"
        onPress={() => router.push({ pathname: "/financeiro/[id]", params: { id: ahead.id } })}
      />
    );
  }
  if (!next) return null;
  const note = next.onPayment
    ? `Boleto e Pix saem assim que esta for paga, ou até ${civilDate(next.issueDate)}.`
    : `Boleto e Pix chegam até ${civilDate(next.issueDate)}.`;
  return <ListRow title="Próxima cobrança" subtitle={`${money(next.amountCents)}, vence ${civilDate(next.dueDate)}. ${note}`} />;
}

/** The "Nota fiscal" card, with the web's words for each state. */
function Fiscal({ fiscal }: { fiscal: NonNullable<Invoice["fiscal"]> }) {
  const text =
    fiscal.status === "authorized"
      ? "Nota fiscal emitida."
      : fiscal.status === "not_requested"
        ? "Emissão ainda não solicitada."
        : "Emissão em andamento com a equipe da Anuntech.";
  return (
    <Section header="Nota fiscal">
      <ListRow title={text} />
      {fiscal.url ? (
        <ListRow
          title="Abrir a nota"
          tone="primary"
          leading={<IconTile icon="doc.text.fill" color="green" />}
          trailing="external"
          onPress={() => void WebBrowser.openBrowserAsync(fiscal.url!)}
        />
      ) : null}
    </Section>
  );
}

/**
 * One invoice and what pays it: Pix copia e cola, the boleto, the payment link
 * to copy or share, and the charge as the web shows it. While it is open the
 * screen keeps reading it (every 15 s while on screen, on returning to the app
 * and on pull), and says so when the bank confirms the payment. Nothing here
 * marks anything as paid: only the bank's confirmation does.
 */
export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const invoice = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.finance.get({ id }),
    refetchInterval: (query) => (focused && open(query.state.data?.display) ? POLL_MS : false),
  });
  const loading = useDelayed(invoice.isPending);
  const [copied, setCopied] = useState<Copied | null>(null);
  const [pulling, setPulling] = useState(false);
  const i = invoice.data;
  const { refetch } = invoice;

  // Back in the app with this screen on top: read it again at once.
  useEffect(() => {
    if (!focused) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refetch();
    });
    return () => subscription.remove();
  }, [focused, refetch]);

  // The bank confirmed while the person watched: say it, and refresh what lists it.
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    const display = i?.display;
    if (open(previous.current) && display === "paid") {
      haptic.success();
      AccessibilityInfo.announceForAccessibility("Pagamento confirmado");
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    }
    previous.current = display;
  }, [i?.display, queryClient]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async (what: Copied, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(what);
    haptic.success();
    AccessibilityInfo.announceForAccessibility(copiedText[what]);
  };
  const share = async (url: string, description: string) => {
    try {
      await Share.share(Platform.OS === "ios" ? { url, message: description } : { message: `${description}: ${url}` });
    } catch {
      haptic.error();
    }
  };
  const refresh = async () => {
    setPulling(true);
    await refetch().finally(() => setPulling(false));
  };

  const look = i ? (invoiceLook[i.display] ?? invoiceLook.issued) : null;
  const paid = i?.display === "paid";
  const overdue = i?.display === "overdue";
  const issued = open(i?.display);
  const status = !i
    ? ""
    : paid
      ? "Pagamento confirmado pelo Inter"
      : issued
        ? [dueLine(i.display, i.dueDate), overdue && i.daysOverdue ? lateLabel(i.daysOverdue) : null].filter(Boolean).join(" · ")
        : `${i.statusLabel} · ${dueLine(i.display, i.dueDate)}`;
  const waiting = issued && !!i && !i.processing && !i.pix && !i.boletoLine;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      style={{ backgroundColor: palette.background }}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} />}
    >
      {loading && <HeroSkeleton />}
      {invoice.error && !i && <Notice kind="error">{errorMessage(invoice.error)}</Notice>}
      {i && look && (
        <>
          <View style={{ alignItems: "center", gap: space.sm, paddingTop: space.sm }}>
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={[i.statusLabel, money(i.amountCents), i.description, status].join(". ")}
              style={{ alignItems: "center", gap: space.sm }}
            >
              <StatusTile icon={look.icon} tone={look.tone} size={56} />
              <Text variant="display" style={{ textAlign: "center" }}>
                {money(i.amountCents)}
              </Text>
              <Text variant="headline" style={{ textAlign: "center" }}>
                {i.description}
              </Text>
              <Text variant="label" style={{ textAlign: "center", color: toneColors(palette, look.tone).fg }}>
                {status}
              </Text>
              {i.bankDueDate && issued ? (
                <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
                  Boleto e Pix válidos até {civilDate(i.bankDueDate)}
                </Text>
              ) : null}
            </View>
            {issued ? (
              <Pressable
                accessibilityRole="link"
                accessibilityHint="Abre a ajuda"
                hitSlop={10}
                onPress={() => openHelp("pagar-uma-fatura")}
              >
                <Text variant="label" tone="primary">
                  Como pagar
                </Text>
              </Pressable>
            ) : null}
          </View>
          {paid ? (
            <Notice kind="success" title="Pagamento confirmado pelo Inter.">
              {i.bankCheckedAt ? `Última consulta ${when(i.bankCheckedAt)}.` : "O banco confirmou o pagamento."}
            </Notice>
          ) : null}
          {overdue ? <Notice kind="error">Esta fatura está vencida. O Pix compensa na hora.</Notice> : null}
          {issued && i.processing ? (
            <Notice kind="info">Boleto e Pix aparecem aqui assim que o Inter concluir a emissão. Esta tela atualiza sozinha.</Notice>
          ) : null}
          {waiting ? <Notice kind="info">O Inter ainda não enviou o boleto e o Pix desta cobrança.</Notice> : null}
          {!paid && i.pix ? (
            <Section header="Pix copia e cola" footer="Cole no app do seu banco, na opção Pix copia e cola.">
              <View style={{ padding: space.lg, gap: space.md }}>
                <View style={{ backgroundColor: palette.fill, ...rounded(12), padding: space.md }}>
                  <Text
                    variant="caption"
                    selectable
                    numberOfLines={2}
                    ellipsizeMode="middle"
                    style={{ fontFamily: mono, fontSize: 13, lineHeight: 18 }}
                  >
                    {i.pix}
                  </Text>
                </View>
                <Button
                  title={copied === "pix" ? "Código copiado" : "Copiar código Pix"}
                  icon={copied === "pix" ? "checkmark" : "doc.on.doc"}
                  testID="copy-pix"
                  onPress={() => void copy("pix", i.pix!)}
                />
              </View>
            </Section>
          ) : null}
          {!paid && i.boletoLine ? (
            <Section header="Boleto">
              <View style={{ padding: space.lg }}>
                <Text
                  selectable
                  accessibilityLabel={`Linha digitável: ${i.boletoLine}`}
                  style={{ fontFamily: mono, fontSize: 15, lineHeight: 22, fontVariant: ["tabular-nums"] }}
                >
                  {i.boletoLine}
                </Text>
              </View>
              <ListRow
                title={copied === "line" ? "Linha copiada" : "Copiar linha digitável"}
                leading={<IconTile icon={copied === "line" ? "checkmark" : "doc.on.doc"} color="gray" />}
                tone="primary"
                trailing="none"
                onPress={() => void copy("line", i.boletoLine!)}
              />
              {i.boletoPath ? (
                <ListRow
                  title="Baixar boleto em PDF"
                  leading={<IconTile icon="arrow.down.doc.fill" color="gray" />}
                  onPress={() =>
                    void openAttachment(i.boletoPath!, `boleto-${i.id}.pdf`).catch(() =>
                      Alert.alert("Não foi possível abrir o boleto", "Boleto ainda indisponível. Tente novamente mais tarde."),
                    )
                  }
                />
              ) : null}
            </Section>
          ) : null}
          {i.payUrl ? (
            <Section header="Link de pagamento" footer="Quem tiver o link vê a fatura e paga, sem entrar no Console.">
              <ListRow
                title={copied === "link" ? "Link copiado" : "Copiar link de pagamento"}
                leading={<IconTile icon={copied === "link" ? "checkmark" : "link"} color="violet" />}
                tone="primary"
                trailing="none"
                onPress={() => void copy("link", i.payUrl!)}
              />
              <ListRow
                title="Compartilhar link"
                leading={<IconTile icon="square.and.arrow.up" color="violet" />}
                tone="primary"
                trailing="none"
                onPress={() => void share(i.payUrl!, i.description)}
              />
              <ListRow
                title="Abrir a página de pagamento"
                leading={<IconTile icon="safari.fill" color="violet" />}
                trailing="external"
                onPress={() => void WebBrowser.openBrowserAsync(i.payPath ? `${CONSOLE_URL}${i.payPath}` : i.payUrl!)}
              />
            </Section>
          ) : null}
          <Section header="Cobrança" indent={space.lg}>
            <ListRow title="Pagador" subtitle={`${i.payer.name}\n${i.payer.document}`} />
            {i.engagement ? <ListRow title="Produto ou projeto" subtitle={i.engagement} /> : null}
            <ListRow
              title="Vencimento"
              value={civilDate(i.dueDate)}
              valueTone={overdue ? "destructive" : "muted"}
              subtitle={overdue && i.daysOverdue ? lateLabel(i.daysOverdue) : undefined}
            />
            {i.recurrence ? <ListRow title="Recorrência" value={i.recurrence.interval === "yearly" ? "Anual" : "Mensal"} /> : null}
            {i.recurrence ? <NextCharge recurrence={i.recurrence} /> : null}
            {i.terms?.discountCents ? (
              <ListRow
                title="Desconto"
                subtitle={`${money(i.terms.discountCents)} até o vencimento (${money(i.terms.onTimeCents ?? i.amountCents)} pagando em dia)`}
              />
            ) : null}
            {i.terms?.lateFees ? <ListRow title="Após o vencimento" subtitle={i.terms.lateFees} /> : null}
          </Section>
          {i.fiscal ? <Fiscal fiscal={i.fiscal} /> : null}
          <Section header="Mais detalhes" indent={space.lg}>
            <ListRow title="Criada em" value={day.format(new Date(i.createdAt))} />
            {i.bankCheckedAt ? <ListRow title="Última consulta ao banco" value={when(i.bankCheckedAt)} /> : null}
          </Section>
        </>
      )}
    </ScrollView>
  );
}
