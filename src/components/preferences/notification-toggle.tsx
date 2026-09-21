"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "@/components/notifications";
import { useRouter } from "next/navigation";
import { setTicketNotifications } from "@/lib/notification-actions";
import styles from "./notifications-content.module.css";

export function NotificationToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, startTransition] = useTransition();
  const [change, setChange] = useState<{
    previous: boolean;
    value: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const current = change?.previous === enabled ? change.value : enabled;
  return (
    <div className={styles.control}>
      <div>
        <h2 id="ticket-notifications-label">Notificações de chamados</h2>
        <p role="status">
          {current ? "Ativadas" : "Desativadas"}
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={current}
        aria-labelledby="ticket-notifications-label"
        aria-busy={pending}
        disabled={pending}
        className={styles.switch}
        onClick={() => {
          if (lock.current) return;
          lock.current = true;
          const next = !current;
          setError("");
          startTransition(async () => {
            try {
              const form = new FormData();
              form.set("enabled", String(next));
              const result = await setTicketNotifications({}, form);
              if (result.error) setError(result.error);
              else {
                setChange({ previous: enabled, value: next });
                toast.success("Preferências de notificações atualizadas.");
                router.refresh();
              }
            } catch {
              setError("Não foi possível salvar. Tente novamente.");
            } finally {
              lock.current = false;
            }
          });
        }}
      >
        <span />
      </button>
    </div>
  );
}
