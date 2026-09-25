import { z } from "zod";

/** The visible forms of the screen the person is on, as the assistant's panel reports them. */
export const pageSnapshotSchema = z.object({
  path: z.string().max(300),
  title: z.string().max(160),
  forms: z
    .array(
      z.object({
        id: z.string().max(80),
        title: z.string().max(120),
        fields: z
          .array(
            z.object({
              name: z.string().max(80),
              label: z.string().max(120),
              kind: z.string().max(24),
              value: z.string().max(160),
              required: z.boolean().optional(),
              options: z.array(z.object({ valor: z.string().max(120), texto: z.string().max(80) })).max(40).optional(),
            }),
          )
          .max(60),
        buttons: z.array(z.string().max(60)).max(6),
      }),
    )
    .max(6),
});
export type PageSnapshot = z.infer<typeof pageSnapshotSchema>;

/** The screen, written for the model: one line per field with what it takes. */
export function describePage(page: PageSnapshot) {
  if (!page.forms.length) return `Tela atual: ${page.path} (${page.title}). Sem formulário para preencher nesta tela.`;
  const forms = page.forms.map((form) => {
    const fields = form.fields.map((f) => {
      const parts = [`"${f.name}"`, f.label && f.label !== f.name ? `(${f.label})` : "", f.kind, f.required ? "obrigatório" : "", f.value ? `atual: ${JSON.stringify(f.value)}` : "vazio"];
      const options = f.options?.length ? ` opções: ${f.options.map((o) => (o.texto && o.texto !== o.valor ? `${o.valor}=${o.texto}` : o.valor)).join(" | ")}` : "";
      return `  - ${parts.filter(Boolean).join(" ")}${options}`;
    });
    return `Formulário "${form.title || form.id}"${form.buttons.length ? ` (botões: ${form.buttons.join(", ")})` : ""}:\n${fields.join("\n")}`;
  });
  return `Tela atual: ${page.path} (${page.title}).\n${forms.join("\n")}`;
}
