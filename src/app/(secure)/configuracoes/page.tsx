import { requireAdmin } from "@/lib/access";
import { Heading, Badge } from "@/components/ui";
export default async function Settings() {
  await requireAdmin();
  const integrations = [
    {
      name: "Neon",
      status: "Conectado",
      detail: "Dados e sessões armazenados no PostgreSQL.",
    },
    {
      name: "Google + Better Auth",
      status: "Configurado",
      detail: "Acesso com Google e permissões por empresa.",
    },
    {
      name: "Resend",
      status: process.env.RESEND_API_KEY ? "Credencial recebida" : "Pendente",
      detail:
        "Envio manual de aviso de acesso, com registro da tentativa. Requer endereço público HTTPS.",
    },
    {
      name: "Inter",
      status: "Pendente",
      detail:
        "Aguardando credenciais, certificado e validação da API. Nenhuma cobrança real é emitida.",
    },
    {
      name: "Focus NFe",
      status: "Pendente",
      detail: "Aguardando token, cadastro do emitente e regras fiscais.",
    },
    {
      name: "WhatsApp / FLW",
      status: "Pendente",
      detail: "Aguardando documentação e configuração do fornecedor.",
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
        {integrations.map((i) => (
          <section key={i.name} className="panel padded">
            <div className="card-top">
              <h2>{i.name}</h2>
              <Badge>{i.status}</Badge>
            </div>
            <p className="muted">{i.detail}</p>
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
          <li>Nenhum envio automático de mensagem ou emissão fiscal.</li>
        </ul>
      </section>
    </>
  );
}
