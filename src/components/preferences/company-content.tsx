import "server-only";
import { asc, inArray } from "drizzle-orm";
import { companies, notificationPreferences } from "@/db/schema";
import {
  defaultCompanyPreferences,
  preferenceKey,
} from "@/lib/notification-preferences";
import { db } from "@/lib/db";
import { managedCompanyIds, requireMemberManager } from "@/lib/member-access";
import { saveCompanySettings } from "@/lib/company-settings-actions";
import { ActionForm } from "@/components/action-form";
import { CompanyBillingFields } from "@/components/company-billing-fields";
import { NotificationTopicForm } from "./notification-settings";
import { CompanySelector } from "./company-selector";
import styles from "./preferences-content.module.css";
export async function managedCompanies() {
  const actor = await requireMemberManager();
  const rows = await db
    .select()
    .from(companies)
    .where(
      actor.admin ? undefined : inArray(companies.id, managedCompanyIds(actor)),
    )
    .orderBy(asc(companies.name));
  return { actor, rows };
}
export async function CompanyContent() {
  const { actor, rows } = await managedCompanies();
  const saved = rows.length
    ? await db
        .select()
        .from(notificationPreferences)
        .where(
          inArray(
            notificationPreferences.companyId,
            rows.map((company) => company.id),
          ),
        )
    : [];
  const preferences = new Map(saved.map((row) => [row.key, row]));
  return (
    <CompanySelector
      companies={await Promise.all(
        rows.map(async (company) => ({
          id: company.id,
          name: company.name + (company.archived ? " (arquivada)" : ""),
          content: (
            <div className={styles.content}>
              <div className={`${styles.card} ${styles.deliveryCard}`}>
                <ActionForm
                  action={saveCompanySettings}
                  label="Salvar dados da empresa"
                >
                  <input type="hidden" name="id" value={company.id} />
                  <CompanyBillingFields
                    company={company}
                    fiscalSettings={false}
                    lookupEnabled={actor.admin}
                  />
                </ActionForm>
              </div>
              {await NotificationTopicForm({
                companyId: company.id,
                topic: "billing",
                preferences:
                  preferences.get(preferenceKey(company.id, "billing")) ||
                  defaultCompanyPreferences(company, "billing"),
                title: "Notificações financeiras",
                description:
                  "Faturas, vencimentos e lembretes de atraso. Estes contatos substituem os do cadastro para os avisos de cobrança.",
              })}
              {await NotificationTopicForm({
                companyId: company.id,
                topic: "tickets",
                preferences:
                  preferences.get(preferenceKey(company.id, "tickets")) ||
                  defaultCompanyPreferences(company, "tickets"),
                title: "Notificações de atendimento",
                description:
                  "Abertura, respostas e atualizações dos chamados. Ao ativar, você receberá as próximas movimentações desta empresa.",
              })}
              <p className={styles.groupNote}>
                WhatsApp depende do modelo aprovado. Alterar contatos não
                concede acesso ao Console.
              </p>
            </div>
          ),
        })),
      )}
    />
  );
}
