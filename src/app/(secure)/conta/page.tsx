import { getActor } from "@/lib/access";
import { Heading, Badge } from "@/components/ui";
import { WhatsappAccount } from "@/components/whatsapp-account";
import { Mail, ShieldCheck, UserRound } from "lucide-react";
export default async function AccountPage() {
  const actor = await getActor();
  return (
    <>
      <Heading
        eyebrow="PREFERÊNCIAS"
        title="Minha conta"
        description="Seus dados de acesso e as formas de entrar no Console."
      />
      <div className="account-layout">
        <section className="panel padded identity-card">
          <div className="identity-avatar" aria-hidden="true">
            {actor.user.name.slice(0, 1).toUpperCase()}
          </div>
          <h2>{actor.user.name}</h2>
          <Badge status="active">
            {actor.admin ? "Administrador" : "Cliente"}
          </Badge>
          <dl className="metadata-list">
            <div>
              <dt>
                <Mail size={15} aria-hidden="true" />
                E-mail de acesso
              </dt>
              <dd>{actor.user.email}</dd>
            </div>
            <div>
              <dt>
                <UserRound size={15} aria-hidden="true" />
                Perfil
              </dt>
              <dd>{actor.admin ? "Equipe Anuntech" : "Portal do cliente"}</dd>
            </div>
          </dl>
          <p className="identity-note">
            <ShieldCheck size={16} aria-hidden="true" />
            As permissões de cada empresa são gerenciadas pela Anuntech.
          </p>
        </section>
        <WhatsappAccount
          phone={
            actor.user.phoneNumberVerified
              ? actor.user.phoneNumber || null
              : null
          }
        />
      </div>
    </>
  );
}
