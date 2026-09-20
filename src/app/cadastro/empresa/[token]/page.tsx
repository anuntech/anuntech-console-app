import { findCompanyInvite } from "@/lib/company-invites";
import { submitCompanyInvite } from "@/lib/company-invite-actions";
import { ActionForm } from "@/components/action-form";
import { CompanyBillingFields } from "@/components/company-billing-fields";
import { Brand } from "@/components/brand";
import { Check, Link2Off, ShieldCheck } from "lucide-react";
import styles from "@/components/public-layout.module.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Cadastro da empresa",
  robots: { index: false, follow: false },
};
export default async function PublicCompanyRegistration({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await findCompanyInvite(token);
  const sent = invite?.status === "submitted" || invite?.status === "approved";
  const open = invite?.status === "open" && invite.expiresAt > new Date();
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <header className={styles.header}>
        <Brand />
        <span className={styles.headerNote}>
          <ShieldCheck size={15} aria-hidden="true" /> Cadastro oficial da
          Anuntech
        </span>
      </header>
      <section className={styles.registration}>
        {open ? (
          <>
            <div className={styles.registrationIntro}>
              <p className={styles.eyebrow}>VAMOS COMEÇAR</p>
              <h1>Cadastro da empresa</h1>
              <p>
                Informe os dados da sua empresa para atendimento, contratos,
                cobranças e notas fiscais. Nossa equipe revisará o cadastro
                antes de concluir.
              </p>
            </div>
            <div className={styles.registrationForm}>
              <ActionForm action={submitCompanyInvite} label="Enviar cadastro">
                <input type="hidden" name="token" value={token} />
                <CompanyBillingFields inviteToken={token} />
              </ActionForm>
            </div>
            <p className={styles.registrationNote}>
              <ShieldCheck size={16} aria-hidden="true" /> O envio não cria uma
              conta nem emite cobranças. Seus dados serão usados para o
              relacionamento da empresa com a Anuntech.
            </p>
          </>
        ) : (
          <>
            <div className={styles.stateCard}>
              <div className={styles.stateIcon}>
                {sent ? (
                  <Check size={26} aria-hidden="true" />
                ) : (
                  <Link2Off size={26} aria-hidden="true" />
                )}
              </div>
              <h1>{sent ? "Cadastro recebido" : "Link indisponível"}</h1>
              <p>
                {sent
                  ? "A Anuntech dará continuidade à revisão. Não é necessário enviar novamente."
                  : "Este link está indisponível ou expirou. Solicite um novo link à Anuntech."}
              </p>
            </div>
          </>
        )}
      </section>
      <footer className={styles.footer}>Anuntech · Portal do cliente</footer>
    </main>
  );
}
