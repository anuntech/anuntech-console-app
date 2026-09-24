import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert } from "@/components/auth/feedback";
import { LoginForm } from "@/components/auth/login-form";
export const metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main id="main-content" tabIndex={-1} className="contents">
      <AuthShell
        eyebrow="Bem-vindo"
        title="Entre no Console"
        description="Use o e-mail que recebeu acesso à sua empresa."
      >
        <div className="flex flex-col gap-5">
          {(query.erro || query.error) && (
            <AuthAlert kind="error" id="login-error">
              Não foi possível concluir o acesso. Confira se está usando o
              e-mail autorizado e tente novamente.
            </AuthAlert>
          )}
          <LoginForm />
          <p className="text-center text-xs text-muted-foreground">
            Ainda não tem acesso? Solicite a liberação à equipe da Anuntech.
          </p>
        </div>
      </AuthShell>
    </main>
  );
}
