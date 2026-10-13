import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_INVALID,
  BOARD_TOO_LARGE,
  EMPTY_BOARD,
  MAX_BOARD_BYTES,
  MAX_BOARD_ELEMENTS,
  boardHref,
  kindOf,
  parseBoard,
} from "../src/lib/bookmarks/board-rules";

const rect = { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10, version: 1 };

test("a whiteboard scene keeps its elements, state and files", () => {
  const parsed = parseBoard(
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "console",
      elements: [rect],
      appState: { viewBackgroundColor: "#ffffff" },
      files: { f1: { mimeType: "image/png", dataURL: "data:image/png;base64,AA==" } },
    }),
  );
  assert.ok("board" in parsed);
  assert.equal(parsed.board.elements.length, 1);
  assert.equal(parsed.board.appState.viewBackgroundColor, "#ffffff");
  assert.ok("f1" in parsed.board.files);
});

test("the editor's minimal payload fills in type, version, state and files", () => {
  const parsed = parseBoard(JSON.stringify({ elements: [] }));
  assert.ok("board" in parsed);
  assert.deepEqual(parsed.board, EMPTY_BOARD);
});

test("a scene that is not a scene is refused, not stored", () => {
  for (const json of ["", "{", "[]", "null", JSON.stringify({ elements: "x" }), JSON.stringify({ elements: [1] })]) {
    const parsed = parseBoard(json);
    assert.ok("error" in parsed, json);
    assert.equal(parsed.error, BOARD_INVALID);
  }
});

test("a scene past the size or element limits is refused with the size message", () => {
  const big = parseBoard(JSON.stringify({ elements: [{ text: "x".repeat(MAX_BOARD_BYTES) }] }));
  assert.ok("error" in big && big.error === BOARD_TOO_LARGE);
  const many = parseBoard(JSON.stringify({ elements: Array.from({ length: MAX_BOARD_ELEMENTS + 1 }, () => ({})) }));
  assert.ok("error" in many && many.error === BOARD_INVALID);
});

test("a bookmark is a link, a file or a whiteboard by what it stores", () => {
  assert.equal(kindOf({ url: "https://example.com", fileName: null }), "link");
  assert.equal(kindOf({ url: null, fileName: "a.pdf" }), "file");
  assert.equal(kindOf({ url: null, fileName: null, board: true }), "board");
  assert.equal(kindOf({ url: null, fileName: null, board: false }), "link");
  assert.equal(boardHref("abc"), "/bookmarks/abc/lousa");
});
