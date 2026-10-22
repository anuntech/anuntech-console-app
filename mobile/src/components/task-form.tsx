import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { AttachmentField, type Attachment } from "./attachment-field";
import { fileSize } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { formatDateInput, inputFromIso, isoFromInput } from "@/lib/tasks";
import { rounded, space, usePalette } from "@/lib/theme";
import { Avatar, type AvatarInfo } from "./avatar";
import { Button } from "./button";
import { Chip } from "./chip";
import { Field } from "./field";
import { ListRow } from "./list-row";
import { PickSheet } from "./pick-sheet";
import { Section } from "./section";
import { Segmented } from "./segmented";
import { Notice } from "./surface";
import { Text } from "./text";

const MAX_LABELS = 8;
/** Files per save, as the server takes them (DOCUMENT_ATTACHMENTS). */
const MAX_FILES = 5;

type Person = { id: string; name: string; avatar: AvatarInfo };
type Option = { value: string; label: string };
type SavedFile = { id: string; name: string; size: number; canRemove: boolean };

export type TaskValues = {
  title: string;
  description: string;
  status?: string;
  priority: string;
  dueDate: string;
  estimate: string;
  labels: string[];
  assigneeIds: string[];
  uploadIds: string[];
  removeFileIds: string[];
};

const same = (a: string, b: string) => a.toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR");

/**
 * Creating and editing a task, as the web's TaskSheet: title, description,
 * priority, people, deadline, estimate, labels and files. The column is
 * offered only to the team on creation; a client's task is a request in the
 * Backlog, and an existing task changes column from its detail.
 */
