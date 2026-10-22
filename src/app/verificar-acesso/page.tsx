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
      {/* No lead: the challenge itself says where the code goes, or that the verification expired. */}
      <AuthShell title="Confirme seu acesso">
        <SecurityChallenge returnTo={returnTo} />
      </AuthShell>
    </main>
  );
}
