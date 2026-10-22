import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { withReturnPath } from "@/lib/auth/return-path";
import { getActor } from "@/lib/access/access";
import { appById } from "@/lib/apps/registry";
import { resolveAppLink } from "@/lib/apps/app-access";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/console/status-page";
export const metadata: Metadata = {
  title: "Abrir app",
  robots: { index: false, follow: false },
};

/**
 * Where a client app sends someone who opened it straight from the address
 * bar (the app only runs inside the Console). Outside the secure layout on
 * purpose: without a session it goes to sign-in with the way back
 * (/entrar?volta=/abrir/<app>), which the layout's own redirect would drop.
 * With a session it finds the person's product for this app and opens it at
 * /apps/<id>, where the role is checked as usual.
 */
export default async function OpenAppLink({ params }: { params: Promise<{ app: string }> }) {
  const { app: id } = await params;
  const app = appById(id);
  if (!app) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) redirect(withReturnPath("/entrar", `/abrir/${app.id}`));
  const actor = await getActor();
  const choice = await resolveAppLink(actor, app);
  if (choice.kind !== "none") redirect(choice.href);
  return (
    <StatusPage
      art="projetos"
      eyebrow={app.name}
      title="Este app não está liberado para você"
      description={
        <>
          Você entrou como <strong className="font-medium text-foreground">{actor.user.email}</strong>. O {app.name} não
          está entre os produtos das empresas que essa conta acessa. Se precisar dele, fale com o Administrador da sua
          empresa ou com a Anuntech.
        </>
      }
      actions={
        <Button asChild>
          <Link href="/produtos">Ver produtos e serviços</Link>
        </Button>
      }
    />
  );
}