export function TaskForm({
  initial,
  people,
  priorities,
  statuses,
  labelSuggestions,
  savedFiles = [],
  engagementId,
  intro,
  submitLabel,
  pendingLabel,
  busy,
  error,
  onSubmit,
}: {
  initial: Omit<TaskValues, "uploadIds" | "removeFileIds">;
  people: Person[];
  priorities: Option[];
  /** The columns to pick from (the team's new task); none hides the field. */
  statuses?: Option[];
  labelSuggestions: string[];
  savedFiles?: SavedFile[];
  engagementId: string;
  intro?: string;
  submitLabel: string;
  pendingLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: TaskValues) => void;
}) {
  const palette = usePalette();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [status, setStatus] = useState(initial.status);
  const [priority, setPriority] = useState(initial.priority);
  const [due, setDue] = useState(inputFromIso(initial.dueDate || null));
  const [estimate, setEstimate] = useState(initial.estimate);
  const [labels, setLabels] = useState(initial.labels);
  const [draft, setDraft] = useState("");
  const [assigneeIds, setAssignees] = useState(initial.assigneeIds);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [removing, setRemoving] = useState<string[]>([]);
  const [choosingPeople, setChoosingPeople] = useState(false);
  const [choosingStatus, setChoosingStatus] = useState(false);
  const [tried, setTried] = useState(false);
  const dueDate = isoFromInput(due);
  const uploading = files.some((file) => file.state === "uploading");
  const failed = files.some((file) => file.state === "error");
  const names = new Map(people.map((person) => [person.id, person.name]));
  const chosen = assigneeIds.map((id) => names.get(id) ?? "Pessoa sem acesso ao projeto");
  const statusLabel = statuses?.find((option) => option.value === status)?.label;
  const available = labelSuggestions.filter((s) => !labels.some((l) => same(l, s))).slice(0, 12);
  const addLabel = (raw: string) => {
    const label = raw.trim().replace(/\s+/g, " ").slice(0, 24);
    setDraft("");
    if (!label || labels.some((l) => same(l, label)) || labels.length >= MAX_LABELS) return;
    haptic.select();
    setLabels([...labels, label]);
  };
  const submit = () => {
    setTried(true);
    if (!title.trim() || dueDate === null || uploading || failed) {
      haptic.error();
      return;
    }
    // A label typed but not added yet still counts, as the web's field adds it on blur.
    const pending = draft.trim().replace(/\s+/g, " ").slice(0, 24);
    const all = pending && !labels.some((l) => same(l, pending)) ? [...labels, pending] : labels;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      dueDate,
      estimate: estimate.trim(),
      labels: all,
      assigneeIds,
      uploadIds: files.flatMap((file) => (file.uploadId ? [file.uploadId] : [])),
      removeFileIds: removing,
    });
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.gutter, gap: space.form, paddingBottom: space.xxl }}
      >
        {intro ? (
          <Text variant="subhead" tone="muted">
            {intro}
          </Text>
        ) : null}
        <Field
          label="Título"
          testID="task-title"
          placeholder="O que precisa ser feito"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          autoFocus={!initial.title}
          error={tried && !title.trim() ? "Dê um título à tarefa." : undefined}
        />
        <Field
          label="Descrição"
          testID="task-description"
          placeholder="Contexto, o que precisa estar pronto, links úteis."
          value={description}
          onChangeText={setDescription}
          maxLength={5000}
          multiline
          style={{ minHeight: 120, paddingTop: space.md, textAlignVertical: "top" }}
        />
        <View style={{ gap: space.sm }}>
          <Text variant="label" accessible={false}>
            Prioridade
          </Text>
          <Segmented
            values={priorities.map((option) => option.label)}
            selectedIndex={Math.max(0, priorities.findIndex((option) => option.value === priority))}
            onChange={(index) => setPriority(priorities[index]?.value ?? "normal")}
            accessibilityLabel="Prioridade"
          />
        </View>
        <Section>
          {statuses?.length ? (
            <ListRow
              leading={<SymbolView name="square.split.2x1" size={18} tintColor={palette.primary} accessible={false} style={{ width: 32 }} />}
              title="Coluna"
              value={statusLabel}
              accessibilityLabel={`Coluna, ${statusLabel ?? ""}`}
              onPress={() => setChoosingStatus(true)}
            />
          ) : null}
          <ListRow
            leading={<SymbolView name="person.2" size={18} tintColor={palette.primary} accessible={false} style={{ width: 32 }} />}
            title="Responsáveis"
            subtitle={chosen.length ? chosen.join(", ") : "Ninguém ainda"}
            testID="task-assignees"
            accessibilityLabel={`Responsáveis, ${chosen.length ? chosen.join(", ") : "ninguém ainda"}`}
            onPress={() => setChoosingPeople(true)}
          />
        </Section>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Prazo"
              testID="task-due"
              placeholder="Sem prazo"
              keyboardType="number-pad"
              value={due}
              onChangeText={(text) => setDue(formatDateInput(text))}
              maxLength={10}
              hint="DD/MM/AAAA"
              error={tried && dueDate === null ? "Informe uma data válida." : undefined}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Estimativa (horas)"
              testID="task-estimate"
              placeholder="Ex.: 1,5"
              keyboardType="decimal-pad"
              value={estimate}
              onChangeText={setEstimate}
              maxLength={10}
            />
          </View>
        </View>
        <View style={{ gap: space.sm }}>
          <Field
            label="Etiquetas"
            testID="task-label"
            placeholder={labels.length >= MAX_LABELS ? `Até ${MAX_LABELS} etiquetas` : "Digite e toque em Adicionar"}
            editable={labels.length < MAX_LABELS}
            value={draft}
            onChangeText={setDraft}
            maxLength={24}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => addLabel(draft)}
          />
          {labels.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {labels.map((label) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover etiqueta ${label}`}
                  onPress={() => {
                    haptic.select();
                    setLabels(labels.filter((l) => l !== label));
                  }}
                  style={({ pressed }) => ({
                    minHeight: 32,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    ...rounded(999),
                    backgroundColor: pressed ? palette.fill : palette.secondary,
                  })}
                >
                  <Text variant="label">{label}</Text>
                  <SymbolView name="xmark" size={10} weight="bold" tintColor={palette.muted} accessible={false} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {draft.trim() && labels.length < MAX_LABELS ? (
            <Button title={`Adicionar "${draft.trim()}"`} variant="secondary" size="small" icon="plus" onPress={() => addLabel(draft)} />
          ) : null}
          {available.length > 0 && labels.length < MAX_LABELS ? (
            <View accessibilityLabel="Etiquetas já usadas no projeto" style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {available.map((label) => (
                <Chip key={label} label={`+ ${label}`} group="Etiquetas já usadas no projeto" selected={false} onPress={() => addLabel(label)} />
              ))}
            </View>
          ) : null}
        </View>
        <View style={{ gap: space.sm }}>
          <Text variant="label" accessible={false}>
            Anexos
          </Text>
          {savedFiles.length > 0 ? (
            <Section indent={16}>
              {savedFiles.map((file) => {
                const marked = removing.includes(file.id);
                return (
                  <ListRow
                    key={file.id}
                    title={
                      <Text
                        numberOfLines={1}
                        tone={marked ? "muted" : "foreground"}
                        style={marked ? { textDecorationLine: "line-through" } : undefined}
                      >
                        {file.name}
                      </Text>
                    }
                    subtitle={marked ? "Sai ao salvar" : fileSize(file.size)}
                    accessibilityLabel={`${file.name}, ${marked ? "sai ao salvar" : fileSize(file.size)}`}
                    trailing={
                      file.canRemove ? (
                        <Button
                          title={marked ? "Desfazer" : "Remover"}
                          variant="plain"
                          size="small"
                          accessibilityLabel={marked ? `Manter ${file.name}` : `Remover ${file.name}`}
                          onPress={() => {
                            haptic.select();
                            setRemoving(marked ? removing.filter((id) => id !== file.id) : [...removing, file.id]);
                          }}
                        />
                      ) : (
                        "none"
                      )
                    }
                  />
                );
              })}
            </Section>
          ) : null}
          <AttachmentField value={files} onChange={setFiles} target={{ kind: "task", engagementId }} max={MAX_FILES} />
        </View>
        {tried && uploading ? <Notice kind="warning">Espere os anexos terminarem de enviar.</Notice> : null}
        {tried && failed ? <Notice kind="warning">Um anexo não foi enviado. Tire-o da lista ou tente de novo.</Notice> : null}
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Button title={busy ? pendingLabel : submitLabel} icon="checkmark" testID="save-task" busy={busy} onPress={submit} />
      </ScrollView>
      <PickSheet
        visible={choosingPeople}
        multiple
        title="Responsáveis"
        footer="Quem vê este projeto e a equipe da Anuntech."
        options={people.map((person) => ({
          value: person.id,
          label: person.name,
          leading: <Avatar avatar={person.avatar} name={person.name} size={32} />,
        }))}
        selected={assigneeIds}
        onChange={setAssignees}
        onClose={() => setChoosingPeople(false)}
      />
      {statuses?.length ? (
        <PickSheet
          visible={choosingStatus}
          title="Coluna"
          options={statuses}
          selected={status ? [status] : []}
          onChange={([value]) => setStatus(value)}
          onClose={() => setChoosingStatus(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
