import { z } from "zod";
export const bookmarkInput = z.object({
  folderId: z.union([z.string().uuid(), z.literal("")]).default(""),
  title: z.string().trim().min(1, "Informe um título.").max(160),
  url: z
    .string()
    .trim()
    .max(2048)
    .default("")
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return (
          ["https:", "http:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    }, "Informe um link HTTP ou HTTPS válido, sem credenciais."),
});
export function safeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 150) || "arquivo";
}
