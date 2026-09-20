"use client";
import { useActionState, useId, useState } from "react";
import { createCompanyInvite } from "@/lib/company-invite-actions";
import { Notification } from "./notifications";
import { Field } from "./ui";
import { Check, Copy, Link2 } from "lucide-react";
export function CompanyInviteLink() {
  const [state, action, pending] = useActionState(createCompanyInvite, {});
  const [copied, setCopied] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<{
    link: string;
    message: string;
  } | null>(null);
  const linkHintId = useId();
  return (
    <form action={action} className="form" aria-busy={pending}>
      {state.error && <Notification kind="error" message={state.error} />}
      {state.success && <Notification kind="success" message={state.success} />}
      <Field
        label="Identificação do link"
        hint="Uso interno. Ex.: nome do cliente que vai preencher."
      >
        <input
          name="label"
          autoComplete="off"
          placeholder="Nome do cliente"
          required
          maxLength={160}
        />
      </Field>
      <button type="submit" className="button primary" disabled={pending}>
        <Link2 size={16} aria-hidden="true" />
        {pending ? "Gerando…" : "Gerar link para o cliente"}
      </button>
      {state.link && (
        <section
          className="form-section stack"
          aria-label="Link de cadastro gerado"
        >
          <Field label="Link de cadastro">
            <input
              readOnly
              type="url"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={linkHintId}
              value={state.link}
              onFocus={(e) => e.target.select()}
            />
          </Field>
          <button
            type="button"
            className="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.link!);
                setCopied(state.link!);
                setCopyFeedback({
                  link: state.link!,
                  message: "Link copiado.",
                });
              } catch {
                setCopyFeedback({
                  link: state.link!,
                  message:
                    "Não foi possível copiar. Selecione e copie o link acima.",
                });
              }
            }}
          >
            {copied === state.link ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copied === state.link ? "Link copiado" : "Copiar link"}
          </button>

          <p
            role="status"
            aria-atomic="true"
            className={
              copyFeedback?.link === state.link ? "form-footnote" : "sr-only"
            }
          >
            {copyFeedback?.link === state.link ? copyFeedback.message : ""}
          </p>
          <p id={linkHintId} className="muted">
            Copie antes de sair desta página. Por segurança, o link completo só
            aparece aqui; se perder, cancele-o e gere outro.
          </p>
        </section>
      )}
    </form>
  );
}
