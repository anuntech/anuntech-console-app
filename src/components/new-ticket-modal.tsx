"use client";
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
      <div className={styles.content}>
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
            <div className="stack">
              <span>Anexos (opcional)</span>
              <AttachmentPicker />
            </div>
          </TicketActionForm>
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
