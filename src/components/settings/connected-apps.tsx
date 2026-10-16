"use client";
import { LaptopIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ConfirmAction } from "@/components/console/server-form";
import { dateTimeLabel } from "@/lib/format";
import { disconnectMeetingApp } from "@/lib/meetings/meeting-actions";

export type ConnectedApp = { id: string; device: string | null; connectedAt: string | null; lastUsedAt: string | null };

/** The Macs where the meeting-notes app is connected to this account, each with its own "Desconectar". */
export function ConnectedApps({ apps }: { apps: ConnectedApp[] }) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Apps conectados"
          description="O app Anuntech Reuniões salva notas de reunião nos seus Bookmarks a partir destes Macs."
        />
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          {apps.map((app) => (
            <li key={app.id} className="flex flex-wrap items-center gap-4 px-6 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <LaptopIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 basis-48">
                <span className="block truncate text-sm font-medium text-foreground">
                  {app.device || "Mac"} · Anuntech Reuniões
                </span>
                <span className="block text-xs text-muted-foreground">
                  {app.connectedAt ? `Conectado em ${dateTimeLabel(app.connectedAt)}` : "Conectado"}
                  {app.lastUsedAt && ` · usado por último em ${dateTimeLabel(app.lastUsedAt)}`}
                </span>
              </span>
              <ConfirmAction
                action={disconnectMeetingApp}
                fields={{ id: app.id }}
                title="Desconectar este Mac?"
                description="O app para de salvar notas na sua conta. As notas que já estão nos Bookmarks continuam lá, e as do Mac também."
                confirmLabel="Desconectar"
                destructive
              >
                <Button variant="outline" size="sm">
                  Desconectar
                </Button>
              </ConfirmAction>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
