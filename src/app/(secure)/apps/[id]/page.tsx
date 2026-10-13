import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CirclePauseIcon, ExternalLinkIcon, KeyRoundIcon, LockIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { resolveAppOpening } from "@/lib/apps/app-access";
import { appBlockText } from "@/lib/apps/app-texts";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/console/status-page";
import { AppFrame } from "@/components/apps/app-frame";
export const metadata: Metadata = {
  title: "App",
  description: "Um app da sua empresa, aberto dentro do Console.",
};

/** Only web links leave the Console. */
function webUrl(url: string | null) {
  if (!url) return null;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

const icons = {
  inactive: <CirclePauseIcon />,
  role: <LockIcon />,
  no_tenant: <KeyRoundIcon />,
  not_protected: <ExternalLinkIcon />,
};

/**
 * A client app (CMS, Roteiro Digital, Base Pendente) inside the Console. The
 * page only decides who may open it; the pass is asked for by AppFrame after
 * it mounts, through an action that checks everything again.
 */
export default async function AppPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const opening = await resolveAppOpening(actor, id);
  if (!opening.ok && opening.reason === "not_found") notFound();
  if (!opening.ok) {
    // Services and projects have pages of their own.
    if (opening.reason === "not_product")
      redirect(opening.engagement.kind === "project" ? `/projetos/${id}` : `/produtos/${id}`);
    const text = appBlockText(opening.reason, {
      app: opening.app?.name,
      product: opening.engagement.name,
      company: opening.company.name,
      status: opening.engagement.status,
    });
    const link = opening.reason === "not_protected" ? webUrl(opening.engagement.url) : null;
    return (
      <StatusPage
        layout="inline"
        icon={icons[opening.reason]}
        eyebrow={opening.engagement.name}
        title={text.title}
        description={text.description}
        actions={
          <>
            {link && (
              <Button asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon />
                  Abrir produto
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              </Button>
            )}
            {opening.reason === "no_tenant" && (
              <Button asChild>
                <Link href="/chamados/novo">Abrir chamado</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/produtos">Ver produtos e serviços</Link>
            </Button>
          </>
        }
      />
    );
  }
  return (
    <AppFrame
      data={{
        id: opening.engagement.id,
        name: opening.engagement.name,
        app: opening.app.name,
        company: opening.company.name,
      }}
    />
  );
}
