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
