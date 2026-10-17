"use client";
import { useState } from "react";
import { PencilIcon, PlusIcon, ScaleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SectionTitle } from "@/components/console/page-header";
import { FormField, FormSection } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { ConfirmDialog } from "@/components/console/server-form";
import { dateLabel } from "@/lib/format";
import { deactivateServiceTerms, saveServiceTerms } from "@/lib/service-terms/terms-actions";
import { blankPolicy, presetPolicy, termsPresets } from "@/lib/service-terms/presets";
import { termsSummary } from "@/lib/service-terms/terms-text";
import type { ServicePolicy, TermsBasis } from "@/lib/service-terms/terms-model";

export type ServiceTermsItem = {
  id: string;
  label: string;
  basis: TermsBasis;
  preset: string;
  engagementId: string | null;
  contractId: string | null;
  policy: ServicePolicy;
  personClient: boolean;
  publishAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  version: number;
};

const basisLabels: Record<TermsBasis, string> = {
  console_contract: "Contrato no Console",
  external_contract: "Contrato fora do Console",
  none: "Sem contrato",
};

const h = (minutes?: number | null) => (minutes ? String(Math.round((minutes / 60) * 10) / 10).replace(".", ",") : "");
const plusDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <Label className="flex items-center gap-2 text-sm font-normal">
      <Checkbox name={name} value="on" defaultChecked={defaultChecked} />
      {label}
    </Label>
  );
}

/**
 * "Condições de atendimento": the team copies what a company's contract
 * promises and asks, clause by clause. Only verified conditions govern
 * tickets, and the client sees them from the publication date.
 */
