import { requireAdmin } from "@/lib/access";
import { ActionForm } from "@/components/action-form";
import { checkIntegration } from "@/lib/integration-actions";
import { Heading, Badge } from "@/components/ui";
import Link from "next/link";
export default async function Settings() {
  await requireAdmin();
  const integrations = [
    {
      name: "Neon",
      status: "Conectado",
      detail: "Dados e sessões armazenados no PostgreSQL.",
    },
    {
      name: "Acesso à Console",
      status: "Configurado",
      detail:
        "Códigos por e-mail ou WhatsApp, Google opcional e permissões por empresa.",
    },
    {
      name: "Resend",
      status: process.env.RESEND_API_KEY ? "Credencial recebida" : "Pendente",
      detail:
        "Envio manual de aviso de acesso, com registro da tentativa. Requer endereço público HTTPS.",
    },
    {
      name: "Inter",
      provider: "inter",
      status:
        process.env.INTER_CLIENT_ID && process.env.INTER_CERTIFICATE_BASE64
          ? "Configurado"
          : "Pendente",
      detail:
        "Emissão manual de boleto com Pix e consulta de pagamento. O teste abaixo verifica apenas autenticação.",
    },
    {
      name: "Focus NFe",
      provider: "focus",
      status: process.env.FOCUS_NFE_TOKEN_HOMOLOGATION
        ? "Tokens configurados"
        : "Pendente",
      detail:
        "Consulta de autenticação nos dois ambientes. Emissão aguarda cadastro e regras fiscais do serviço.",
    },
    {
      name: "WhatsApp / FLW",
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
        description="Acompanhe a preparação dos serviços da Console."
      />
      <div className="card-grid">
        <section className="panel padded">
          <h2>Avisos de chamados</h2>
          <p className="muted">
            Movimentações enviadas por e-mail e WhatsApp ao administrador da
            Anuntech. O WhatsApp exige modelo aprovado e número verificado.
          </p>
          <Link href="/configuracoes/notificacoes" className="button">
            Ver destinatário e envios
          </Link>
        </section>
        {integrations.map((i) => (
          <section key={i.name} className="panel padded">
            <div className="card-top">
              <h2>{i.name}</h2>
              <Badge>{i.status}</Badge>
            </div>
            <p className="muted">{i.detail}</p>
            {i.provider && (
              <ActionForm action={checkIntegration} label="Testar conexão">
                <input type="hidden" name="provider" value={i.provider} />
              </ActionForm>
            )}
          </section>
        ))}
      </div>
      <section className="panel padded section-gap">
        <h2>Regras desta versão</h2>
        <ul className="plain-list">
          <li>Cobranças criadas manualmente pela administração.</li>
          <li>
            Acesso liberado por e-mail, com permissão específica por empresa.
          </li>
          <li>
            Anexos privados no banco, limitados a 1 MB por arquivo e 20 por
            chamado.
          </li>
          <li>
            Códigos de acesso enviados sob solicitação. Cobranças e emissão
            fiscal não são automáticas.
          </li>
        </ul>
      </section>
    </>
  );
}
