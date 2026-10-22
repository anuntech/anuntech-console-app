import { useState } from "react";
import { View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";
import { Button } from "./button";
import { Field } from "./field";
import { Sheet } from "./sheet";
import { Notice } from "./surface";
import { Text } from "./text";

type Decision = "approve" | "problem";
export type ReviewTarget = { id: string; title: string; reviewDue: string | null };

/**
 * Reviewing a delivery, as the web's TaskReviewDialog: approve it, or say
 * what is missing (required) and it goes back to the team. Opened from the
 * board and from the task.
 */
export function TaskReviewSheet({
  task,
  onClose,
  onDone,
}: {
  task: ReviewTarget | null;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [problem, setProblem] = useState(false);
  const [note, setNote] = useState("");
  const review = useMutation({
    mutationFn: (input: { id: string; decision: Decision; note: string }) => api.projects.reviewTask(input),
    onSuccess: async ({ message }) => {
      haptic.success();
      setProblem(false);
      setNote("");
      onClose();
      await onDone(message);
    },
    onError: () => haptic.error(),
  });
  const pending = review.isPending;
  const close = () => {
    setProblem(false);
    setNote("");
    review.reset();
    onClose();
  };
  const send = (decision: Decision) => {
    if (!task || pending) return;
    haptic.medium();
    review.mutate({ id: task.id, decision, note: decision === "problem" ? note.trim() : "" });
  };
  return (
    <Sheet
      visible={!!task}
      onClose={close}
      title="Revisar entrega"
      subtitle={task ? `${task.title}${task.reviewDue ? ` · teste até ${when(task.reviewDue)}` : ""}` : undefined}
      busy={pending}
    >
      {problem ? (
        <Field
          label="O que não funcionou"
          testID="problem-note"
          placeholder="O que você testou e o que não funcionou como esperado."
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
          maxLength={5000}
          editable={!pending}
          style={{ minHeight: 140, textAlignVertical: "top" }}
        />
      ) : (
        <Text variant="subhead" tone="muted">
          Teste a entrega. Se estiver como combinado, aprove; se não, conte o que falta e ela volta para a equipe.
        </Text>
      )}
      {review.error ? <Notice kind="error">{errorMessage(review.error)}</Notice> : null}
      {problem ? (
        <View style={{ gap: space.xs }}>
          <Button
            testID="send-problem"
            title={pending ? "Enviando…" : "Enviar para a equipe"}
            icon="exclamationmark.triangle.fill"
            busy={pending}
            disabled={!note.trim()}
            onPress={() => send("problem")}
          />
          <Button
            title="Voltar"
            variant="plain"
            disabled={pending}
            onPress={() => {
              review.reset();
              setProblem(false);
            }}
          />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button
            testID="approve-task"
            title={pending ? "Aprovando…" : "Aprovar"}
            icon="checkmark"
            busy={pending}
            onPress={() => send("approve")}
          />
          <Button
            testID="report-problem"
            title="Encontrei um problema"
            variant="secondary"
            disabled={pending}
            onPress={() => {
              haptic.select();
              review.reset();
              setProblem(true);
            }}
          />
        </View>
      )}
    </Sheet>
  );
}
