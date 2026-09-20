"use client";
import { useId, useState } from "react";
import { Copy } from "lucide-react";
import { Field } from "@/components/ui";
import styles from "./members-content.module.css";

export function MemberLoginLink({ url }: { url: string }) {
  const id = useId();
  const [message, setMessage] = useState("");
  return (
    <div className={styles.loginLink}>
      <Field
        label="Link para entrar no Console"
        hint="Compartilhe o link com a pessoa depois de liberar o acesso."
      >
        <input
          type="url"
          value={url}
          readOnly
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-feedback`}
          onFocus={(event) => event.currentTarget.select()}
        />
      </Field>
      <button
        type="button"
        className="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Link de acesso copiado.");
          } catch {
            setMessage("Selecione o endereço acima e copie com o teclado.");
          }
        }}
      >
        <Copy size={16} aria-hidden="true" /> Copiar link de acesso
      </button>
      <p
        id={`${id}-feedback`}
        role="status"
        aria-atomic="true"
        className={styles.feedback}
      >
        {message}
      </p>
    </div>
  );
}
