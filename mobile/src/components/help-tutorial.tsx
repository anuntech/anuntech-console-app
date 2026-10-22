import { useState } from "react";
import { Pressable, View } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { SymbolView } from "expo-symbols";
import type * as ExpoVideo from "expo-video";
import * as WebBrowser from "expo-web-browser";
import type { api } from "@/lib/api";
import { CONSOLE_URL } from "@/lib/config";
import { rounded, space, usePalette } from "@/lib/theme";
import { ListRow } from "./list-row";
import { PressableScale } from "./pressable-scale";
import { Section } from "./section";
import { Text } from "./text";

type Tutorial = NonNullable<
  Awaited<ReturnType<typeof api.help.get>>["tutorial"]
>;

/** "1 min 30 s", as the web's player says it. */
export function durationLabel(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes
    ? rest
      ? `${minutes} min ${rest} s`
      : `${minutes} min`
    : `${rest} s`;
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/*
 * The player is a native module that builds before 1.2.0 do not have: an
 * update over the air must not crash them, so there the video opens in the
 * system player instead.
 */
const video: typeof ExpoVideo | null = requireOptionalNativeModule("ExpoVideo")
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("expo-video") as typeof ExpoVideo)
  : null;

type Seek = (at?: number) => void;

/** Moves the player to a second and plays (outside render: the player is a native object). */
function jump(player: ExpoVideo.VideoPlayer, at?: number) {
  player.currentTime = at ?? 0;
  player.play();
}

/** The video file on the Console, from a given second (#t= opens the system player there). */
function play(tutorial: Tutorial, at?: number) {
  const url = `${CONSOLE_URL}${tutorial.src}${at ? `#t=${Math.floor(at)}` : ""}`;
  void WebBrowser.openBrowserAsync(url);
}

/**
 * A tutorial video: the cover opens it in the system player (the app has no
 * video module yet), each chapter starts it at its step, and the narration
 * reads below with the second of each line. The captions are in the video.
 */
export function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  return video ? (
    <InlineTutorial tutorial={tutorial} module={video} />
  ) : (
    <TutorialBody tutorial={tutorial} seek={(at) => play(tutorial, at)} />
  );
}

/** In the app's own player (1.2.0 on): chapters and the narration jump the video to their second. */
function InlineTutorial({
  tutorial,
  module,
}: {
  tutorial: Tutorial;
  module: typeof ExpoVideo;
}) {
  const palette = usePalette();
  const player = module.useVideoPlayer(`${CONSOLE_URL}${tutorial.src}`);
  const seek: Seek = (at) => jump(player, at);
  const View_ = module.VideoView;
  return (
    <TutorialBody
      tutorial={tutorial}
      seek={seek}
      cover={
        <View
          style={{
            ...rounded(24),
            overflow: "hidden",
            backgroundColor: palette.dark ? palette.card : "#000",
          }}
        >
          <View_
            player={player}
            nativeControls
            fullscreenOptions={{ enable: true }}
            accessibilityLabel={`Vídeo: ${tutorial.title}, ${durationLabel(tutorial.duration)}`}
            style={{ width: "100%", aspectRatio: 16 / 9 }}
          />
        </View>
      }
    />
  );
}

/**
 * A tutorial video: the cover plays it (in the app, or the system player on
 * older builds), each chapter starts it at its step, and the narration reads
 * below with the second of each line. The captions are in the video.
 */
function TutorialBody({
  tutorial,
  seek,
  cover,
}: {
  tutorial: Tutorial;
  seek: Seek;
  cover?: React.ReactNode;
}) {
  const palette = usePalette();
  const [transcript, setTranscript] = useState(false);
  return (
    <View style={{ gap: space.md }}>
      {cover ?? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Assistir ao vídeo: ${tutorial.title}, ${durationLabel(tutorial.duration)}`}
          accessibilityHint="Abre o vídeo"
          onPress={() => seek()}
          style={{
            backgroundColor: palette.accent,
            ...rounded(24),
            padding: space.lg,
            gap: space.md,
            minHeight: 160,
            justifyContent: "flex-end",
          }}
        >
          {" "}
          <Text variant="caption" tone="muted">
            Tutorial em vídeo
          </Text>
          <Text variant="heading">{tutorial.title}</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: palette.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SymbolView
                name="play.fill"
                size={18}
                tintColor={palette.primaryForeground}
                accessible={false}
                style={{ marginLeft: 2 }}
              />
            </View>
            <Text variant="subhead" tone="muted">
              Assistir · {durationLabel(tutorial.duration)}
            </Text>
          </View>
        </PressableScale>
      )}
      <Section header="Passos do vídeo" indent={56}>
        {tutorial.chapters.map((chapter, i) => (
          <ListRow
            key={chapter.start}
            leading={
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: palette.secondary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="micro">{i + 1}</Text>
              </View>
            }
            title={chapter.title}
            subtitle={chapter.hint}
            value={clock(chapter.start)}
            trailing="none"
            accessibilityLabel={`Passo ${i + 1}: ${chapter.title}. ${chapter.hint}. Começa em ${clock(chapter.start)}`}
            accessibilityHint="Toca o vídeo a partir deste passo"
            onPress={() => seek(chapter.start)}
          />
        ))}
      </Section>
      <View
        style={{
          backgroundColor: palette.card,
          ...rounded(24),
          overflow: "hidden",
          ...(palette.dark
            ? { borderWidth: 1, borderColor: palette.border }
            : {}),
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: transcript }}
          onPress={() => setTranscript((v) => !v)}
          style={({ pressed }) => ({
            minHeight: space.row,
            paddingHorizontal: space.lg,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: pressed ? palette.fill : "transparent",
          })}
        >
          <Text variant="body" style={{ flex: 1 }}>
            O que o vídeo diz
          </Text>
          <SymbolView
            name={transcript ? "chevron.up" : "chevron.down"}
            size={13}
            weight="semibold"
            tintColor={palette.tertiary}
            accessible={false}
          />
        </Pressable>
        {transcript ? (
          <View
            style={{
              paddingHorizontal: space.lg,
              paddingBottom: space.lg,
              gap: space.md,
            }}
          >
            {tutorial.transcript.map((line) => (
              <View
                key={line.at}
                style={{
                  flexDirection: "row",
                  gap: space.md,
                  alignItems: "flex-start",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ir para ${clock(line.at)}`}
                  hitSlop={8}
                  onPress={() => seek(line.at)}
                >
                  <Text
                    variant="label"
                    tone="primary"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {clock(line.at)}
                  </Text>
                </Pressable>
                <Text variant="subhead" selectable style={{ flex: 1 }}>
                  {line.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
