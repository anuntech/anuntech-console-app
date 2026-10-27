/*
 * A folder downloaded as one .zip (Arquivos): what goes in, under which name,
 * and how big it may be. Pure, so the route, the shared link and the tests
 * read the same rule. The archive is built as it is sent, without
 * compression (photos, videos and PDFs are compressed already), and without
 * ZIP64, so the whole stays under 4 GB: past that, the folder is downloaded
 * in parts (its subfolders) or file by file.
 */

/** The most a .zip carries; past it the person is told to download in parts. */
export const ZIP_MAX_BYTES = 3.5 * 1024 ** 3;
export const ZIP_MAX_FILES = 2000;

export type ZipEntry = { id: string; fileName: string; size: number; path: string };

/** A safe name inside the zip: no folders from the name, no "..", nothing invisible. */
const safe = (part: string) =>
  part
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/^\.+$/, "_")
    .trim()
    .slice(0, 150) || "arquivo";

/** Each file's place in the zip ("Logo/SVG/marca.svg"), a repeated name numbered like the browser does. */
export function zipNames(entries: ZipEntry[]) {
  const taken = new Set<string>();
  return entries.map((entry) => {
    const folders = entry.path ? entry.path.split(" › ").map(safe) : [];
    const name = safe(entry.fileName);
    const dot = name.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let candidate = [...folders, name].join("/");
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = [...folders, `${stem} (${n})${ext}`].join("/");
    taken.add(candidate.toLowerCase());
    return { ...entry, zipPath: candidate };
  });
}

export function zipRefusal(entries: { size: number }[]) {
  if (!entries.length) return "Esta pasta não tem arquivos para baixar.";
  if (entries.length > ZIP_MAX_FILES) return `A pasta tem mais de ${ZIP_MAX_FILES} arquivos. Baixe as pastas de dentro uma de cada vez.`;
  if (entries.reduce((sum, e) => sum + e.size, 0) > ZIP_MAX_BYTES) return "A pasta passa de 3,5 GB. Baixe as pastas de dentro uma de cada vez, ou os arquivos maiores um a um.";
  return null;
}

/** The .zip's own name, from the folder's. */
export const zipFileName = (folderName: string) => `${safe(folderName)}.zip`;
