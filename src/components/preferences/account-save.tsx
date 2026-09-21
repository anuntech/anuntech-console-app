"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./account-fields.module.css";

/** Reuses each contact's verification flow, processing e-mail last because it ends the session. */
export function AccountSave({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const submitted = useRef<HTMLFormElement | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const advance = useRef<() => void>(() => {});
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const sync = () => {
      const forms = Array.from(
        container.querySelectorAll<HTMLFormElement>("form[data-account-order]"),
      ).sort(
        (a, b) =>
          Number(a.dataset.accountOrder) - Number(b.dataset.accountOrder),
      );
      const pending = forms.some(
        (form) => form.getAttribute("aria-busy") === "true",
      );
      const changed = forms.filter(
        (form) => form.dataset.accountChanged === "true",
      );
      setDirty(changed.length > 0);
      setBusy(pending);
      if (!running.current || pending) return;
      const previous = submitted.current;
      if (previous && previous.dataset.accountChanged === "true") {
        if (previous.dataset.accountAttention === "true") {
          running.current = false;
          setSaving(false);
        }
        return;
      }
      const next = changed[0];
      if (!next) {
        running.current = false;
        setSaving(false);
        setSaved(true);
        return;
      }
      if (!next.reportValidity()) {
        running.current = false;
        setSaving(false);
        return;
      }
      submitted.current = next;
      next.requestSubmit();
    };
    advance.current = sync;
    const observer = new MutationObserver(sync);
    observer.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-account-changed",
        "data-account-attention",
        "aria-busy",
      ],
    });
    sync();
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} onChange={() => setSaved(false)}>
      {children}
      <div className={`${styles.actions} ${styles.saveFooter}`}>
        <button
          type="button"
          className="button primary"
          disabled={!dirty || busy || saving}
          aria-live="polite"
          onClick={() => {
            const forms = root.current?.querySelectorAll<HTMLFormElement>(
              'form[data-account-changed="true"]',
            );
            if (
              forms &&
              Array.from(forms).some((form) => !form.reportValidity())
            )
              return;
            running.current = true;
            submitted.current = null;
            setSaved(false);
            setSaving(true);
            advance.current();
          }}
        >
          {busy || saving ? "Salvando…" : saved ? "Salvo ✓" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
