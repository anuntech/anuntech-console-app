"use client";
import { useRef, useState } from "react";
import { FormSheet } from "@/components/console/form-sheet";
import { FormField } from "@/components/console/form-field";
import { AttachmentField } from "@/components/console/attachment-field";
import { FileChip, FileChips } from "@/components/console/file-chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendEmail } from "@/lib/mail/mail-actions";
import {
  MAIL_MAX_ATTACHMENTS,
  MAIL_TOTAL_ATTACHMENT_BYTES,
  MAIL_UPLOAD_MAX_BYTES,
  type ComposeDraft,
} from "@/lib/mail/mail-rules";
import type { AttachmentRules } from "@/lib/tickets/attachment-rules";
import type { AttachmentView } from "@/lib/mail/mailbox";

const RULES: AttachmentRules = {
  acceptLabel: "Qualquer tipo, até 4 MB cada",
  max: MAIL_MAX_ATTACHMENTS,
  maxBytes: MAIL_TOTAL_ATTACHMENT_BYTES,
};

export type ComposeState = { key: string; draft: ComposeDraft; forwarded: AttachmentView[] };

const TITLES = { new: "Nova mensagem", reply: "Responder", replyAll: "Responder a todos", forward: "Encaminhar" } as const;

/**
 * Write, reply or forward: plain text from the open mailbox. New files go to
 * the mail server one per request (/api/email/envio, up to 4 MB each) before
 * the action runs; a forward keeps the original's attachments by blobId.
 */
export function ComposeSheet({
  caixa,
  open,
  state,
  onOpenChange,
}: {
  caixa: string;
  open: boolean;
  /** The last draft opened; it stays while the sheet slides out. */
  state: ComposeState | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [forwarded, setForwarded] = useState<AttachmentView[]>(state?.forwarded ?? []);
  const [shownKey, setShownKey] = useState(state?.key);
  // A new draft (another reply, another message) brings its own attachments.
  if (state && state.key !== shownKey) {
    setShownKey(state.key);
    setForwarded(state.forwarded);
  }
  // A file already sent to the server is not sent again when the form is fixed and resent.
  const uploaded = useRef(new WeakMap<File, AttachmentView>());
  const draft = state?.draft;
  async function prepare(form: FormData) {
    const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    const big = files.find((file) => file.size > MAIL_UPLOAD_MAX_BYTES);
    if (big) throw new Error(`“${big.name}” passa de 4 MB. Anexe um arquivo menor ou mande por Arquivos.`);
    const total = [...forwarded, ...files].reduce((sum, file) => sum + file.size, 0);
    if (total > MAIL_TOTAL_ATTACHMENT_BYTES) throw new Error("Os anexos passam de 25 MB no total. Tire algum e envie de novo.");
    if (forwarded.length + files.length > MAIL_MAX_ATTACHMENTS) throw new Error(`Uma mensagem leva até ${MAIL_MAX_ATTACHMENTS} anexos.`);
    form.delete("files");
    const sent: AttachmentView[] = [];
    for (const file of files) {
      const known = uploaded.current.get(file);
      if (known) {
        sent.push(known);
        continue;
      }
      const response = await fetch(`/api/email/envio?caixa=${encodeURIComponent(caixa)}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const result = (await response.json().catch(() => null)) as { blobId?: string; type?: string; size?: number; error?: string } | null;
      if (!response.ok || !result?.blobId) throw new Error(result?.error || `Não foi possível anexar “${file.name}”. Tente de novo.`);
      const view = { blobId: result.blobId, name: file.name, type: result.type || file.type, size: result.size ?? file.size };
      uploaded.current.set(file, view);
      sent.push(view);
    }
    form.set("anexos", JSON.stringify([...forwarded, ...sent]));
    return form;
  }
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={draft ? TITLES[draft.mode] : TITLES.new}
      description={`De ${caixa}`}
      action={sendEmail}
      prepare={prepare}
      formKey={state?.key}
      submitLabel="Enviar"
      pendingLabel="Enviando…"
    >
      <input type="hidden" name="caixa" value={caixa} />
      <input type="hidden" name="inReplyTo" value={JSON.stringify(draft?.inReplyTo ?? [])} />
      <input type="hidden" name="references" value={JSON.stringify(draft?.references ?? [])} />
      <FormField label="Para" htmlFor="mail-to" hint="Separe os endereços por vírgula.">
        <Input
          id="mail-to"
          name="para"
          type="text"
          inputMode="email"
          autoComplete="off"
          defaultValue={draft?.to}
          autoFocus={!draft?.to}
          maxLength={10_000}
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Cc" htmlFor="mail-cc">
          <Input id="mail-cc" name="cc" type="text" inputMode="email" autoComplete="off" defaultValue={draft?.cc} maxLength={10_000} />
        </FormField>
        <FormField label="Cco" htmlFor="mail-bcc" hint="Ninguém vê quem está em Cco.">
          <Input id="mail-bcc" name="cco" type="text" inputMode="email" autoComplete="off" maxLength={10_000} />
        </FormField>
      </div>
      <FormField label="Assunto" htmlFor="mail-subject">
        <Input id="mail-subject" name="assunto" type="text" defaultValue={draft?.subject} maxLength={998} />
      </FormField>
      <FormField label="Mensagem" htmlFor="mail-body">
        <Textarea
          id="mail-body"
          name="corpo"
          rows={14}
          defaultValue={draft?.body}
          autoFocus={!!draft?.to}
          // A reply starts above the quote.
          onFocus={(event) => {
            if (draft?.mode !== "new" && event.currentTarget.dataset.placed !== "1") {
              event.currentTarget.dataset.placed = "1";
              event.currentTarget.setSelectionRange(0, 0);
              event.currentTarget.scrollTop = 0;
            }
          }}
          className="field-sizing-fixed min-h-64 font-sans"
        />
      </FormField>
      <FormField label="Anexos">
        <div className="grid gap-3">
          {forwarded.length > 0 && (
            <FileChips>
              {forwarded.map((file) => (
                <li key={file.blobId}>
                  <FileChip
                    file={{ name: file.name, size: file.size, mime: file.type }}
                    onRemove={() => setForwarded((list) => list.filter((item) => item.blobId !== file.blobId))}
                  />
                </li>
              ))}
            </FileChips>
          )}
          <AttachmentField rules={RULES} variant="compact" />
        </div>
      </FormField>
    </FormSheet>
  );
}
