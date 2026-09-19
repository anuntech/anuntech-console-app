import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingNotices, invoices, companies } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { Back, Heading, Empty } from "@/components/ui";
export default async function BillingDeliveries() {
  await requireAdmin();
  const rows = await db
    .select({
      notice: billingNotices,
      company: companies.name,
      description: invoices.description,
    })
    .from(billingNotices)
    .innerJoin(invoices, eq(invoices.id, billingNotices.invoiceId))
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .orderBy(desc(billingNotices.createdAt))
    .limit(200);
  const labels = {
    waiting: "Aguardando processamento",
    pending: "Pendente",
    sending: "Enviando",
    accepted: "Aguardando confirmação de entrega",
    delivered: "Entrega confirmada",
    failed: "Falha — revisar",
    uncertain: "Sem confirmação — revisar",
    expired: "Prazo de repetição encerrado",
    skipped: "Interrompido",
  };
  return (
    <>
      <Back href="/financeiro" label="Financeiro" />
      <Heading
        title="Envios de cobranças"
        description="Acompanhe a entrega das mensagens de cada fatura."
      />
      <p className="muted">
        O Console consulta os provedores automaticamente. Entrega de e-mail
        confirma o recebimento pelo servidor do destinatário; não comprova
        leitura ou chegada à caixa principal. Mensagens com falha precisam de
        revisão.
      </p>
      {!rows.length ? (
        <Empty
          title="Nenhum aviso enviado"
          description="As mensagens aparecem aqui após a publicação e emissão das cobranças."
        />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente / Fatura</th>
                  <th>Canal</th>
                  <th>Aviso</th>
                  <th>Entrega</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ notice: n, company, description }) => (
                  <tr key={n.id}>
                    <td>
                      <Link href={`/financeiro/${n.invoiceId}`}>{company}</Link>
                      <p className="muted">{description}</p>
                    </td>
                    <td>{n.channel === "email" ? "E-mail" : "WhatsApp"}</td>
                    <td>
                      {n.kind === "initial"
                        ? "Nova cobrança"
                        : n.kind === "due"
                          ? "Vence hoje"
                          : `${n.kind.replace("overdue_", "")} dias de atraso`}
                    </td>
                    <td>
                      <strong>{labels[n.status]}</strong>
                      {n.error && <p className="muted">{n.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {rows.length === 200 && (
        <p className="muted">Exibindo os 200 avisos mais recentes.</p>
      )}
    </>
  );
}
