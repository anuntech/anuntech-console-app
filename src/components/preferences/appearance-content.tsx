"use client";
import { Sun, Moon, Monitor } from "lucide-react";
import { useAppearance } from "@/components/appearance-provider";
import { toast } from "@/components/notifications";
import type { Theme, DockPosition } from "@/lib/appearance";
import styles from "./personal-settings.module.css";
export function AppearanceContent() {
  const { theme, position, change } = useAppearance();
  function choose(nextTheme: Theme, nextPosition: DockPosition) {
    change(nextTheme, nextPosition);
    toast.success("Aparência atualizada.", { id: "appearance-saved" });
  }
  return (
    <div className={styles.content}>
      <div className={styles.appearanceCard}>
        <fieldset className={styles.group}>
          <legend className="sr-only">Tema</legend>
          <span className={styles.rowLabel} aria-hidden="true">
            Tema
          </span>
          <div className={styles.choices}>
            {(
              [
                { value: "light", label: "Claro", icon: Sun },
                { value: "dark", label: "Escuro", icon: Moon },
                { value: "system", label: "Sistema", icon: Monitor },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <label key={value} className={styles.choice}>
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => choose(value, position)}
                />
                <Icon size={24} aria-hidden="true" />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend className="sr-only">Posição do menu</legend>
          <span className={styles.rowLabel} aria-hidden="true">
            Posição do menu
          </span>
          <div className={styles.choices}>
            {(
              [
                { value: "bottom", label: "Embaixo" },
                { value: "top", label: "Em cima" },
                { value: "left", label: "À esquerda" },
                { value: "right", label: "À direita" },
              ] as const
            ).map(({ value, label }) => (
              <label key={value} className={styles.choice}>
                <input
                  type="radio"
                  name="dock-position"
                  value={value}
                  checked={position === value}
                  onChange={() => choose(theme, value)}
                />
                <span
                  className={styles.preview}
                  data-position={value}
                  aria-hidden="true"
                >
                  <span />
                </span>
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
