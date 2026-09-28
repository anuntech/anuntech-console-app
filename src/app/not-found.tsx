import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/console/back-button";
import { StatusPage } from "@/components/console/status-page";

export const metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

/** An address that matches no screen of the Console. */
export default function NotFound() {
  return (
    <StatusPage
      numeral="404"
      title="Esta página não existe"
      description="O endereço pode estar incompleto ou ter mudado. Se o link veio de alguém, peça de novo."
      actions={
        <>
          <Button asChild>
            <Link href="/painel">Ir para o Console</Link>
          </Button>
          <BackButton />
        </>
      }
    />
  );
}
