import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { SymbolView } from "@/components/symbol";
import { fileSize } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { enter, exit, layout } from "@/lib/motion";
import { rounded, space, usePalette } from "@/lib/theme";
import {
  ATTACHMENT_RULES,
  UploadError,
  discardUpload,
  documentsAvailable,
  pickFiles,
  uploadFile,
  type PickedFile,
  type UploadTarget,
} from "@/lib/uploads";
import { Button } from "./button";
import { Text } from "./text";

export type Attachment = PickedFile & { key: string; uploadId?: string; state: "uploading" | "done" | "error"; error?: string; progress?: number };

type Props = { value: Attachment[]; onChange: (value: Attachment[]) => void; target: UploadTarget; max?: number };

let counter = 0;
const message = (error: unknown) => (error instanceof UploadError ? error.message : "O envio do anexo falhou. Tente de novo.");

/** The ids to send with the reply, the ticket or the comment: only the files that arrived. */
export const uploadIds = (value: Attachment[]) => value.flatMap((file) => (file.state === "done" && file.uploadId ? [file.uploadId] : []));
/** Whether a file is still on its way (the send waits for it). */
export const uploading = (value: Attachment[]) => value.some((file) => file.state === "uploading");

/**
 * The attachments of one send: the "Anexar" choices (Câmera, Fotos, Arquivo),
 * each file uploaded as soon as it is picked, removing and retrying, with
 * the web's limits (5 files, 20 MB in total, PDF/PNG/JPEG/WebP). Returns the
 * chooser and the chips, for a field (AttachmentField) or a composer.
 */
export function useAttachments({ value, onChange, target, max = ATTACHMENT_RULES.max }: Props) {
  const [error, setError] = useState("");
  // Uploads finish after renders: every change starts from the latest list.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const commit = (update: (files: Attachment[]) => Attachment[]) => {
    const next = update(latest.current);
    latest.current = next;
    onChange(next);
  };
  const patch = (key: string, change: Partial<Attachment>) =>
    commit((files) => files.map((file) => (file.key === key ? { ...file, ...change } : file)));

  async function send(file: Attachment) {
    try {
      const result = await uploadFile(file, target, (progress) => patch(file.key, { progress }));
      if (!latest.current.some((f) => f.key === file.key)) return void discardUpload(result.uploadId);
      patch(file.key, { state: "done", uploadId: result.uploadId, name: result.name, size: result.size, mime: result.mime, progress: 1 });
      AccessibilityInfo.announceForAccessibility(`${file.name} anexado`);
    } catch (failure) {
      haptic.error();
      patch(file.key, { state: "error", error: message(failure) });
    }
  }

  async function add(source: "camera" | "photos" | "files") {
    setError("");
    const current = latest.current;
    let picked: PickedFile[];
    try {
      picked = await pickFiles(source, max - current.length);
    } catch (failure) {
      haptic.error();
      return setError(message(failure));
    }
    if (!picked.length) return;
    const total = [...current, ...picked].reduce((sum, file) => sum + file.size, 0);
    if (current.length + picked.length > max || total > ATTACHMENT_RULES.maxBytes) {
      haptic.error();
      return setError(ATTACHMENT_RULES.limitError);
    }
    const added = picked.map((file): Attachment => ({ ...file, key: `file-${++counter}`, state: "uploading", progress: 0 }));
    commit((files) => [...files, ...added]);
    for (const file of added) void send(file);
  }

  function choose() {
    if (latest.current.length >= max) {
      haptic.error();
      return setError(ATTACHMENT_RULES.limitError);
    }
    if (Platform.OS === "ios") {
      const options = documentsAvailable ? ["Câmera", "Fotos", "Arquivo", "Cancelar"] : ["Câmera", "Fotos", "Cancelar"];
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Anexar", message: ATTACHMENT_RULES.hint, options, cancelButtonIndex: options.length - 1 },
        (index) => {
          if (index === 0) void add("camera");
          else if (index === 1) void add("photos");
          else if (index === 2 && documentsAvailable) void add("files");
        },
      );
      return;
    }
    Alert.alert("Anexar", ATTACHMENT_RULES.hint, [
      { text: "Câmera", onPress: () => void add("camera") },
      { text: "Fotos", onPress: () => void add("photos") },
      ...(documentsAvailable ? [{ text: "Arquivo", onPress: () => void add("files") }] : []),
    ], { cancelable: true });
  }

  function remove(file: Attachment) {
    haptic.light();
    setError("");
    commit((files) => files.filter((f) => f.key !== file.key));
    if (file.uploadId) void discardUpload(file.uploadId);
  }

  function retry(file: Attachment) {
    const again = { ...file, state: "uploading" as const, error: undefined, progress: 0 };
    patch(file.key, again);
    void send(again);
  }

  const chips = value.length ? <AttachmentChips value={value} onRemove={remove} onRetry={retry} /> : null;
  return { choose, chips, error, full: value.length >= max };
}

