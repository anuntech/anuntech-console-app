import { getActor } from "@/lib/access";
import { SignOutButton } from "@/components/auth-buttons";
import { Brand } from "@/components/brand";
import Link from "next/link";
export default async function Pending() {
  const actor = await getActor();
  return (
    <main className="standalone">
      <Brand />
      <h1>Seu acesso precisa ser liberado.</h1>
      <p>
        Você entrou como <strong>{actor.user.email}</strong>. A equipe da
        Anuntech precisa associar esse e-mail à sua empresa.
      </p>
      <Link href="/painel" className="button primary">
        Verificar acesso
      </Link>
      <SignOutButton />
    </main>
  );
}
