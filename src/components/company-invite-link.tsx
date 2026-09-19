"use client";
import { useActionState, useState, useEffect } from "react";
import { createCompanyInvite } from "@/lib/company-invite-actions";
import { toast } from "./notifications";
import { Field } from "./ui";
import { Check, Copy, Link2 } from "lucide-react";
export function CompanyInviteLink() {
  const [state, action, pending] = useActionState(createCompanyInvite, {});
  const [copied, setCopied] = useState("");
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) toast.success(state.success);
  }, [state]);
  return (
    <form action={action} className="form">
      <Field
        label="Identificação do link"
        hint="Uso interno. Ex.: nome do cliente que vai preencher."
      >
        <input
          name="label"
          placeholder="Nome do cliente"
          required
          maxLength={160}
        />
      </Field>
      <button type="submit" className="button primary" disabled={pending}>
        <Link2 size={16} />
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
                toast.success("Link copiado.");
              } catch {
                toast.error(
                  "Não foi possível copiar. Selecione e copie o link acima.",
                );
              }
            }}
          >
            {copied === state.link ? <Check size={16} /> : <Copy size={16} />}
            {copied === state.link ? "Link copiado" : "Copiar link"}
          </button>

          <p className="muted">
            Copie antes de sair desta página. Por segurança, o link completo só
            aparece aqui; se perder, cancele-o e gere outro.
          </p>
        </section>
      )}
    </form>
  );
}
