import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert } from "@/components/auth/feedback";
import { SupportButton } from "@/components/shell/support-trigger";
import { LoginForm } from "@/components/auth/login-form";
import { safeReturnPath } from "@/lib/auth/return-path";
export const metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string;
    error?: string;
    conta?: string;
    volta?: string | string[];
  }>;
}) {
  const query = await searchParams;
  // Only a path to an app comes back here (/abrir/… or /apps/…); anything else is ignored.
  const returnTo = safeReturnPath(query.volta);
  return (
    <main id="main-content" tabIndex={-1} className="contents">
      <AuthShell
        eyebrow="Boas-vindas"
        title="Entre no Console"
        description="Use o e-mail liberado para a sua empresa ou o WhatsApp da sua conta."
      >
        <div className="flex flex-col gap-5">
          {(query.erro || query.error) && (
            <AuthAlert kind="error" id="login-error">
              Não foi possível concluir o acesso. Confira se está usando o
              e-mail autorizado e tente novamente.
            </AuthAlert>
          )}
          {query.conta === "excluida" && (
            <AuthAlert kind="info">
              Sua conta foi excluída. Enviamos a confirmação para o seu e-mail.
            </AuthAlert>
          )}
          <LoginForm returnTo={returnTo} />
          <p className="text-center text-xs text-muted-foreground">
            Ainda não tem acesso?{" "}
            {process.env.NODE_ENV === "production" ? (
              <SupportButton className="font-medium text-primary underline-offset-2 hover:underline">
                Fale com a equipe da Anuntech
              </SupportButton>
            ) : (
              "Solicite a liberação à equipe da Anuntech."
            )}
          </p>
        </div>
      </AuthShell>
    </main>
  );
}
