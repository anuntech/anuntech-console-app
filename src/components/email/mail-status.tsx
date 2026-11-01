import { ServerCrashIcon } from "lucide-react";
import { StatusPage } from "@/components/console/status-page";

/** The mail server is not set up here, or did not answer: the page says so instead of an empty list. */
export function MailServerProblem({ configured }: { configured: boolean }) {
  return (
    <StatusPage
      layout="inline"
      icon={<ServerCrashIcon />}
      title={configured ? "O servidor de e-mail não respondeu" : "O servidor de e-mail não está ligado aqui"}
      description={
        configured
          ? "As caixas continuam funcionando nos aplicativos. Abra esta página de novo em alguns minutos."
          : "Faltam as variáveis STALWART_URL, STALWART_USER e STALWART_PASSWORD neste ambiente."
      }
    />
  );
}

/** Assisted access shows the company as its client sees it, but mailboxes mean passwords: the team manages them with its own access. */
export function AssistedMail() {
  return (
    <StatusPage
      layout="inline"
      title="O e-mail não abre no acesso assistido"
      description="As caixas mexem com senhas da empresa. Saia do acesso assistido e abra o produto de e-mail da empresa em Produtos para gerenciar como equipe."
    />
  );
}

/** Where the e-mail pages sit: a client's under Produtos, Anuntech's own under Configurações › E-mail. */
export const mailCrumbs = (companyId: string | null) =>
  companyId ? [{ label: "Produtos e serviços", href: "/produtos" }] : [{ label: "E-mail", href: "/configuracoes/email" }];
