import { safeFileName } from "./bookmark-validation";
export async function prepareTicketFiles(values: FormDataEntryValue[]) {
  const files = values.filter(
    (value): value is File => value instanceof File && value.size > 0,
  );
  if (
    files.length > 5 ||
    files.reduce((total, file) => total + file.size, 0) > 1024 * 1024
  )
    throw new Error("Selecione até 5 anexos, com no máximo 1 MB no total.");
  return Promise.all(
    files.map(async (file) => {
      const content = Buffer.from(await file.arrayBuffer());
      const mime =
        content.subarray(0, 5).toString() === "%PDF-"
          ? "application/pdf"
          : content
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ? "image/png"
            : content[0] === 255 && content[1] === 216 && content[2] === 255
              ? "image/jpeg"
              : null;
      if (!mime) throw new Error("Envie anexos PDF, PNG ou JPEG válidos.");
      return { name: safeFileName(file.name), size: file.size, mime, content };
    }),
  );
}
