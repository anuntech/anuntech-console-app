"use client";
import { Paperclip, ChevronDown } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { AttachmentPicker } from "./attachment-picker";
import { TicketActionForm } from "./ticket-action-form";
import { Field } from "./ui";
import { createTicket } from "@/lib/actions";
import pattern from "./ui/form-pattern.module.css";
import styles from "./new-ticket-modal.module.css";
const subscribe = () => () => {};
export function NewTicketModal({
  company,
  intercepted = false,
}: {
  company: { id: string; name: string } | null;
  intercepted?: boolean;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const close = () =>
    intercepted ? router.back() : router.replace("/chamados");
  if (pathname !== "/chamados/novo") return null;
  const content = (
    <>
      <div className={`${styles.content} ${pattern.surface}`}>
        {hydrated ? (
          <DialogTitle className={styles.title}>Abrir chamado</DialogTitle>
        ) : (
          <h1 className={styles.title}>Abrir chamado</h1>
        )}
        {hydrated ? (
          <DialogDescription className={styles.description}>
            Como podemos ajudar?
          </DialogDescription>
        ) : (
          <p className={styles.description}>Como podemos ajudar?</p>
        )}
        {company ? (
          <div
            className={`${pattern.card} ${pattern.rows} ${pattern.creation}`}
          >
            <TicketActionForm
              action={createTicket}
              label="Abrir chamado"
              onPendingChange={(value) => {
                busy.current = value;
                setPending(value);
              }}
            >
              <input name="companyId" type="hidden" value={company.id} />
              <Field label="Assunto">
                <input
                  name="subject"
                  required
                  maxLength={160}
                  placeholder="Um resumo da sua solicitação"
                  autoFocus
                />
              </Field>
              <Field label="Descrição">
                <textarea
                  name="body"
                  required
                  maxLength={10000}
                  rows={7}
                  placeholder="Descreva o que precisa."
                />
              </Field>
              <details className={styles.attachments}>
                <summary>
                  <Paperclip size={18} aria-hidden="true" /> Adicionar anexos{" "}
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <AttachmentPicker />
              </details>
            </TicketActionForm>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>
              Abra o chamado pela página da empresa que precisa de atendimento.
            </p>
            <Link href="/empresas" className="button primary">
              Ver empresas
            </Link>
          </div>
        )}
      </div>
    </>
  );
  if (!hydrated) return <section>{content}</section>;
  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open, details) => {
        if (!open) {
          if (busy.current) details.cancel();
          else close();
        }
      }}
    >
      <DialogContent className={styles.modal} busy={pending}>
        {content}
      </DialogContent>
    </Dialog>
  );
}
