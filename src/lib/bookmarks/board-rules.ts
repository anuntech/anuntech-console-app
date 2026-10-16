import { z } from "zod";

/**
 * What a whiteboard bookmark keeps: an Excalidraw scene, as the editor
 * serializes it. Pure rules, shared by the editor, the save route and the
 * tests; no database and no Next here.
 */
export type BoardScene = {
  type: "excalidraw";
  version: 2;
  source?: string;
  elements: Record<string, unknown>[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

/** A new whiteboard: nothing drawn yet. */
export const EMPTY_BOARD: BoardScene = {
  type: "excalidraw",
  version: 2,
  elements: [],
  appState: {},
  files: {},
};

/** Vercel accepts request bodies up to 4.5 MB; the scene and its preview share it. */
export const MAX_BOARD_BYTES = 3 * 1024 * 1024;
export const MAX_PREVIEW_BYTES = 1024 * 1024;
/** Enough for any real diagram; a scene past it is a runaway, not a drawing. */
export const MAX_BOARD_ELEMENTS = 5000;

export const BOARD_TOO_LARGE = "A lousa passou de 3 MB. Reduza as imagens coladas para continuar salvando.";
export const BOARD_INVALID = "O desenho não pôde ser lido. Recarregue a página e tente de novo.";

const record = z.record(z.string(), z.unknown());
const boardSchema = z.object({
  type: z.literal("excalidraw").default("excalidraw"),
  version: z.literal(2).default(2),
  source: z.string().max(200).optional(),
  elements: z.array(record).max(MAX_BOARD_ELEMENTS),
  appState: record.default({}),
  files: record.default({}),
});

export type BoardParse = { board: BoardScene } | { error: string };

/** The scene text the editor posted, checked for size and shape. */
export function parseBoard(json: string): BoardParse {
  if (Buffer.byteLength(json, "utf8") > MAX_BOARD_BYTES) return { error: BOARD_TOO_LARGE };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { error: BOARD_INVALID };
  }
  const parsed = boardSchema.safeParse(data);
  if (!parsed.success) return { error: BOARD_INVALID };
  return { board: parsed.data as BoardScene };
}

/** "meeting" is a note from the Mac app (lib/meetings); it is never made from the sheet. */
export type BookmarkKind = "link" | "file" | "board" | "meeting";
/** What the sheet's "Tipo" offers. */
export const bookmarkKinds = ["link", "file", "board"] as const;

/** Which kind a bookmark is, from what it stores. */
export function kindOf(item: {
  url: string | null;
  fileName: string | null;
  board?: boolean | null;
  meeting?: unknown;
}): BookmarkKind {
  if (item.board) return "board";
  if (item.meeting && item.fileName) return "meeting";
  if (item.fileName) return "file";
  return "link";
}

/** Where a whiteboard opens. */
export const boardHref = (id: string) => `/bookmarks/${id}/lousa`;
/** Where a meeting note opens to be read. */
export const meetingHref = (id: string) => `/bookmarks/${id}/reuniao`;
