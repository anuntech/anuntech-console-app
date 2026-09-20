import "server-only";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Database,
  KeyRound,
  Landmark,
  Mail,
  MessageCircle,
  ReceiptText,
} from "lucide-react";
import { requireAdmin } from "@/lib/access";
import { checkIntegration } from "@/lib/integration-actions";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui";
import styles from "./preferences-content.module.css";

export async function IntegrationsContent() {
  await requireAdmin();
  const integrations = [
    {
      name: "Neon",
      group: "Dados e acesso",
      icon: Database,
      status: "Conectado",
      detail: "Dados e sessões armazenados no PostgreSQL.",
    },
    {
      name: "Acesso ao Console",
      group: "Dados e acesso",
      icon: KeyRound,
      status: "Configurado",
      detail:
        "Códigos por e-mail ou WhatsApp, Google opcional e permissões por empresa.",
    },
    {
      name: "Resend",
      group: "Comunicação",
      icon: Mail,
      status: process.env.RESEND_API_KEY ? "Credencial recebida" : "Pendente",
      detail:
        "Códigos de acesso, avisos de chamados e e-mails de cobrança, com acompanhamento de entrega.",
    },
    {
      name: "Inter",
      group: "Financeiro e fiscal",
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
      group: "Financeiro e fiscal",
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
      group: "Comunicação",
      icon: MessageCircle,
      provider: "flw",
      status: process.env.FLW_SYNOVA ? "Token configurado" : "Pendente",
      detail:
        "Consulta de canais ativos. Cobranças proativas pelo WhatsApp dependem de modelo de mensagem aprovado. Login por código para números verificados em Minha conta.",
    },
  ];
  return (
    <div className={styles.content}>
      {["Dados e acesso", "Comunicação", "Financeiro e fiscal"].map((group) => (
        <section className={styles.section} key={group}>
          <div className={styles.sectionHeading}>
            <h2>{group}</h2>
          </div>
          <ul className={`${styles.card} ${styles.integrationList}`}>
            {integrations
              .filter((integration) => integration.group === group)
              .map((integration) => (
                <li key={integration.name} className={styles.integrationRow}>
                  <span className={styles.serviceIcon}>
                    <integration.icon size={18} aria-hidden="true" />
                  </span>
                  <div className={styles.rowContent}>
                    <h3>{integration.name}</h3>
                    <p>{integration.detail}</p>
                  </div>
                  <div className={styles.rowControls}>
                    <Badge
                      status={
                        integration.status === "Pendente" ? "pending" : ""
                      }
                    >
                      {integration.status}
                    </Badge>
                    {integration.provider && (
                      <ActionForm
                        action={checkIntegration}
                        label="Testar conexão"
                        submitAriaLabel={`Testar conexão com ${integration.name}`}
                        className={styles.integrationAction}
                      >
                        <input
                          type="hidden"
                          name="provider"
                          value={integration.provider}
                        />
                      </ActionForm>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <section className={`${styles.card} ${styles.linkSection}`}>
        <span className={styles.serviceIcon}>
          <Bell size={18} aria-hidden="true" />
        </span>
        <div className={styles.rowContent}>
          <h2>Avisos de chamados</h2>
          <p>Destinatários, tentativas e confirmações de entrega da equipe.</p>
        </div>
        <Link
          href="/configuracoes/notificacoes"
          replace
          scroll={false}
          className={styles.textLink}
        >
          Ver destinatário e envios
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Acesso e operação</h2>
        </div>
        <ul className={`${styles.card} ${styles.guidanceList}`}>
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
    </div>
  );
}
