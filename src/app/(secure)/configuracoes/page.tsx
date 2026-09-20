import type { Metadata } from "next";
import { requireAdmin } from "@/lib/access";
import { ActionForm } from "@/components/action-form";
import { checkIntegration } from "@/lib/integration-actions";
import { Heading, Badge } from "@/components/ui";
import Link from "next/link";
import {
  Database,
  KeyRound,
  Mail,
  Landmark,
  ReceiptText,
  MessageCircle,
  Bell,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
export const metadata: Metadata = {
  title: "Configurações",
  description:
    "Consulte as integrações e preferências administrativas do Console.",
};

export default async function Settings() {
  await requireAdmin();
  const integrations = [
    {
      name: "Neon",
      icon: Database,
      status: "Conectado",
      detail: "Dados e sessões armazenados no PostgreSQL.",
    },
    {
      name: "Acesso ao Console",
      icon: KeyRound,
      status: "Configurado",
      detail:
        "Códigos por e-mail ou WhatsApp, Google opcional e permissões por empresa.",
    },
    {
      name: "Resend",
      icon: Mail,
      status: process.env.RESEND_API_KEY ? "Credencial recebida" : "Pendente",
      detail:
        "Códigos de acesso, avisos de chamados e e-mails de cobrança, com acompanhamento de entrega.",
    },
    {
      name: "Inter",
      icon: Landmark,
      provider: "inter",
      status:
        process.env.INTER_CLIENT_ID && process.env.INTER_CERTIFICATE_BASE64
          ? "Configurado"
          : "Pendente",
      detail:
        "Boletos, Pix e confirmação de pagamentos. Cobranças únicas e recorrentes conforme a configuração de cada fatura. O teste verifica autenticação.",
    },
    {
      name: "Focus NFe",
      icon: ReceiptText,
      provider: "focus",
      status: process.env.FOCUS_NFE_TOKEN_HOMOLOGATION
        ? "Tokens configurados"
        : "Pendente",
      detail:
        "Consulta de autenticação nos dois ambientes. Emissão aguarda cadastro e regras fiscais do serviço.",
    },
    {
      name: "WhatsApp / FLW",
      icon: MessageCircle,
      provider: "flw",
      status: process.env.FLW_SYNOVA ? "Token configurado" : "Pendente",
      detail:
        "Consulta de canais ativos. Cobranças proativas pelo WhatsApp dependem de modelo de mensagem aprovado. Login por código para números verificados em Minha conta.",
    },
  ];
  return (
    <>
      <Heading
        eyebrow="ADMINISTRAÇÃO"
        title="Configurações"
        description="Conexões e preferências que mantêm o Console funcionando."
      />
      <section className="settings-banner">
        <span className="settings-banner-icon">
          <Bell size={21} aria-hidden="true" />
        </span>
        <div>
          <h2>Avisos de chamados</h2>
          <p>Destinatários, tentativas e confirmações de entrega da equipe.</p>
        </div>
        <Link href="/configuracoes/notificacoes" className="button">
          Ver destinatário e envios
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <div className="section-label">
        <h2>Integrações</h2>
        <span>{integrations.length} serviços</span>
      </div>
      <div className="card-grid integration-grid">
        {integrations.map((i) => (
          <section key={i.name} className="panel padded integration-card">
            <div className="card-top">
              <div className="integration-title">
                <span className="integration-icon">
                  <i.icon size={20} aria-hidden="true" />
                </span>
                <h3>{i.name}</h3>
              </div>
              <Badge status={i.status === "Pendente" ? "pending" : ""}>
                {i.status}
              </Badge>
            </div>
            <p className="muted">{i.detail}</p>
            {i.provider && (
              <ActionForm
                action={checkIntegration}
                label="Testar conexão"
                submitAriaLabel={`Testar conexão com ${i.name}`}
              >
                <input type="hidden" name="provider" value={i.provider} />
              </ActionForm>
            )}
          </section>
        ))}
      </div>
      <section className="panel padded section-gap">
        <h2 className="detail-section-title">
          <ShieldCheck size={18} aria-hidden="true" />
          Acesso e operação
        </h2>
        <ul className="plain-list">
          <li>
            A administração define se a cobrança é única ou recorrente e
            configura o vencimento.
          </li>
          <li>
            Acesso liberado por e-mail, com permissão específica por empresa.
          </li>
          <li>
            Anexos privados no banco, limitados a 1 MB por arquivo e 20 por
            chamado.
          </li>
          <li>
            Códigos de acesso enviados sob solicitação. Recorrências ativas
            emitem com 5 dias de antecedência; a emissão fiscal segue pendente
            de configuração.
          </li>
        </ul>
      </section>
    </>
  );
}
