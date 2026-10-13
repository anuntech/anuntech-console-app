"use client";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Excalidraw, MainMenu, WelcomeScreen, exportToBlob, getSceneVersion, serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import "./board-theme.css";
import { useAppearance } from "@/components/shell/appearance-provider";
import { BOARD_TOO_LARGE, MAX_BOARD_BYTES, type BoardScene } from "@/lib/bookmarks/board-rules";

export type SaveStatus =
  | { state: "saved"; at: string | null }
  | { state: "dirty" }
  | { state: "saving" }
  | { state: "error"; message: string };

type Change = Parameters<NonNullable<ExcalidrawProps["onChange"]>>;

/** A stroke settles for this long before it goes to the server. */
const SAVE_DELAY = 1200;
/** A failed save tries again on its own, unless a new stroke does it first. */
const RETRY_DELAY = 8000;
/** The card thumbnail: wide enough to read, small enough to keep in the row. */
const PREVIEW_SIZE = 720;

const DARK_QUERY = "(prefers-color-scheme: dark)";
const backIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);
const subscribeToScheme = (notify: () => void) => {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const systemPrefersDark = () => window.matchMedia(DARK_QUERY).matches;

/**
 * The whiteboard itself, loaded only on the client (Excalidraw draws on a
 * canvas). Every change is serialized and sent after a short pause; the
 * caller shows the status. Read-only viewers get Excalidraw's view mode.
 */
export default function BoardCanvas({
  id,
  title,
  scene,
  editable,
  onStatus,
}: {
  id: string;
  /** Names the image the person exports. */
  title: string;
  scene: BoardScene;
  editable: boolean;
  onStatus: (status: SaveStatus) => void;
}) {
  const { theme } = useAppearance();
  const prefersDark = useSyncExternalStore(subscribeToScheme, systemPrefersDark, () => false);
  const dark = theme === "dark" || (theme !== "light" && prefersDark);

  const latest = useRef<Change | null>(null);
  const savedVersion = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const first = useRef(true);
  const dirty = useRef(false);
  // The retry timer and the queued save call whatever `save` is by then.
  const saveRef = useRef<() => Promise<void>>(async () => {});

  const save = useCallback(async () => {
    const change = latest.current;
    if (!change || inFlight.current) {
      queued.current = !!change;
      return;
    }
    const [elements, appState, files] = change;
    const version = getSceneVersion(elements);
    if (version === savedVersion.current) {
      dirty.current = false;
      return;
    }
    inFlight.current = true;
    onStatus({ state: "saving" });
    try {
      const json = serializeAsJSON(elements, appState, files, "database");
      if (new Blob([json]).size > MAX_BOARD_BYTES) throw new Error(BOARD_TOO_LARGE);
      const body = new FormData();
      body.set("scene", json);
      if (first.current) body.set("first", "1");
      const drawn = elements.filter((element) => !element.isDeleted);
      if (drawn.length) {
        try {
          const preview = await exportToBlob({
            elements: drawn,
            appState: { ...appState, exportBackground: true, exportWithDarkMode: false },
            files,
            mimeType: "image/png",
            maxWidthOrHeight: PREVIEW_SIZE,
          });
          body.set("preview", preview, "lousa.png");
        } catch {
          // The scene still saves; the card keeps its last picture.
        }
      }
      const response = await fetch(`/api/bookmarks/${id}/lousa`, { method: "PUT", body });
      const data = (await response.json().catch(() => null)) as { savedAt?: string; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar a lousa. Tente novamente.");
      savedVersion.current = version;
      first.current = false;
      dirty.current = false;
      onStatus({ state: "saved", at: data?.savedAt ?? new Date().toISOString() });
    } catch (error) {
      onStatus({ state: "error", message: error instanceof Error ? error.message : "Não foi possível salvar a lousa." });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveRef.current(), RETRY_DELAY);
    } finally {
      inFlight.current = false;
      if (queued.current) {
        queued.current = false;
        void saveRef.current();
      }
    }
  }, [id, onStatus]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const onChange = useCallback<NonNullable<ExcalidrawProps["onChange"]>>(
    (elements, appState, files) => {
      if (!editable) return;
      if (savedVersion.current === null) {
        // The first call is the scene as it was loaded: nothing to save yet.
        savedVersion.current = getSceneVersion(elements);
        return;
      }
      latest.current = [elements, appState, files];
      if (getSceneVersion(elements) === savedVersion.current && !dirty.current) return;
      if (!dirty.current) {
        dirty.current = true;
        onStatus({ state: "dirty" });
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveRef.current(), SAVE_DELAY);
    },
    [editable, onStatus],
  );

  // Leaving with a stroke still on its way loses it: the browser asks first.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="anuntech-board h-full">
      <Excalidraw
        initialData={{
          elements: scene.elements as never,
          appState: scene.appState as never,
          files: scene.files as never,
          scrollToContent: true,
        }}
        onChange={onChange}
        viewModeEnabled={!editable}
        theme={dark ? "dark" : "light"}
        langCode="pt-BR"
        name={title}
        autoFocus={editable}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            export: { saveFileToDisk: true },
          },
        }}
      >
        {/* Only what belongs to the Console: no library, help or links to Excalidraw's site. */}
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          {editable && <MainMenu.DefaultItems.ClearCanvas />}
          <MainMenu.Separator />
          <MainMenu.ItemLink href="/bookmarks" icon={backIcon}>
            Voltar aos bookmarks
          </MainMenu.ItemLink>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Logo>
              {/* The Console's own mark; a plain image because this runs inside Excalidraw's tree. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/symbol.png" alt="Anuntech" width={56} height={56} />
            </WelcomeScreen.Center.Logo>
            <WelcomeScreen.Center.Heading>
              {editable ? "Sua lousa está em branco." : "Ainda não há nada nesta lousa."}
            </WelcomeScreen.Center.Heading>
          </WelcomeScreen.Center>
          {editable && (
            <>
              <WelcomeScreen.Hints.ToolbarHint>Escolha uma ferramenta e desenhe</WelcomeScreen.Hints.ToolbarHint>
              <WelcomeScreen.Hints.MenuHint>Exportar, limpar ou voltar</WelcomeScreen.Hints.MenuHint>
            </>
          )}
        </WelcomeScreen>
      </Excalidraw>
    </div>
  );
}
