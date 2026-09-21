"use client";
export async function optimizeImage(file: File, maxSide = 2048): Promise<File> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Escolha um arquivo de até 20 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Não foi possível ler esta imagem. Use PNG, JPEG ou WebP.");
  }
  try {
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Não foi possível reduzir a imagem.")),
        "image/webp",
        0.78,
      ),
    );
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: blob.type,
    });
  } finally {
    bitmap.close();
  }
}
