import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { StatusBadge } from "@/components/badge";
import { Notice } from "@/components/surface";
import { api, errorMessage } from "@/lib/api";
import { fileSize, when } from "@/lib/format";
import { openAttachment } from "@/lib/files";
import { fonts, radius, space, usePalette } from "@/lib/theme";
import { useKeyboardVisible, useTabBarSpace } from "@/lib/layout";

/** One ticket: what it is about, the conversation and the reply box. */
export default function Ticket() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  // The box sits above the floating tab bar; with the keyboard up the bar is hidden.
  const tabBar = useTabBarSpace();
  const typing = useKeyboardVisible();
  const [body, setBody] = useState("");
  const ticket = useQuery({ queryKey: ["ticket", id], queryFn: () => api.tickets.get({ id }) });
  const reply = useMutation({
    mutationFn: () => api.tickets.reply({ id, body: body.trim() }),
    onSuccess: async () => {
      setBody("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      ]);
    },
  });
  const t = ticket.data;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
      >
        {ticket.isPending && <ActivityIndicator accessibilityLabel="Carregando" />}
        {ticket.error && <Notice kind="error">{errorMessage(ticket.error)}</Notice>}
        {t && (
          <>
            <View style={{ gap: space.sm }}>
              <StatusBadge status={t.status} label={t.statusLabel} />
              <Text variant="heading" accessibilityRole="header">
                {t.subject}
              </Text>
              <Text variant="caption" tone="muted">
                {[t.company, t.engagement, t.kindLabel].filter(Boolean).join(" · ")}
              </Text>
              {t.assigneeName ? (
                <Text variant="caption" tone="muted">
                  Com {t.assigneeName}
                </Text>
              ) : null}
            </View>
            {t.waitingFor ? <Notice kind="info">A equipe precisa de você: {t.waitingFor}</Notice> : null}
            <View style={{ gap: space.md }}>
              {t.entries.map((entry) =>
                entry.kind === "message" ? (
                  <View
                    key={`m-${entry.id}`}
                    style={{
                      alignSelf: entry.mine ? "flex-end" : "flex-start",
                      maxWidth: "88%",
                      backgroundColor: entry.mine ? palette.accent : palette.card,
                      borderRadius: radius.xl,
                      borderWidth: 1,
                      borderColor: palette.border,
                      padding: space.md,
                      gap: space.xs,
                    }}
                  >
                    <Text variant="caption" tone="muted">
                      {entry.mine ? "Você" : entry.author}
                      {/* The team's tag, unless the name already says it. */}
                      {entry.staff && !entry.mine && !/anuntech/i.test(entry.author) ? " · Equipe Anuntech" : ""} ·{" "}
                      {when(entry.createdAt)}
                    </Text>
                    <Text selectable>{entry.body}</Text>
                  </View>
                ) : (
                  <Pressable
                    key={`f-${entry.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir anexo ${entry.name}`}
                    onPress={() =>
                      void openAttachment(entry.href, entry.name).catch(() =>
                        Alert.alert("Não foi possível abrir o anexo", "Confira a internet e tente de novo."),
                      )
                    }
                    style={({ pressed }) => ({
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      gap: space.sm,
                      alignItems: "center",
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: palette.border,
                      backgroundColor: palette.card,
                      padding: space.md,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text variant="label" tone="primary">
                      Anexo
                    </Text>
                    <Text variant="caption" numberOfLines={1} style={{ maxWidth: 200 }}>
                      {entry.name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {fileSize(entry.size)}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          </>
        )}
      </ScrollView>
      {t &&
        (t.canReply ? (
          <View
            style={{
              borderTopWidth: 1,
              borderColor: palette.border,
              backgroundColor: palette.card,
              padding: space.md,
              paddingBottom: typing ? space.md : tabBar,
              gap: space.sm,
            }}
          >
            {reply.error ? <Notice kind="error">{errorMessage(reply.error)}</Notice> : null}
            <TextInput
              testID="reply"
              accessibilityLabel="Sua resposta"
              placeholder="Escreva sua resposta"
              placeholderTextColor={palette.muted}
              multiline
              value={body}
              onChangeText={setBody}
              maxLength={10000}
              style={{
                minHeight: 44,
                maxHeight: 140,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: palette.fieldBorder,
                backgroundColor: palette.field,
                paddingHorizontal: space.md,
                paddingTop: space.sm + 2,
                paddingBottom: space.sm + 2,
                fontFamily: fonts.regular,
                fontSize: 16,
                color: palette.foreground,
              }}
            />
            <Button
              title={reply.isPending ? "Enviando…" : "Enviar resposta"}
              testID="send-reply"
              busy={reply.isPending}
              disabled={!body.trim()}
              onPress={() => reply.mutate()}
            />
          </View>
        ) : (
          <View style={{ padding: space.lg, paddingBottom: tabBar }}>
            <Notice kind="info">O chamado está encerrado. Abra um novo chamado para continuar o atendimento.</Notice>
          </View>
        ))}
    </KeyboardAvoidingView>
  );
}
