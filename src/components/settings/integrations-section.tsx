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
import { requireAdmin } from "@/lib/access/access";
import { checkIntegration } from "@/lib/integrations/integration-actions";
import { gatewayCredential } from "@/lib/ai/gateway-env";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ServerForm, SubmitButton } from "@/components/console/server-form";

type Integration = {
  name: string;
  icon: ReactNode;
  /** Missing credentials: the only state that gets a badge ("Pendente"); a working service is the normal case. */
  pending?: boolean;
  detail: string;
  provider?: "inter" | "focus" | "flw";
};

export async function IntegrationsSection() {
  await requireAdmin();
  const aiCredential = gatewayCredential();
  const groups: { title: string; items: Integration[] }[] = [
    {
      title: "Dados e acesso",
      items: [
        {
          name: "Neon",
          icon: <DatabaseIcon />,
          detail: "Dados e sessões no PostgreSQL.",
        },
        {
          name: "Acesso ao Console",
          icon: <KeyRoundIcon />,
          detail: "Códigos por e-mail ou WhatsApp, Google opcional e permissões por empresa.",
        },
      ],
    },
    {
      title: "Comunicação",
      items: [
        {
          name: "Resend",
          icon: <MailIcon />,
          pending: !process.env.RESEND_API_KEY,
          detail: "Códigos de acesso, avisos de chamados e e-mails de cobrança, com acompanhamento de entrega.",
        },
        {
          name: "WhatsApp / FLW",
          icon: <MessageCircleIcon />,
          provider: "flw",
          pending: !process.env.FLW_SYNOVA,
          detail: "Códigos de acesso e avisos pelo WhatsApp. Cobranças dependem de modelo de mensagem aprovado.",
        },
        {
          name: "AI Gateway da Vercel",
          icon: <SparklesIcon />,
          pending: !aiCredential,
          detail: `Toda a IA do Console passa por aqui: assistente, Jev, ditado, sugestões, jornadas e ícones. Modelo e instruções em Assistente.${aiCredential === "oidc" ? " Credencial pelo OIDC da Vercel." : ""}`,
        },
      ],
    },
    {
      title: "Financeiro e fiscal",
      items: [
        {
          name: "Inter",
          icon: <LandmarkIcon />,
          provider: "inter",
          pending: !(process.env.INTER_CLIENT_ID && process.env.INTER_CERTIFICATE_BASE64),
          detail: "Boletos, Pix e confirmação de pagamento. O teste verifica só a autenticação.",
        },
        {
          name: "Focus NFe",
          icon: <ReceiptTextIcon />,
          provider: "focus",
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
            <SectionTitle title={group.title} />
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
                  {item.pending && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                      Pendente
                    </span>
                  )}
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
