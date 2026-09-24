import "server-only";
import type { ReactNode } from "react";
import {
  DatabaseIcon,
  KeyRoundIcon,
  LandmarkIcon,
  MailIcon,
  MessageCircleIcon,
  ReceiptTextIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "cn";
import { requireAdmin } from "@/lib/access";
import { checkIntegration } from "@/lib/integration-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ServerForm, SubmitButton } from "@/components/console/server-form";

type Integration = {
  name: string;
  icon: ReactNode;
  status: string;
  pending?: boolean;
  detail: string;
  provider?: "inter" | "focus" | "flw";
};

export async function IntegrationsSection() {
  await requireAdmin();
  const groups: { title: string; description: string; items: Integration[] }[] = [
    {
      title: "Dados e acesso",
      description: "O que guarda os dados e deixa as pessoas entrarem.",
      items: [
        {
          name: "Neon",
          icon: <DatabaseIcon />,
          status: "Conectado",
          detail: "Dados e sessões no PostgreSQL.",
        },
        {
          name: "Acesso ao Console",
          icon: <KeyRoundIcon />,
          status: "Configurado",
          detail: "Códigos por e-mail ou WhatsApp, Google opcional e permissões por empresa.",
        },
      ],
    },
    {
      title: "Comunicação",
      description: "Por onde os avisos e os códigos saem.",
      items: [
        {
          name: "Resend",
          icon: <MailIcon />,
          status: process.env.RESEND_API_KEY ? "Credencial recebida" : "Pendente",
          pending: !process.env.RESEND_API_KEY,
          detail: "Códigos de acesso, avisos de chamados e e-mails de cobrança, com acompanhamento de entrega.",
        },
        {
          name: "WhatsApp / FLW",
          icon: <MessageCircleIcon />,
          provider: "flw",
          status: process.env.FLW_SYNOVA ? "Token configurado" : "Pendente",
          pending: !process.env.FLW_SYNOVA,
          detail: "Códigos de acesso e avisos pelo WhatsApp. Cobranças dependem de modelo de mensagem aprovado.",
        },
        {
          name: "OpenRouter",
          icon: <SparklesIcon />,
          status: process.env.OPENROUTER_API_KEY ? "Credencial recebida" : "Pendente",
          pending: !process.env.OPENROUTER_API_KEY,
          detail: "O assistente do Console conversa e executa ações por aqui. Modelo e instruções em Assistente.",
        },
      ],
    },
    {
      title: "Financeiro e fiscal",
      description: "Emissão de cobranças e notas.",
      items: [
        {
          name: "Inter",
          icon: <LandmarkIcon />,
          provider: "inter",
          status:
            process.env.INTER_CLIENT_ID && process.env.INTER_CERTIFICATE_BASE64
              ? "Configurado"
              : "Pendente",
          pending: !(process.env.INTER_CLIENT_ID && process.env.INTER_CERTIFICATE_BASE64),
          detail: "Boletos, Pix e confirmação de pagamento. O teste verifica só a autenticação.",
        },
        {
          name: "Focus NFe",
          icon: <ReceiptTextIcon />,
          provider: "focus",
          status: process.env.FOCUS_NFE_TOKEN_HOMOLOGATION ? "Tokens configurados" : "Pendente",
          pending: !process.env.FOCUS_NFE_TOKEN_HOMOLOGATION,
          detail: "Consulta de autenticação nos dois ambientes. A emissão de notas ainda depende do cadastro fiscal.",
        },
      ],
    },
  ];
  return (
    <>
      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <SectionTitle title={group.title} description={group.description} />
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {group.items.map((item) => (
                <li
                  key={item.name}
                  className="flex flex-wrap items-center gap-4 px-6 py-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block text-sm font-medium text-foreground">
                      {item.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                      item.pending
                        ? "bg-warning-soft text-warning"
                        : "bg-success-soft text-success",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        item.pending ? "bg-warning" : "bg-success",
                      )}
                    />
                    {item.status}
                  </span>
                  {item.provider && (
                    <ServerForm action={checkIntegration}>
                      <input type="hidden" name="provider" value={item.provider} />
                      <SubmitButton
                        variant="outline"
                        size="sm"
                        pendingLabel="Testando…"
                        aria-label={`Testar conexão com ${item.name}`}
                      >
                        Testar conexão
                      </SubmitButton>
                    </ServerForm>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
