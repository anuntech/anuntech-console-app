import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheck,
  Clock3,
  Info,
  Mail,
  MessageCircle,
  Send,
  TriangleAlert,
} from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingNotices, invoices, companies } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { Back, Heading, Empty } from "@/components/ui";
import styles from "../finance.module.css";
export const metadata: Metadata = {
  title: "Envios de cobranças",
  description:
    "Acompanhe a entrega dos avisos de cobrança por e-mail e WhatsApp.",
};

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
      <div className={styles.overview} aria-label="Resumo dos avisos listados">
        {[
          {
            label: "Avisos listados",
            value: rows.length,
            icon: Send,
            tone: "",
          },
          {
            label: "Entrega confirmada",
            value: rows.filter(({ notice }) => notice.status === "delivered")
              .length,
            icon: CircleCheck,
            tone: styles.success,
          },
          {
            label: "Em andamento",
            value: rows.filter(({ notice }) =>
              ["waiting", "pending", "sending", "accepted"].includes(
                notice.status,
              ),
            ).length,
            icon: Clock3,
            tone: "",
          },
          {
            label: "Precisam de revisão",
            value: rows.filter(({ notice }) =>
              ["failed", "uncertain", "expired"].includes(notice.status),
            ).length,
            icon: TriangleAlert,
            tone: styles.warning,
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div className={styles.metric} key={label}>
            <div>
              <span className={styles.metricLabel}>{label}</span>
              <strong>{value}</strong>
              <small>Entre os 200 mais recentes</small>
            </div>
            <span className={`${styles.icon} ${tone}`}>
              <Icon size={18} aria-hidden="true" />
            </span>
          </div>
        ))}
      </div>
      <div className={styles.note}>
        <Info size={17} aria-hidden="true" />
        <p>
          O Console consulta os provedores automaticamente. Entrega de e-mail
          confirma o recebimento pelo servidor do destinatário; não comprova
          leitura ou chegada à caixa principal. Mensagens com falha precisam de
          revisão.
        </p>
      </div>
      <div className={styles.draftSection}>
        {!rows.length ? (
          <Empty
            title="Nenhum aviso enviado"
            description="As mensagens aparecem aqui após a publicação e emissão das cobranças."
          />
        ) : (
          <section className="panel">
            <div className={styles.tableHead}>
              <h2>Histórico de envios</h2>
              <span>E-mail e WhatsApp</span>
            </div>
            <div
              className="table-wrap"
              role="region"
              aria-label="Tabela de envios de cobranças"
              tabIndex={0}
            >
              <table className={styles.deliveryTable}>
                <caption className="sr-only">
                  Histórico de avisos e entrega das cobranças
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Cliente / Fatura</th>
                    <th scope="col">Canal</th>
                    <th scope="col">Aviso</th>
                    <th scope="col">Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ notice: n, company, description }) => (
                    <tr key={n.id}>
                      <td>
                        <Link
                          href={`/financeiro/${n.invoiceId}`}
                          aria-label={`${company} — fatura de ${description}`}
                        >
                          {company}
                        </Link>
                        <p className="muted">{description}</p>
                      </td>
                      <td>
                        <span className={styles.channel}>
                          {n.channel === "email" ? (
                            <Mail size={15} aria-hidden="true" />
                          ) : (
                            <MessageCircle size={15} aria-hidden="true" />
                          )}
                          {n.channel === "email" ? "E-mail" : "WhatsApp"}
                        </span>
                      </td>
                      <td>
                        {n.kind === "initial"
                          ? "Nova cobrança"
                          : n.kind === "due"
                            ? "Vence hoje"
                            : `${n.kind.replace("overdue_", "")} dias de atraso`}
                        <p className="muted">
                          {n.createdAt.toLocaleString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </td>
                      <td>
                        <span
                          className={styles.noticeBadge}
                          data-status={n.status}
                        >
                          {labels[n.status]}
                        </span>
                        {n.error && <p className="muted">{n.error}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {rows.length === 200 && (
        <p className="muted">Exibindo os 200 avisos mais recentes.</p>
      )}
    </>
  );
}
