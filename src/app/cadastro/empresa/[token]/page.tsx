import { Notification } from "@/components/notifications";
import { findCompanyInvite } from "@/lib/company-invites";
import { submitCompanyInvite } from "@/lib/company-invite-actions";
import { ActionForm } from "@/components/action-form";
import { CompanyBillingFields } from "@/components/company-billing-fields";
export const dynamic = "force-dynamic";
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
    <main className="registration-page">
      <div className="registration-brand">Anuntech Console</div>
      <section className="panel form-panel">
        <h1>Cadastro da empresa</h1>
        {open ? (
          <>
            <p className="muted">
              Informe os dados para atendimento, contratos, cobranças e notas
              fiscais. A Anuntech revisará o cadastro antes de concluir. O envio
              não cria uma conta nem emite cobranças.
            </p>
            <ActionForm action={submitCompanyInvite} label="Enviar cadastro">
              <input type="hidden" name="token" value={token} />
              <CompanyBillingFields inviteToken={token} />
            </ActionForm>
          </>
        ) : (
          <>
            <Notification
              kind={sent ? "success" : "warning"}
              id="registration-state"
              message={
                sent
                  ? "Cadastro recebido. A Anuntech dará continuidade à revisão."
                  : "Link indisponível ou expirado. Solicite um novo link à Anuntech."
              }
            />
            <p>
              {sent
                ? "Cadastro recebido. A Anuntech dará continuidade à revisão. Não é necessário enviar novamente."
                : "Este link está indisponível ou expirou. Solicite um novo link à Anuntech."}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
