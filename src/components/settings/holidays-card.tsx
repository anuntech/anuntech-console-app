"use client";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/console/page-header";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { saveHolidays } from "@/lib/service-terms/holiday-actions";
import type { LocalHolidays } from "@/lib/service-terms/business-calendar";

/** Feriados da sede: what the business-day count skips beyond the national holidays. */
export function HolidaysCard({ holidays }: { holidays: LocalHolidays }) {
  const lines = (holidays.dates ?? []).map((d) => `${d.date.slice(3, 5)}/${d.date.slice(0, 2)} ${d.name}`).join("\n");
  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Feriados da sede"
          description="Os prazos contam dias úteis sem os feriados nacionais e os da cidade da sede. Os nacionais e a Sexta-feira Santa já entram sozinhos."
        />
      </CardHeader>
      <ServerForm action={saveHolidays} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <FormField label="Cidade da sede" htmlFor="holidays-city">
            <Input id="holidays-city" name="city" maxLength={80} defaultValue={holidays.city ?? ""} placeholder="Ex.: Caieiras/SP" />
          </FormField>
          <FormField label="Feriados da cidade" htmlFor="holidays-dates" hint="Um por linha, como 25/01 Aniversário da cidade.">
            <Textarea id="holidays-dates" name="dates" rows={4} defaultValue={lines} />
          </FormField>
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox name="corpusChristi" value="on" defaultChecked={holidays.corpusChristi} />
              Corpus Christi é feriado na cidade
            </Label>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox name="carnival" value="on" defaultChecked={holidays.carnival} />
              A equipe não trabalha no Carnaval (segunda e terça)
            </Label>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <SubmitButton pendingLabel="Salvando…">Salvar feriados</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
