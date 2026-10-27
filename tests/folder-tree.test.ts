import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_FOLDER_DEPTH, createInRefusal, depthOf, descendantIds, folderPath, moveRefusal, treeOrder } from "../src/lib/bookmarks/folder-tree";

const f = (id: string, parentId: string | null, companyId: string | null = "c1", name = id) => ({ id, parentId, companyId, name });
// marca > logo > svg ; marca > cores ; outra (company c2)
const folders = [f("marca", null), f("logo", "marca"), f("svg", "logo"), f("cores", "marca"), f("outra", null, "c2")];

test("path, descendants and depth follow the parents", () => {
  assert.deepEqual(folderPath(folders, "svg").map((x) => x.id), ["marca", "logo", "svg"]);
  assert.deepEqual(descendantIds(folders, "marca").sort(), ["cores", "logo", "svg"]);
  assert.equal(depthOf(folders, "svg"), 2);
  assert.equal(depthOf(folders, "marca"), 0);
});

test("a folder never moves into itself, below itself or into another company", () => {
  assert.match(moveRefusal(folders, "marca", "svg") ?? "", /dentro dela mesma/);
  assert.match(moveRefusal(folders, "logo", "logo") ?? "", /dentro dela mesma/);
  assert.match(moveRefusal(folders, "cores", "outra") ?? "", /mesma empresa/);
  assert.equal(moveRefusal(folders, "cores", "logo"), null);
  assert.equal(moveRefusal(folders, "svg", ""), null);
});

test("depth is capped, counting the subtree that moves along", () => {
  const deep = [f("a", null), f("b", "a"), f("c", "b"), f("d", "c"), f("e", "d"), f("x", null), f("y", "x")];
  assert.equal(depthOf(deep, "e"), MAX_FOLDER_DEPTH);
  assert.match(createInRefusal(deep, "e") ?? "", /níveis/);
  assert.equal(createInRefusal(deep, "d"), null);
  assert.match(moveRefusal(deep, "x", "d") ?? "", /níveis/);
  assert.equal(moveRefusal(deep, "x", "c"), null);
});

test("the sidebar lists each folder with its subfolders under it, by name", () => {
  assert.deepEqual(
    treeOrder(folders).map((x) => `${x.depth}:${x.id}`),
    ["0:marca", "1:cores", "1:logo", "2:svg", "0:outra"],
  );
  // A parent the viewer cannot see: the child shows at the top.
  assert.deepEqual(treeOrder([f("svg", "logo")]).map((x) => `${x.depth}:${x.id}`), ["0:svg"]);
});
