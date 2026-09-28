import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/console/back-button";
import { StatusPage } from "@/components/console/status-page";

export const metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

/**
 * A record that is gone or outside the person's access. Both answer the
 * same way on purpose: the Console never confirms that a record exists to
 * someone who cannot open it.
 */
export default function NotFound() {
  return (
    <StatusPage
      layout="inline"
      icon={<SearchXIcon />}
      eyebrow="Erro 404"
      title="Não encontramos esta página"
      description="O endereço pode estar errado, o registro pode ter sido excluído ou o seu acesso não inclui a empresa dele. Se você acha que deveria ver, fale com quem administra a sua empresa no Console."
      actions={
        <>
          <Button asChild>
            <Link href="/painel">Ir para a Visão geral</Link>
          </Button>
          <BackButton />
        </>
      }
    />
  );
}