export function ServiceTermsCard({
  companyId,
  items,
  engagements,
  contracts,
  now,
}: {
  companyId: string;
  items: ServiceTermsItem[];
  engagements: { id: string; name: string }[];
  contracts: { id: string; title: string }[];
  now: string;
}) {
  const [editing, setEditing] = useState<ServiceTermsItem | "new" | null>(null);
  const [removing, setRemoving] = useState<ServiceTermsItem | null>(null);
  const scope = (item: ServiceTermsItem) => engagements.find((e) => e.id === item.engagementId)?.name ?? "Toda a empresa";
  const status = (item: ServiceTermsItem) =>
    !item.verifiedAt
      ? "Rascunho, ainda não vale"
      : item.publishAt && new Date(item.publishAt) > new Date(now)
        ? `Valendo para a equipe; o cliente vê a partir de ${dateLabel(new Date(item.publishAt))}`
        : "Valendo e visível para o cliente";
  return (
    <Card className="gap-4 py-5">
      <CardHeader>
        <SectionTitle
          title="Condições de atendimento"
          description="Os prazos do contrato desta empresa, cláusula por cláusula."
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing("new")}>
              <PlusIcon />
              Adicionar
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium text-foreground">{item.label}</p>
                  <p className="m-0 text-xs text-muted-foreground">
                    {scope(item)} · {basisLabels[item.basis]} · versão {item.version}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${item.label}`} onClick={() => setEditing(item)}>
                  <PencilIcon />
                </Button>
              </div>
              {item.basis !== "none" && (
                <ul className="m-0 mt-2 flex list-disc flex-col gap-0.5 pl-4 text-xs text-foreground marker:text-muted-foreground">
                  {termsSummary({ termsId: item.id, version: item.version, label: item.label, preset: item.preset, policy: item.policy, publishAt: item.publishAt, personClient: item.personClient })
                    .promises.slice(0, 4)
                    .map((f) => (
                      <li key={f.text}>
                        {f.text}
                        {f.clause && <span className="text-muted-foreground"> ({f.clause})</span>}
                      </li>
                    ))}
                </ul>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className={item.verifiedAt ? "text-xs text-muted-foreground" : "text-xs font-medium text-warning"}>{status(item)}</span>
                <Button type="button" variant="link" size="sm" className="ml-auto h-auto p-0 text-xs text-muted-foreground" onClick={() => setRemoving(item)}>
                  Desativar
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="m-0 flex items-start gap-2 text-sm text-muted-foreground">
            <ScaleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Sem condições: os chamados desta empresa ficam sem prazo, e o cliente vê só o horário de atendimento.
          </p>
        )}
      </CardContent>
      <TermsSheet
        companyId={companyId}
        item={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        engagements={engagements}
        contracts={contracts}
      />
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          action={deactivateServiceTerms}
          fields={{ id: removing.id }}
          title="Desativar estas condições?"
          description={`"${removing.label}" deixa de valer para novos chamados. Os chamados já abertos mantêm os prazos que receberam.`}
          confirmLabel="Desativar"
          destructive
        />
      )}
    </Card>
  );
}

function TermsSheet({
  companyId,
  item,
  open,
  onClose,
  engagements,
  contracts,
}: {
  companyId: string;
  item: ServiceTermsItem | null;
  open: boolean;
  onClose: () => void;
  engagements: { id: string; name: string }[];
  contracts: { id: string; title: string }[];
}) {
  const [basis, setBasis] = useState<TermsBasis>(item?.basis ?? "console_contract");
  const [preset, setPreset] = useState(item?.preset ?? "support");
  const [shown, setShown] = useState(item);
  if (item !== shown) {
    setShown(item);
    setBasis(item?.basis ?? "console_contract");
    setPreset(item?.preset ?? "support");
  }
  // Values start from the item being edited, else from the chosen template's ficha.
  const p: ServicePolicy = item && item.preset === preset ? item.policy : (presetPolicy(preset) ?? blankPolicy());
  const label = item?.label ?? termsPresets.find((x) => x.key === preset)?.label ?? "";
  const c = p?.clauses ?? {};
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={item ? "Editar condições" : "Condições de atendimento"}
      description="Copie do contrato assinado. Cada valor leva a cláusula de onde veio."
      action={saveServiceTerms}
      onSuccess={onClose}
      formKey={`${item?.id ?? "new"}-${preset}-${basis}`}
      submitLabel="Salvar"
      pendingLabel="Salvando…"
    >
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Base" htmlFor="terms-basis">
          <NativeSelect id="terms-basis" name="basis" value={basis} onChange={(e) => setBasis(e.target.value as TermsBasis)}>
            {Object.entries(basisLabels).map(([value, text]) => (
              <NativeSelectOption key={value} value={value}>
                {text}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Modelo de contrato" htmlFor="terms-preset" hint="Preenche os valores do modelo; ajuste ao que foi assinado.">
          <NativeSelect id="terms-preset" name="preset" value={preset} onChange={(e) => setPreset(e.target.value)} disabled={basis === "none"}>
            {termsPresets.map((x) => (
              <NativeSelectOption key={x.key} value={x.key}>
                {x.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {basis === "none" && <input type="hidden" name="preset" value="custom" />}
        </FormField>
        <FormField label="Nome" htmlFor="terms-label">
          <Input id="terms-label" name="label" required maxLength={80} defaultValue={basis === "none" ? "Sem contrato" : label} />
        </FormField>
        <FormField label="Vale para" htmlFor="terms-scope">
          <NativeSelect id="terms-scope" name="engagementId" defaultValue={item?.engagementId ?? ""}>
            <NativeSelectOption value="">Toda a empresa</NativeSelectOption>
            {engagements.map((e) => (
              <NativeSelectOption key={e.id} value={e.id}>
                {e.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        {basis === "console_contract" && (
          <FormField label="Contrato" htmlFor="terms-contract" className="sm:col-span-2">
            <NativeSelect id="terms-contract" name="contractId" defaultValue={item?.contractId ?? ""}>
              <NativeSelectOption value="">Escolha o contrato assinado</NativeSelectOption>
              {contracts.map((x) => (
                <NativeSelectOption key={x.id} value={x.id}>
                  {x.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
        )}
      </div>

      {basis !== "none" && p && (
        <>
          <ResponseFields key={preset} policy={p} />

          <FormSection title="Espera e o que o cliente faz">
            <Check name="pausesWhileWaiting" label="O prazo para enquanto aguarda o cliente" defaultChecked={p.pausesWhileWaiting} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Cláusula da pausa" htmlFor="terms-pc">
                <Input id="terms-pc" name="pauseClause" maxLength={60} defaultValue={c.pausesWhileWaiting ?? ""} />
              </FormField>
              <FormField label="Cliente responde em (dias úteis)" htmlFor="terms-crd">
                <Input id="terms-crd" name="clientResponseDays" inputMode="numeric" defaultValue={p.clientResponseDays ?? ""} />
              </FormField>
              <FormField label="Cláusula" htmlFor="terms-crc">
                <Input id="terms-crc" name="clientResponseClause" maxLength={60} defaultValue={c.clientResponseDays ?? ""} />
              </FormField>
              <FormField label="Teste de entregas (dias úteis)" htmlFor="terms-td">
                <Input id="terms-td" name="testDays" inputMode="numeric" defaultValue={p.testDays ?? ""} />
              </FormField>
              <FormField label="Cláusula do teste" htmlFor="terms-tc">
                <Input id="terms-tc" name="testClause" maxLength={60} defaultValue={c.testDays ?? ""} />
              </FormField>
            </div>
            <Check name="tacitAcceptance" label="Silêncio ou uso em produção vale como aceite" defaultChecked={p.tacitAcceptance} />
          </FormSection>

          <FormSection title="Banco de horas e melhorias">
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Horas por mês" htmlFor="terms-bh" hint="Vazio: sem banco.">
                <Input id="terms-bh" name="bankHours" inputMode="decimal" defaultValue={h(p.hoursBank?.monthlyMinutes)} />
              </FormField>
              <FormField label="Aviso em (%)" htmlFor="terms-ba">
                <Input id="terms-ba" name="bankAlertPercent" inputMode="numeric" defaultValue={p.hoursBank?.alertPercent ?? 80} />
              </FormField>
              <FormField label="Hora excedente (R$)" htmlFor="terms-ov" hint="Vazio: não combinado.">
                <Input
                  id="terms-ov"
                  name="overage"
                  inputMode="decimal"
                  defaultValue={p.hoursBank?.overageCents ? (p.hoursBank.overageCents / 100).toFixed(2).replace(".", ",") : ""}
                />
              </FormField>
              <FormField label="Contestação (dias úteis)" htmlFor="terms-rcd">
                <Input id="terms-rcd" name="reportContestDays" inputMode="numeric" defaultValue={p.hoursBank?.reportContestDays ?? ""} />
              </FormField>
              <FormField label="Melhoria no banco até (horas)" htmlFor="terms-il">
                <Input id="terms-il" name="improvementBankLimit" inputMode="decimal" defaultValue={h(p.improvementBankLimitMinutes)} />
              </FormField>
              <FormField label="Garantia da melhoria (dias)" htmlFor="terms-iw">
                <Input id="terms-iw" name="improvementWarrantyDays" inputMode="numeric" defaultValue={p.improvementWarrantyDays ?? ""} />
              </FormField>
              <FormField label="Cláusula do banco" htmlFor="terms-bc">
                <Input id="terms-bc" name="bankClause" maxLength={60} defaultValue={c.hoursBank ?? ""} />
              </FormField>
            </div>
            <FormField label="Cláusula das melhorias" htmlFor="terms-ic">
              <Input id="terms-ic" name="improvementClause" maxLength={60} defaultValue={c.improvementBankLimitMinutes ?? ""} />
            </FormField>
            <Check name="includesDevelopment" label="Inclui ajustes e melhorias (suporte)" defaultChecked={p.includesDevelopment} />
          </FormSection>

          <FormSection title="Horário, garantia e suspensão">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Fora do horário" htmlFor="terms-ooh">
                <NativeSelect id="terms-ooh" name="outOfHours" defaultValue={p.outOfHours}>
                  <NativeSelectOption value="not_included">Não incluso</NativeSelectOption>
                  <NativeSelectOption value="if_contracted">Só se contratado</NativeSelectOption>
                  <NativeSelectOption value="unspecified">O contrato não fala</NativeSelectOption>
                </NativeSelect>
              </FormField>
              <FormField label="Cláusula" htmlFor="terms-oohc">
                <Input id="terms-oohc" name="outOfHoursClause" maxLength={60} defaultValue={c.outOfHours ?? ""} />
              </FormField>
              <FormField label="Garantia da entrega até" htmlFor="terms-wu">
                <Input id="terms-wu" name="warrantyUntil" type="date" defaultValue={p.warrantyUntil ?? ""} />
              </FormField>
              <FormField label="Suspensão após (dias de atraso)" htmlFor="terms-sd">
                <Input id="terms-sd" name="suspensionDays" inputMode="numeric" defaultValue={p.suspensionDays ?? ""} />
              </FormField>
              <FormField label="Cláusula da suspensão" htmlFor="terms-sc">
                <Input id="terms-sc" name="suspensionClause" maxLength={60} defaultValue={c.suspension ?? ""} />
              </FormField>
            </div>
            <Check name="suspensionNotice" label="Suspende só depois de um aviso" defaultChecked={!!p.suspensionNotice} />
          </FormSection>
        </>
      )}

      <FormSection title="Publicação">
        <Check name="personClient" label="Cliente é pessoa física (oculta as regras de silêncio)" defaultChecked={item?.personClient} />
        <FormField label="O cliente vê a partir de" htmlFor="terms-publish" hint="A equipe vê antes, para organizar a fila.">
          <Input id="terms-publish" name="publishAt" type="date" defaultValue={item?.publishAt?.slice(0, 10) ?? plusDays(7)} />
        </FormField>
        <Check name="verified" label="Conferi cada valor com o contrato assinado" defaultChecked={!!item?.verifiedAt} />
      </FormSection>
    </FormSheet>
  );
}

/** First response and goal per level; the levels switch shows or hides the Crítica and Alta rows. */
function ResponseFields({ policy }: { policy: ServicePolicy }) {
  const [levels, setLevels] = useState(policy.levels);
  const r = policy.response;
  const rows = levels ? (["critical", "high", "normal"] as const) : (["normal"] as const);
  const names = { critical: "Crítica", high: "Alta", normal: levels ? "Normal" : "Todos os chamados" };
  return (
    <FormSection title="Resposta, em horas úteis (1 dia útil = 9 horas úteis)">
      <Label className="flex items-center gap-2 text-sm font-normal">
        <Checkbox name="levels" value="on" checked={levels} onCheckedChange={(v) => setLevels(v === true)} />
        O contrato tem níveis de prioridade (Crítica, Alta, Normal)
      </Label>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((level) => (
          <div key={level} className="contents">
            <FormField label={`${names[level]}: primeira resposta`} htmlFor={`terms-${level}-r`}>
              <Input id={`terms-${level}-r`} name={`${level}Response`} inputMode="decimal" defaultValue={h(r[level]?.firstResponseMinutes)} />
            </FormField>
            <FormField label="Meta de solução" htmlFor={`terms-${level}-g`}>
              <Input id={`terms-${level}-g`} name={`${level}Goal`} inputMode="decimal" defaultValue={h(r[level]?.goalMinutes)} placeholder="Sem meta" />
            </FormField>
          </div>
        ))}
        {!levels && (
          <FormField label="Serviço todo fora do ar" htmlFor="terms-outage">
            <Input id="terms-outage" name="outageResponse" inputMode="decimal" defaultValue={h(policy.outageFirstResponseMinutes)} placeholder="Igual" />
          </FormField>
        )}
      </div>
      <FormField label="Cláusula" htmlFor="terms-rc">
        <Input id="terms-rc" name="responseClause" maxLength={60} defaultValue={policy.clauses.response ?? ""} placeholder="Ex.: SUP 6.1" />
      </FormField>
    </FormSection>
  );
}
