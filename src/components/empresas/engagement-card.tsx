import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/console/page-header";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { relativeLabel } from "@/lib/format";
import type { CompanyEngagement } from "@/lib/companies/company-engagement";

const WEEK = 7 * 86_400_000;
const n = (value: number) => (value ? value.toLocaleString("pt-BR") : "–");

/**
 * Engajamento: how the company's people use the Console, for the team only. The year as one
 * calendar, then one row per person with the last 30 days; who never came in is marked.
 */
export function EngagementCard({ data, now }: { data: CompanyEngagement; now: string }) {
  const { people, days } = data;
  if (!people.length) return null;
  const recent = people.filter((p) => p.lastUse && Date.parse(now) - Date.parse(p.lastUse) <= WEEK).length;
  const never = people.filter((p) => p.never).length;
  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Engajamento"
          description={`${recent} de ${people.length} ${people.length === 1 ? "pessoa usou" : "pessoas usaram"} o Console nos últimos 7 dias${
            never ? `; ${never === 1 ? "1 nunca entrou" : `${never} nunca entraram`}` : ""
          }. Só a equipe Anuntech vê.`}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ActivityHeatmap
          days={days}
          label="Interações das pessoas da empresa no Console nos últimos 12 meses"
          period="nos últimos 12 meses"
        />
        <div className="-mx-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Pessoa</TableHead>
                <TableHead>Último uso</TableHead>
                <TableHead className="text-right" title="Entradas no Console (login) nos últimos 30 dias">
                  Entradas
                </TableHead>
                <TableHead className="text-right" title="Apps e sistemas abertos pelo Console nos últimos 30 dias">
                  Apps abertos
                </TableHead>
                <TableHead className="text-right" title="Chamados abertos e mensagens nos últimos 30 dias">
                  Chamados
                </TableHead>
                <TableHead className="pr-6 text-right" title="Outras ações nos últimos 30 dias: contratos, orçamentos, arquivos, configurações">
                  Outras ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <TableRow key={person.email}>
                  <TableCell className="max-w-64 pl-6">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{person.name ?? person.email}</span>
                        {person.name && <span className="block truncate text-xs text-muted-foreground">{person.email}</span>}
                      </span>
                      {person.role === "manager" && (
                        <Badge variant="secondary" className="shrink-0">
                          Administrador
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {person.never ? (
                      <Badge variant="outline" className="border-warning-edge bg-warning-soft text-warning">
                        Nunca entrou
                      </Badge>
                    ) : person.lastUse ? (
                      <span title={new Date(person.lastUse).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}>
                        {relativeLabel(person.lastUse, now)}
                      </span>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{n(person.logins)}</TableCell>
                  <TableCell className="text-right tabular-nums">{n(person.apps)}</TableCell>
                  <TableCell className="text-right tabular-nums">{n(person.tickets + person.messages)}</TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{n(person.actions)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="m-0 text-xs text-muted-foreground">Números dos últimos 30 dias. Passe o mouse no título de cada coluna para ver o que ela conta.</p>
      </CardContent>
    </Card>
  );
}
