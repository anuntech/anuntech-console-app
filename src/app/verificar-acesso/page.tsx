import { AuthShell } from "@/components/auth/auth-shell";
import { SecurityChallenge } from "@/components/auth/security-challenge";
export const metadata = {
  title: "Confirmar acesso",
  robots: { index: false, follow: false },
};
export default function VerifyAccessPage() {
  return (
    <main id="main-content" tabIndex={-1} className="contents">
      <AuthShell
        eyebrow="Segurança da conta"
        title="Confirme seu acesso"
        intro={{
          headline: "Uma confirmação a mais para proteger sua conta.",
          text: "Use o código recebido no seu outro contato verificado.",
        }}
      >
        <SecurityChallenge />
      </AuthShell>
    </main>
  );
}
