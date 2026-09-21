"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./members-content.module.css";

export function MemberTabs({
  members,
  invited,
  memberCount,
  invitedCount,
  action,
}: {
  action?: ReactNode;
  members: ReactNode;
  invited: ReactNode;
  memberCount: number;
  invitedCount: number;
}) {
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div>
      <div className={styles.toolbar}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Pessoas do ambiente"
        >
          {[`Membros (${memberCount})`, `Convidados (${invitedCount})`].map(
            (label, index) => (
              <button
                key={index}
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${index}`}
                aria-controls={`${id}-panel-${index}`}
                aria-selected={active === index}
                tabIndex={active === index ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 1
                        : 1 - index;
                  setActive(next);
                  buttons.current[next]?.focus();
                }}
              >
                {label}
              </button>
            ),
          )}
        </div>
        {action}
      </div>
      {[members, invited].map((content, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={active !== index}
          tabIndex={0}
        >
          {content}
        </div>
      ))}
    </div>
  );
}
