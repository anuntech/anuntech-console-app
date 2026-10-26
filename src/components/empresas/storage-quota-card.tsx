"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/console/page-header";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { setStorageQuota } from "@/lib/drive/drive-actions";
import { DEFAULT_COMPANY_QUOTA_BYTES } from "@/lib/drive/drive-rules";
import { fileSizeLabel } from "@/lib/format";

const GB = 1024 ** 3;

/** Staff: how much of its space in Arquivos the company uses, and the limit (5 GB unless changed). */
export function StorageQuotaCard({ companyId, used, quotaBytes }: { companyId: string; used: number; quotaBytes: number | null }) {
  const quota = quotaBytes ?? DEFAULT_COMPANY_QUOTA_BYTES;
  const share = Math.min(1, used / quota);
  return (
    <Card variant="quiet" className="gap-4 py-5">
      <CardHeader>
        <SectionTitle
          title="Espaço em Arquivos"
          description={`${used ? fileSizeLabel(used) : "0 KB"} de ${fileSizeLabel(quota)}${quotaBytes === null ? " (o padrão)" : ""}.`}
        />
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className={`h-full rounded-full ${share > 0.9 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${share * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <ServerForm action={setStorageQuota} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="companyId" value={companyId} />
          <FormError className="basis-full" />
          <FormField label="Limite em GB" htmlFor="storage-quota" hint="Vazio volta ao padrão de 5 GB." className="w-40">
            <Input id="storage-quota" name="quotaGb" type="number" inputMode="numeric" min={1} max={10000} step={1} defaultValue={quotaBytes === null ? "" : Math.round(quotaBytes / GB)} placeholder="5" />
          </FormField>
          <SubmitButton variant="outline" pendingLabel="Salvando…">
            Salvar limite
          </SubmitButton>
          <Link href={`/bookmarks?empresa=${companyId}`} className="ml-auto text-sm text-primary hover:underline">
            Ver arquivos
          </Link>
        </ServerForm>
      </CardContent>
    </Card>
  );
}
