import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MonitorSmartphoneIcon } from "lucide-react";
import { cn } from "cn";
import { auth } from "@/lib/auth/auth";
import { dateTimeLabel } from "@/lib/format";
import { recentSessions } from "@/lib/auth/session-history";
import { sessionDevice } from "@/lib/auth/session-device";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { TwoStepSettings } from "./two-step-settings";

const statusLabel: Record<string, string> = {
  current: "Esta sessão",
  active: "Ativa",
  expired: "Expirada",
  ended: "Encerrada",
};

export async function SecuritySection() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current?.user.emailVerified) redirect("/entrar");
  const entries = await recentSessions(current.user.id, current.session.id);
  return (
    <>
      <TwoStepSettings
        enabled={current.user.twoFactorEnabled === true}
        channel={current.user.twoStepChannel === "email" ? "email" : "whatsapp"}
        phone={current.user.phoneNumberVerified ? current.user.phoneNumber || null : null}
      />
      <Card>
        <CardHeader>
          <SectionTitle
            title="Sessões recentes"
            description="Onde sua conta esteve aberta. Sessões antigas expiram sozinhas."
          />
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-4 px-6 py-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <MonitorSmartphoneIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block text-sm font-medium text-foreground">
                    {sessionDevice(entry.userAgent)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Iniciada em {dateTimeLabel(entry.createdAt)}
                    {(entry.status === "active" || entry.status === "current") &&
                      ` · ativa até ${dateTimeLabel(entry.expiresAt)}`}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    entry.status === "current"
                      ? "bg-accent text-primary"
                      : entry.status === "active"
                        ? "bg-success-soft text-success"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {statusLabel[entry.status] ?? entry.status}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
