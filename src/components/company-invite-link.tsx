"use client";
import { useActionState, useState, useEffect } from "react";
import { createCompanyInvite } from "@/lib/company-invite-actions";
import { toast } from "./notifications";
import { Field } from "./ui";
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
        <input name="label" required maxLength={160} />
      </Field>
      <button className="button primary" disabled={pending}>
        {pending ? "Gerando…" : "Gerar link para o cliente"}
      </button>
      {state.link && (
        <>
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
            {copied === state.link ? "Link copiado" : "Copiar link"}
          </button>

          <p className="muted">
            Copie antes de sair desta página. Por segurança, o link completo só
            aparece aqui; se perder, cancele-o e gere outro.
          </p>
        </>
      )}
    </form>
  );
}
