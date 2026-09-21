import "server-only";
import { eq } from "drizzle-orm";
import { companies, environmentProfile } from "@/db/schema";
import { db } from "@/lib/db";
import { settingsEnvironment } from "@/lib/environment";
import { saveCompanySettings } from "@/lib/company-settings-actions";
import { ActionForm } from "@/components/action-form";
import { CompanyBillingFields } from "@/components/company-billing-fields";
import styles from "./preferences-content.module.css";

export async function CompanyContent() {
  const { actor, companyId } = await settingsEnvironment();
  const [company] = companyId
    ? await db.select().from(companies).where(eq(companies.id, companyId))
    : await db
        .select()
        .from(environmentProfile)
        .where(eq(environmentProfile.id, "console"));
  const profile = company || {
    name: "Anuntech",
    document: process.env.FOCUS_NFE_ISSUER_CNPJ || "",
    billingEmail: process.env.CONSOLE_ADMIN_EMAIL || "",
    phone: "",
    billingAddress: null,
  };
  return (
    <div className={styles.content}>
      <div className={`${styles.card} ${styles.deliveryCard}`}>
        <ActionForm
          action={saveCompanySettings}
          label="Salvar dados da empresa"
        >
          <input type="hidden" name="id" value={companyId || "console"} />
          <CompanyBillingFields
            company={{ ...profile, autoIssueNfse: false }}
            environmentSettings
            fiscalSettings={false}
            lookupEnabled={actor.admin}
          />
        </ActionForm>
      </div>
    </div>
  );
}
