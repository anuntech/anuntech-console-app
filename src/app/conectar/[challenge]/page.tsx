import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NotebookTextIcon } from "lucide-react";
import { auth } from "@/lib/auth/auth";
import { withReturnPath } from "@/lib/auth/return-path";
import { getActor } from "@/lib/access/access";
import { APP_NAME, CHALLENGE } from "@/lib/meetings/meeting-rules";
import { StatusPage } from "@/components/console/status-page";
import { ConnectApproval } from "@/components/meetings/connect-approval";
export const metadata: Metadata = {
  title: "Conectar app",
  robots: { index: false, follow: false },
};

/**
 * Where the Mac meeting-notes app sends the person to connect it (see
 * lib/meetings/meeting-rules.ts). Outside the secure layout on purpose, like
 * /abrir: without a session it goes to sign-in with the way back
 * (/entrar?volta=/conectar/<challenge>), which the layout's redirect would drop.
 */
export default async function ConnectMeetingApp({ params }: { params: Promise<{ challenge: string }> }) {
  const { challenge } = await params;
  if (!CHALLENGE.test(challenge)) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) redirect(withReturnPath("/entrar", `/conectar/${challenge}`));
  const actor = await getActor();
  return (
    <StatusPage
      icon={<NotebookTextIcon />}
      eyebrow={APP_NAME}
      title="Conectar o app de reuniões do Mac"
      description={
        <>
          Você entrou como <strong className="font-medium text-foreground">{actor.user.email}</strong>. Conectado, o app
          vê suas empresas e pastas de Bookmarks e salva nelas as notas das reuniões que você gravar. Ele não abre
          faturas, chamados nem outros dados, e o áudio fica só no Mac.
        </>
      }
      actions={<ConnectApproval challenge={challenge} />}
      footnote="Só conecte se foi você quem clicou em Conectar ao Console no app do seu Mac. Você desconecta quando quiser em Configurações → Segurança."
    />
  );
}
