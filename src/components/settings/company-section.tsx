import "server-only";
import { eq } from "drizzle-orm";
import { companies, environmentProfile } from "@/db/schema";
import { db } from "@/lib/db";
import { settingsEnvironment } from "@/lib/environment";
import { saveCompanySettings } from "@/lib/company-settings-actions";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { CompanyFields } from "@/components/empresas/company-form";

/** The same form clients get in Empresas, pointed at the viewer's own company
    (or, for Console staff, at Anuntech's issuer profile). */
export async function CompanySection() {
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
    <Card>
      <CardHeader>
        <SectionTitle
          title={companyId ? "Cadastro" : "Dados da Anuntech"}
          description={
            companyId
              ? "Razão social, contato financeiro e endereço usados nas cobranças."
              : "Emissor das cobranças e das notas."
          }
        />
      </CardHeader>
      <ServerForm action={saveCompanySettings} className="contents">
        <input type="hidden" name="id" value={companyId || "console"} />
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <CompanyFields
            company={{
              name: profile.name,
              document: profile.document,
              billingEmail: profile.billingEmail,
              phone: profile.phone,
              billingAddress: profile.billingAddress,
              autoIssueNfse: false,
            }}
            lookupEnabled={actor.admin}
            fiscalSettings={false}
          />
        </CardContent>
        <CardFooter className="justify-end border-t">
          <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
