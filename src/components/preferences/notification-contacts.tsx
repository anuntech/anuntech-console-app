"use client";
import { useId, useState } from "react";
import { Plus, X, Mail, Phone } from "lucide-react";
import styles from "./notification-contacts.module.css";

export function NotificationContacts({
  kind,
  values,
}: {
  kind: "email" | "phone";
  values: string[];
}) {
  const id = useId();
  const [contacts, setContacts] = useState(() =>
    values.length ? values : [""],
  );
  const label = kind === "email" ? "E-mail" : "Telefone";
  return (
    <fieldset className={styles.group}>
      <legend><span className={styles.legend}>{kind === "email" ? <Mail size={16} aria-hidden="true" /> : <Phone size={16} aria-hidden="true" />}{kind === "email" ? "E-mails" : "Telefones"}</span></legend>
      {contacts.map((value, index) => (
        <div className={styles.row} key={index}>
          <label htmlFor={`${id}-${index}`} className="sr-only">
            {label} {index + 1}
          </label>
          <input
            id={`${id}-${index}`}
            name={kind === "email" ? "emails" : "phones"}
            type={kind === "email" ? "email" : "tel"}
            value={value}
            autoComplete="off"
            maxLength={kind === "email" ? 254 : 30}
            placeholder={
              kind === "email" ? "nome@empresa.com.br" : "(11) 99999-9999"
            }
            onChange={(event) =>
              setContacts((current) =>
                current.map((item, i) =>
                  i === index ? event.target.value : item,
                ),
              )
            }
          />
          <button
            type="button"
            className="icon-button"
            aria-label={`Remover ${label.toLowerCase()} ${index + 1}`}
            onClick={() =>
              setContacts((current) =>
                current.length === 1
                  ? [""]
                  : current.filter((_, i) => i !== index),
              )
            }
          >
            <X size={16} />
          </button>
        </div>
      ))}
      {contacts.length < 10 && (
        <button
          type="button"
          className={`button ${styles.add}`}
          onClick={() => setContacts((current) => [...current, ""])}
        >
          <Plus size={15} />
          {kind === "email" ? "Adicionar e-mail" : "Adicionar telefone"}
        </button>
      )}
    </fieldset>
  );
}
