import { AuthShell } from "@/components/auth/auth-shell";
import { SecurityChallenge } from "@/components/auth/security-challenge";
import { safeReturnPath } from "@/lib/auth/return-path";
export const metadata = {
  title: "Confirmar acesso",
  robots: { index: false, follow: false },
};
export default async function VerifyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ volta?: string | string[] }>;
}) {
  // The app the person was opening before signing in, if any; anything else is ignored.
  const returnTo = safeReturnPath((await searchParams).volta);
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
        <SecurityChallenge returnTo={returnTo} />
      </AuthShell>
    </main>
  );
}
