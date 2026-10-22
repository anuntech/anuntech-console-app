import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Switch, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SFSymbol } from "expo-symbols";
import { Button } from "@/components/button";
import { PasteCodeButton } from "@/components/code-tools";
import { CodeField } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Pill } from "@/components/pill";
import { Section } from "@/components/section";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { Card, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { authErrorMessage, securityChange, type SecurityProof } from "@/lib/auth";
import { useCooldown } from "@/lib/cooldown";
import { when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import type { ToneName } from "@/lib/status";
import { space, usePalette, type tile } from "@/lib/theme";

type Channel = "email" | "whatsapp";
type Session = { id: string; device: string; createdAt: string; expiresAt: string | null; status: "current" | "active" | "expired" | "ended"; statusLabel: string };

const channels: { value: Channel; label: string; icon: SFSymbol; color: keyof typeof tile }[] = [
  { value: "email", label: "E-mail", icon: "envelope.fill", color: "violet" },
  { value: "whatsapp", label: "WhatsApp", icon: "message.fill", color: "green" },
];

const statusTone: Record<Session["status"], ToneName> = { current: "info", active: "good", expired: "neutral", ended: "neutral" };

/** The device's symbol from the Console's label ("Safari · Mac", "App Anuntech · iPhone"). */
function deviceIcon(device: string): SFSymbol {
  if (/iPhone|Android/.test(device)) return "iphone";
  if (/iPad/.test(device)) return "ipad";
  if (/Mac|Windows|Linux/.test(device)) return "laptopcomputer";
  return "desktopcomputer";
}

/** One sign-in: device, when it began (and until when it lasts), and its state. */
function SessionRow({ session }: { session: Session }) {
  const live = session.status === "active" || session.status === "current";
  const subtitle = `Iniciada em ${when(session.createdAt)}${live && session.expiresAt ? ` · ativa até ${when(session.expiresAt)}` : ""}`;
  return (
    <ListRow
      title={session.device}
      subtitle={subtitle}
      accessibilityLabel={`${session.device}, ${subtitle}, ${session.statusLabel}`}
      leading={<IconTile icon={deviceIcon(session.device)} color="gray" />}
      trailing={<Pill label={session.statusLabel} tone={statusTone[session.status]} />}
    />
  );
}

/**
 * Segurança, as on the web: the second step (which channel confirms a
 * sign-in; any change confirmed by a code on the e-mail and then on
 * WhatsApp) and where the account has been open.
 */
export default function Security() {
  const palette = usePalette();
  const queryClient = useQueryClient();
  const bottom = useTabBarSpace();
  const overview = useQuery({ queryKey: ["security"], queryFn: () => api.security.overview({}) });
  const loading = useDelayed(overview.isPending);
  const [proof, setProof] = useState<SecurityProof | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [seconds, cooldown] = useCooldown();
  const cooldownChannel = useRef<Channel | null>(null);
  const data = overview.data;
  const enabled = !!data?.twoFactorEnabled;
  const channel = data?.channel ?? "whatsapp";
  const phone = data?.phone ?? null;

  function reset() {
    setProof(null);
    setSent(false);
    setCode("");
    setError("");
    setMessage("");
  }

  async function act(action: "enable" | "disable" | "channel" | "send" | "verify", selected: Channel = channel, candidate = code) {
    if (busy) return;
    if (action === "send" && seconds > 0 && cooldownChannel.current === proof?.stage) {
      setError("Aguarde um minuto entre envios para o mesmo contato.");
      return;
    }
    if (action === "verify" && candidate.length !== 6) return;
    setBusy(true);
    setError("");
    setMessage("");
    setSuccess("");
    try {
      if (action === "send" && proof) {
        await securityChange.send(proof.changeId);
        setSent(true);
        setCode("");
        cooldown();
        cooldownChannel.current = proof.stage;
        setMessage(`Código enviado por ${proof.stage === "email" ? "e-mail" : "WhatsApp"}.`);
      } else if (action === "verify" && proof) {
        const result = await securityChange.verify(proof.changeId, candidate);
        if (result.complete) {
          reset();
          haptic.success();
          setSuccess("Configuração de segurança atualizada. As outras sessões foram encerradas.");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["security"] }),
            queryClient.invalidateQueries({ queryKey: ["me"] }),
          ]);
        } else if (result.stage && result.destination) {
          setProof({ ...proof, stage: result.stage, destination: result.destination });
          setSent(false);
          setCode("");
          setMessage("E-mail confirmado. Agora confirme seu WhatsApp para concluir.");
        }
      } else if (action === "enable" || action === "disable" || action === "channel") {
        haptic.select();
        setProof(await securityChange.start(action, selected));
        setSent(false);
        setCode("");
      }
    } catch (failure) {
      haptic.error();
      if (action === "verify") setCode("");
      setError(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={
          <RefreshControl refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()} />
        }
      >
        <Text tone="muted">Proteção da sua conta e onde ela está aberta.</Text>
        {overview.error ? <Notice kind="error">{errorMessage(overview.error)}</Notice> : null}
        {loading ? (
          <>
            <SkeletonHeader />
            <SkeletonRows count={3} inset={0} />
          </>
        ) : null}
        {success ? <Notice kind="success">{success}</Notice> : null}
        {data ? (
          <>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
                <Text variant="headline" accessibilityRole="header">
                  Verificação em duas etapas
                </Text>
                <Pill label={enabled ? "Ativada" : "Desativada"} tone={enabled ? "good" : "neutral"} />
              </View>
              <Text variant="subhead" tone="muted">
                Ao entrar, um segundo código confirma que é você. Escolha por onde ele chega.
              </Text>
              {error ? <Notice kind="error">{error}</Notice> : null}
              {!phone ? (
                <>
                  <Notice kind="info">Vincule seu WhatsApp em Minha conta para ativar a verificação.</Notice>
                  <Button
                    title="Vincular WhatsApp"
                    icon="message.fill"
                    variant="secondary"
                    size="small"
                    testID="link-whatsapp"
                    onPress={() => router.push("/conta/whatsapp")}
                  />
                </>
              ) : null}
            </Card>
            {!proof ? (
              <Section>
                {channels.map((option) => {
                  const active = enabled && channel === option.value;
                  const off = busy || !phone;
                  const toggle = () => {
                    if (!off) void act(active ? "disable" : enabled ? "channel" : "enable", option.value);
                  };
                  return (
                    <View
                      key={option.value}
                      accessible
                      accessibilityRole="switch"
                      accessibilityLabel={`${active ? "Desativar" : "Ativar"} verificação por ${option.label}`}
                      accessibilityState={{ checked: active, disabled: off }}
                      onAccessibilityTap={toggle}
                    >
                      <ListRow
                        title={option.label}
                        leading={<IconTile icon={option.icon} color={option.color} />}
                        trailing={
                          <Switch
                            testID={`two-step-${option.value}`}
                            value={active}
                            disabled={off}
                            trackColor={{ true: palette.primary }}
                            onValueChange={toggle}
                          />
                        }
                      />
                    </View>
                  );
                })}
              </Section>
            ) : (
              <Card raised>
                <View accessible style={{ gap: 2 }}>
                  <Text variant="label">
                    {proof.stage === "email" ? "1 de 2 · Confirme seu e-mail" : "2 de 2 · Confirme seu WhatsApp"}
                  </Text>
                  <Text variant="subhead" tone="muted">
                    {proof.destination}
                  </Text>
                </View>
                {sent ? (
                  <>
                    <CodeField
                      testID="security-code"
                      label="Código de confirmação"
                      value={code}
                      onChange={(next) => {
                        setCode(next);
                        if (next.length === 6) void act("verify", channel, next);
                      }}
                      invalid={!!error}
                    />
                    {proof.stage === "whatsapp" && code.length < 6 ? (
                      <PasteCodeButton
                        disabled={busy}
                        onError={setError}
                        onCode={(pasted) => {
                          setCode(pasted);
                          void act("verify", channel, pasted);
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
                <View style={{ gap: space.sm }}>
                  <Button
                    title={busy ? "Aguarde…" : sent ? "Confirmar código" : "Receber código"}
                    icon={sent ? undefined : proof.stage === "email" ? "envelope.fill" : "message.fill"}
                    testID={sent ? "security-confirm" : "security-send"}
                    busy={busy}
                    disabled={sent && code.length !== 6}
                    onPress={() => void act(sent ? "verify" : "send")}
                  />
                  {sent ? (
                    <Button
                      title={seconds ? `Reenviar em ${seconds}s` : "Reenviar código"}
                      variant="plain"
                      disabled={busy || seconds > 0}
                      onPress={() => void act("send")}
                    />
                  ) : null}
                  <Button title="Cancelar" variant="plain" testID="security-cancel" disabled={busy} onPress={reset} />
                </View>
              </Card>
            )}
            {message ? <Notice kind="info">{message}</Notice> : null}
            <Section header="Sessões recentes" footer="Onde sua conta esteve aberta. Sessões antigas expiram sozinhas.">
              {data.sessions.length ? (
                data.sessions.map((session) => <SessionRow key={session.id} session={session} />)
              ) : (
                <ListRow title="Nenhuma sessão registrada" />
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
