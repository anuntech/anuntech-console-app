"use client";
import { useState, type ReactNode } from "react";
import { Field } from "@/components/ui";
import styles from "./preferences-content.module.css";
export function CompanySelector({
  companies,
}: {
  companies: { id: string; name: string; content: ReactNode }[];
}) {
  const [selected, setSelected] = useState(companies[0]?.id || "");
  const company =
    companies.find((item) => item.id === selected) || companies[0];
  if (!company)
    return (
      <p className={styles.helper}>
        Nenhuma empresa disponível para administrar.
      </p>
    );
  return (
    <div className={styles.content}>
      <Field label="Empresa">
        <select
          value={company.id}
          onChange={(event) => setSelected(event.target.value)}
        >
          {companies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <div key={company.id}>{company.content}</div>
    </div>
  );
}
