import Link from "next/link";
import { getActor } from "@/lib/access/access";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/auth-buttons";
import { Button } from "@/components/ui/button";
export const metadata = {
  title: "Acesso pendente",
  robots: { index: false, follow: false },
};
export default async function Pending() {
  const actor = await getActor();
  return (
    <main id="main-content" tabIndex={-1} className="contents">
      <AuthShell
        eyebrow="Acesso pendente"
        title="Falta só liberar seu acesso"
        description={
          <>
            Você entrou como{" "}
            <strong className="font-medium break-all text-foreground">{actor.user.email}</strong>. A equipe da
            Anuntech precisa associar esse e-mail à sua empresa.
          </>
        }
      >
        <div className="reveal flex flex-col gap-3 [--i:1]">
          <Button size="lg" className="w-full" asChild>
            <Link href="/painel">Verificar acesso</Link>
          </Button>
          <SignOutButton />
        </div>
      </AuthShell>
    </main>
  );
}
