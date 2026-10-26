/*
 * Folders inside folders (Arquivos): the path, the descendants, the depth and
 * where a folder may move. Pure, so the sidebar, the actions and the tests
 * share it. Folders of one company only; a cycle can never be built, since a
 * folder never moves into itself or below itself.
 */

export type TreeFolder = { id: string; parentId: string | null; companyId: string | null; name: string };

/** Levels below the top: Marca › Logo › SVG is depth 2. */
export const MAX_FOLDER_DEPTH = 4;

const byId = <T extends TreeFolder>(folders: T[]) => new Map(folders.map((f) => [f.id, f]));

/** From the top to the folder itself; a parent the viewer cannot see ends the path there. */
export function folderPath<T extends TreeFolder>(folders: T[], id: string): T[] {
  const index = byId(folders);
  const path: T[] = [];
  const seen = new Set<string>();
  for (let current = index.get(id); current && !seen.has(current.id); current = current.parentId ? index.get(current.parentId) : undefined) {
    seen.add(current.id);
    path.unshift(current);
  }
  return path;
}

/** Every folder below this one, at any depth. */
export function descendantIds(folders: TreeFolder[], id: string): string[] {
  const children = new Map<string, string[]>();
  for (const f of folders) if (f.parentId) children.set(f.parentId, [...(children.get(f.parentId) ?? []), f.id]);
  const out: string[] = [];
  const queue = [...(children.get(id) ?? [])];
  while (queue.length) {
    const next = queue.shift()!;
    if (out.includes(next)) continue;
    out.push(next);
    queue.push(...(children.get(next) ?? []));
  }
  return out;
}

export const depthOf = (folders: TreeFolder[], id: string) => folderPath(folders, id).length - 1;

/** How many levels a folder's subtree takes below it (0 without subfolders). */
export function heightOf(folders: TreeFolder[], id: string) {
  const below = descendantIds(folders, id);
  return below.length ? Math.max(...below.map((d) => depthOf(folders, d) - depthOf(folders, id))) : 0;
}

/** Why a new folder cannot go inside `parentId`, or null. */
export function createInRefusal(folders: TreeFolder[], parentId: string) {
  return depthOf(folders, parentId) + 1 > MAX_FOLDER_DEPTH ? `Pastas vão até ${MAX_FOLDER_DEPTH + 1} níveis.` : null;
}

/** Why `id` cannot move into `target` ("" is the top), or null. */
export function moveRefusal(folders: TreeFolder[], id: string, target: string) {
  const folder = folders.find((f) => f.id === id);
  if (!folder) return "Pasta não encontrada.";
  if (!target) return null;
  if (target === id || descendantIds(folders, id).includes(target)) return "Uma pasta não vai para dentro dela mesma.";
  const into = folders.find((f) => f.id === target);
  if (!into) return "Pasta não encontrada.";
  if ((into.companyId ?? "") !== (folder.companyId ?? "")) return "As duas pastas precisam ser da mesma empresa.";
  if (depthOf(folders, target) + 1 + heightOf(folders, id) > MAX_FOLDER_DEPTH) return `Pastas vão até ${MAX_FOLDER_DEPTH + 1} níveis.`;
  return null;
}

/** The sidebar order: each folder followed by its subfolders, by name, with its depth. */
export function treeOrder<T extends TreeFolder>(folders: T[]): (T & { depth: number })[] {
  const present = new Set(folders.map((f) => f.id));
  const children = new Map<string | null, T[]>();
  // A folder whose parent the viewer cannot see shows at the top.
  for (const f of folders) {
    const parent = f.parentId && present.has(f.parentId) ? f.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), f]);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const out: (T & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const f of children.get(parent) ?? []) {
      if (out.some((o) => o.id === f.id)) continue;
      out.push({ ...f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
