import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Monitor } from "lucide-react";
import { auth } from "@/lib/auth";
import { recentSessions } from "@/lib/session-history";
import { sessionDevice } from "@/lib/session-device";
import { SecuritySettings } from "@/components/security-settings";
import styles from "./personal-settings.module.css";
const date = (value: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
export async function SecurityContent() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current?.user.emailVerified) redirect("/entrar");
  const entries = await recentSessions(current.user.id, current.session.id);
  return <div className={styles.content}>
    <SecuritySettings enabled={current.user.twoFactorEnabled === true} channel={current.user.twoStepChannel === "email" ? "email" : "whatsapp"}
      email={current.user.email} phone={current.user.phoneNumberVerified ? current.user.phoneNumber || null : null} />
    <section aria-labelledby="recent-sessions-title">
      <h2 id="recent-sessions-title">Sessões recentes</h2>
      <ul className={styles.sessions}>
        {entries.map(entry => <li key={entry.id} className={styles.session} data-current={entry.status === "current" || undefined}>
          <Monitor size={20} aria-hidden="true" />
          <div><strong>{sessionDevice(entry.userAgent)}</strong>
            <p>Iniciada em {date(entry.createdAt)}</p>
            {entry.status === "active" || entry.status === "current" ? <p>Última atualização: {date(entry.updatedAt)}</p> : null}
          </div>
          <span>{entry.status === "current" ? "Esta sessão" : entry.status === "active" ? "Ativa" : entry.status === "expired" ? "Expirada" : "Encerrada"}</span>
        </li>)}
      </ul>
      <p className="muted">Últimas 20 sessões · Horário de Brasília.</p>
    </section>
  </div>;
}
