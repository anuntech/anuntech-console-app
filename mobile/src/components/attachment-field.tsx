// Placeholder: frente 1 (U2) replaces this with the real field.
import type { PickedFile, UploadTarget } from "@/lib/uploads";

export type Attachment = PickedFile & { key: string; uploadId?: string; state: "uploading" | "done" | "error"; error?: string };

/** Files chosen for a reply, a ticket, a task or a comment, uploaded as they are picked. */
export function AttachmentField(_props: { value: Attachment[]; onChange: (value: Attachment[]) => void; target: UploadTarget; max?: number }) {
  return null;
}
