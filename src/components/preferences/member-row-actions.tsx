"use client";
import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { FormModal } from "@/components/form-modal";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { saveCompanyMember, revokeCompanyMember } from "@/lib/members-actions";
import styles from "./members-content.module.css";

function RoleField({ defaultValue }: { defaultValue: string }) {
  return (
    <Field label="Permissão">
      <select name="role" defaultValue={defaultValue} required>
        <option value="" disabled>
          Selecione uma permissão
        </option>
        <option value="manager">Administrador</option>
        <option value="support">Atendimento</option>
        <option value="finance">Financeiro</option>
      </select>
    </Field>
  );
}

export function MemberRowActions({
  companyId,
  companyName,
  email,
  memberId,
  roleDefaultValue,
  pending,
}: {
  companyId: string;
  companyName?: string;
  email: string;
  memberId: string;
  roleDefaultValue: string;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const firstItem = panelRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), [href]",
    );
    firstItem?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node))
        setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return (
    <div className={styles.rowMenu} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.menuButton}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Ações de ${email}`}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {/* Stays mounted while closed: it holds the FormModal/ActionForm
          instances, whose own Dialog opens via Portal and must survive
          this panel being hidden by the same click that opened it. */}
      <div
        ref={panelRef}
        hidden={!open}
        className={styles.menuPanel}
        onClickCapture={() => setOpen(false)}
      >
        {!pending && (
          <FormModal
            trigger="Editar permissão"
            triggerAriaLabel={`Editar permissão de ${email}`}
            triggerClassName={styles.menuItem}
            title="Editar permissão"
            description={email}
            action={saveCompanyMember}
            label="Salvar permissão"
            submitAriaLabel={
              companyName
                ? `Salvar permissão de ${email} em ${companyName}`
                : `Salvar permissão de ${email}`
            }
          >
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="email" value={email} />
            <RoleField defaultValue={roleDefaultValue} />
          </FormModal>
        )}
        <ActionForm
          action={revokeCompanyMember}
          label={pending ? "Cancelar convite" : "Expulsar"}
          submitAriaLabel={`${pending ? "Cancelar convite" : "Expulsar"} de ${email}`}
          danger
          className={styles.menuItemForm}
          confirm={{
            title: pending ? "Cancelar convite?" : "Expulsar membro?",
            description: `${email} perderá o acesso ao ambiente.`,
            confirmLabel: pending ? "Cancelar convite" : "Expulsar",
          }}
        >
          <input type="hidden" name="id" value={memberId} />
        </ActionForm>
      </div>
    </div>
  );
}
