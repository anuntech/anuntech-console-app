import Link from "next/link";
import { Link2, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/access";
import { createCompany } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Back } from "@/components/ui";
import { CompanyBillingFields } from "@/components/company-billing-fields";
import styles from "../management.module.css";
export default async function NewCompany() {
  await requireAdmin();
  return (
    <>
      <Back href="/empresas" label="Empresas" />
      <Heading
        eyebrow="CLIENTES"
        title="Cadastrar empresa"
        description="Reúna os dados do cliente para cobranças, notas fiscais e atendimento."
      />
      <div className={styles.formShell}>
        <section className={`panel ${styles.formCard}`}>
          <ActionForm action={createCompany} label="Cadastrar empresa">
            <CompanyBillingFields />
          </ActionForm>
        </section>
        <aside className={styles.aside}>
          <section className={styles.helpCard}>
            <span className={styles.helpIcon}>
              <Link2 size={19} />
            </span>
            <h2>O cliente pode preencher</h2>
            <p>
              Gere um link individual e revise os dados recebidos antes de
              aprovar o cadastro.
            </p>
            <Link className="button" href="/empresas/convites">
              Enviar link para o cliente
            </Link>
          </section>
          <section className={styles.helpCard}>
            <span className={styles.helpIcon}>
              <ShieldCheck size={19} />
            </span>
            <h2>Acesso por empresa</h2>
            <p>
              Depois do cadastro, você escolhe as pessoas e as permissões de
              acesso a este cliente.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
