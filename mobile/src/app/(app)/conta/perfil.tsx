import { useState } from "react";
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Bar, useDelayed } from "@/components/skeleton";
import { Card, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { PhotoError, pickPhoto, showAvatar, uploadPhoto } from "@/lib/profile";
import { space, usePalette } from "@/lib/theme";

type Pending = "upload" | "remove" | "name" | null;
type Feedback = { kind: "success" | "error"; text: string } | null;

/**
 * The profile, as Minha conta's "Perfil" on the web: the picture (a photo
 * from the camera or the library, an illustration, or none) and the name.
 */
export default function Profile() {
  const palette = usePalette();
  const queryClient = useQueryClient();
  const me = useMe();
  const bottom = useTabBarSpace();
  const loading = useDelayed(me.isPending);
  // null: the saved name; anything else: what the person is typing.
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [photoFeedback, setPhotoFeedback] = useState<Feedback>(null);
  const [nameFeedback, setNameFeedback] = useState<Feedback>(null);
  const saved = me.data?.name ?? "";
  const name = draft ?? saved;
  const photo = me.data?.avatar?.kind === "photo";

  function done(set: (feedback: Feedback) => void, text: string) {
    haptic.success();
    set({ kind: "success", text });
  }
  function failed(set: (feedback: Feedback) => void, text: string) {
    haptic.error();
    set({ kind: "error", text });
  }

  async function sendPhoto(source: "camera" | "library") {
    setPhotoFeedback(null);
    try {
      const asset = await pickPhoto(source);
      if (!asset) return;
      setPending("upload");
      const result = await uploadPhoto(asset);
      showAvatar(result.avatar);
      done(setPhotoFeedback, result.message);
    } catch (failure) {
      failed(setPhotoFeedback, failure instanceof PhotoError ? failure.message : "Não foi possível alterar a foto. Tente novamente.");
    } finally {
      setPending(null);
    }
  }

  async function removePhoto() {
    setPending("remove");
    setPhotoFeedback(null);
    try {
      const result = await api.profile.removePhoto({});
      showAvatar(result.avatar);
      done(setPhotoFeedback, result.message);
    } catch (failure) {
      failed(setPhotoFeedback, errorMessage(failure));
    } finally {
      setPending(null);
    }
  }

  function confirmRemoval() {
    Alert.alert("Remover foto?", "Seu perfil volta a mostrar uma ilustração.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => void removePhoto() },
    ]);
  }

  /** The choices for the picture: an action sheet on iOS, a dialog on Android. */
  function changePhoto() {
    const choose = () => router.push("/conta/ilustracao");
    if (Platform.OS === "ios") {
      const options = ["Tirar foto", "Escolher da galeria", "Escolher ilustração", ...(photo ? ["Remover foto"] : []), "Cancelar"];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Foto do perfil",
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: photo ? 3 : undefined,
        },
        (index) => {
          if (index === 0) void sendPhoto("camera");
          else if (index === 1) void sendPhoto("library");
          else if (index === 2) choose();
          else if (photo && index === 3) confirmRemoval();
        },
      );
      return;
    }
    // An Android dialog holds three buttons; "Remover foto" has its own button on the screen.
    Alert.alert(
      "Foto do perfil",
      undefined,
      [
        { text: "Escolher ilustração", onPress: choose },
        { text: "Escolher da galeria", onPress: () => void sendPhoto("library") },
        { text: "Tirar foto", onPress: () => void sendPhoto("camera") },
      ],
      { cancelable: true },
    );
  }

  async function saveName() {
    const value = name.trim();
    setNameFeedback(null);
    if (value.length < 2 || value.length > 100) {
      failed(setNameFeedback, "Informe um nome entre 2 e 100 caracteres.");
      return;
    }
    setPending("name");
    try {
      const result = await api.profile.rename({ name: value });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setDraft(null);
      done(setNameFeedback, result.message);
    } catch (failure) {
      failed(setNameFeedback, errorMessage(failure));
    } finally {
      setPending(null);
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
      >
        <Text tone="muted">Como você aparece para a equipe e para as outras pessoas do ambiente.</Text>
        {me.error ? <Notice kind="error">{errorMessage(me.error)}</Notice> : null}
        {loading ? (
          <View accessible accessibilityLabel="Carregando" style={{ alignItems: "center", gap: space.lg }}>
            <Bar width={112} height={112} radius={56} />
            <Bar width={140} height={36} radius={18} />
            <Bar width="100%" height={120} radius={24} />
          </View>
        ) : null}
        {me.data ? (
          <>
            <View style={{ alignItems: "center", gap: space.md }}>
              <View accessible accessibilityLabel={photo ? "Sua foto de perfil" : "Sua imagem de perfil"}>
                <Avatar avatar={me.data.avatar} name={me.data.name} email={me.data.email} size={112} />
              </View>
              <Button
                title={pending === "upload" ? "Enviando foto…" : pending === "remove" ? "Removendo foto…" : "Alterar foto"}
                icon="camera.fill"
                variant="secondary"
                size="small"
                testID="change-photo"
                busy={pending === "upload" || pending === "remove"}
                disabled={!!pending}
                onPress={changePhoto}
              />
              {Platform.OS === "android" && photo ? (
                <Button
                  title="Remover foto"
                  icon="trash"
                  variant="plain"
                  size="small"
                  testID="remove-photo"
                  disabled={!!pending}
                  onPress={confirmRemoval}
                />
              ) : null}
            </View>
            {photoFeedback ? <Notice kind={photoFeedback.kind}>{photoFeedback.text}</Notice> : null}
            <Card>
              <Field
                label="Nome"
                testID="profile-name"
                value={name}
                onChangeText={(next) => {
                  setDraft(next);
                  setNameFeedback(null);
                }}
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                maxLength={100}
                editable={pending !== "name"}
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
              />
              <Button
                title={pending === "name" ? "Salvando…" : "Salvar"}
                testID="save-name"
                busy={pending === "name"}
                disabled={!!pending || name.trim() === saved.trim()}
                onPress={() => void saveName()}
              />
            </Card>
            {nameFeedback ? <Notice kind={nameFeedback.kind}>{nameFeedback.text}</Notice> : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