/** One chip per file: name, size, progress or the error, and remove (retry after an error). */
export function AttachmentChips({ value, onRemove, onRetry }: { value: Attachment[]; onRemove: (file: Attachment) => void; onRetry: (file: Attachment) => void }) {
  const palette = usePalette();
  return (
    <View style={{ gap: space.sm }}>
      {value.map((file) => {
        const failed = file.state === "error";
        const busy = file.state === "uploading";
        const percent = Math.round((file.progress ?? 0) * 100);
        const status = failed ? file.error : busy ? (percent > 0 && percent < 100 ? `Enviando… ${percent}%` : "Enviando…") : fileSize(file.size);
        return (
          <Animated.View
            key={file.key}
            entering={enter}
            exiting={exit}
            layout={layout}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              minHeight: 52,
              paddingLeft: space.md,
              paddingRight: space.xs,
              paddingVertical: space.sm,
              ...rounded(14),
              borderWidth: 1,
              borderColor: failed ? palette.destructiveEdge : palette.border,
              backgroundColor: failed ? palette.destructiveSoft : palette.card,
            }}
          >
            <View
              accessible
              accessibilityLabel={`${file.name}, ${status}`}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.md }}
            >
              <View style={{ width: 32, height: 32, ...rounded(8), backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
                {busy ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <SymbolView
                    name={failed ? "exclamationmark.triangle.fill" : file.mime.startsWith("image/") ? "photo" : "doc.fill"}
                    size={16}
                    tintColor={failed ? palette.destructive : palette.primary}
                    accessible={false}
                  />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" numberOfLines={1}>
                  {file.name}
                </Text>
                <Text variant="caption" tone={failed ? "destructive" : "muted"} numberOfLines={2}>
                  {status}
                </Text>
                {busy ? (
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: palette.fill, overflow: "hidden" }}>
                    <View style={{ width: `${Math.max(4, percent)}%`, height: 3, backgroundColor: palette.primary }} />
                  </View>
                ) : null}
              </View>
            </View>
            {failed ? (
              <ChipButton symbol="arrow.clockwise" label={`Tentar enviar ${file.name} de novo`} onPress={() => onRetry(file)} />
            ) : null}
            <ChipButton symbol="xmark" label={`Remover ${file.name}`} onPress={() => onRemove(file)} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function ChipButton({ symbol, label, onPress }: { symbol: "xmark" | "arrow.clockwise"; label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? palette.fill : "transparent",
      })}
    >
      <SymbolView name={symbol} size={14} weight="semibold" tintColor={palette.muted} accessible={false} />
    </Pressable>
  );
}

/** The error under the chooser, never color alone. */
export function AttachmentError({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return (
    <View accessible accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <SymbolView name="exclamationmark.circle.fill" size={14} tintColor={palette.destructive} accessible={false} />
      <Text variant="caption" tone="destructive" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** Files chosen for a reply, a ticket, a task or a comment, uploaded as they are picked. */
export function AttachmentField(props: Props) {
  const { choose, chips, error, full } = useAttachments(props);
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" accessible={false}>
        Anexos
      </Text>
      {chips}
      <View style={{ alignSelf: "flex-start" }}>
        <Button
          title="Anexar"
          icon="paperclip"
          variant="secondary"
          size="small"
          disabled={full}
          accessibilityHint={ATTACHMENT_RULES.hint}
          onPress={choose}
        />
      </View>
      {error ? (
        <AttachmentError>{error}</AttachmentError>
      ) : (
        <Text variant="caption" tone="muted" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {ATTACHMENT_RULES.hint}
        </Text>
      )}
    </View>
  );
}
