import { Notification } from "@/components/notifications";
import { OtpLogin } from "@/components/otp-login";
import { Brand } from "@/components/brand";
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="login">
      <section className="login-brand">
        <Brand />
        <div>
          <p className="eyebrow">SEU ESPAÇO NA ANUNTECH</p>
          <h1>
            Mais perto
            <br />
            do que importa<span>.</span>
          </h1>
          <p>
            Atendimento, produtos e financeiro.
            <br />
            Acompanhe tudo pela sua Console.
          </p>
        </div>
        <span className="login-caption">Anuntech · Portal do cliente</span>
      </section>
      <section className="login-form">
        <div className="login-card">
          <p className="eyebrow">BEM-VINDO</p>
          <h2>Entre na Console.</h2>
          <p className="muted">
            Use o e-mail que recebeu acesso à sua empresa.
          </p>
          {(query.erro || query.error) && (
            <Notification
              kind="error"
              id="login-error"
              message="Não foi possível concluir o acesso. Confira se está usando o e-mail autorizado e tente novamente."
            />
          )}
          <OtpLogin />
          <p className="login-help">
            Ainda não tem acesso? Solicite a liberação à equipe da Anuntech.
          </p>
        </div>
        <span className="login-caption">
          Um lugar para acompanhar o seu trabalho com a gente.
        </span>
      </section>
    </main>
  );
}
