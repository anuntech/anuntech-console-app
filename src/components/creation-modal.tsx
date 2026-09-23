"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./legacy-ui/dialog";
import pattern from "./legacy-ui/form-pattern.module.css";
import styles from "./creation-modal.module.css";
const subscribe = () => () => {};
const BusyContext = createContext<((busy: boolean) => void) | null>(null);
export const useCreationBusy = () => useContext(BusyContext);
export function CreationModal({
  children,
  title,
  description,
  path,
  fallback,
  intercepted = false,
  plain = false,
}: {
  children: ReactNode;
  title: string;
  description: string;
  path: string;
  fallback: string;
  intercepted?: boolean;
  /** For forms that already render their own section cards. */
  plain?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const setBusy = useCallback((value: boolean) => {
    busy.current = value;
    setPending(value);
  }, []);
  if (pathname !== path) return null;
  const body = (
    <BusyContext.Provider value={setBusy}>
      <div
        className={`${pattern.surface} ${pattern.rows} ${plain ? "" : pattern.card} ${pattern.creation}`}
      >
        {children}
      </div>
    </BusyContext.Provider>
  );
  if (!hydrated)
    return (
      <section>
        <h1>{title}</h1>
        {body}
      </section>
    );
  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open, details) => {
        if (!open) {
          if (busy.current) details.cancel();
          else if (intercepted) router.back();
          else router.replace(fallback);
        }
      }}
    >
      <DialogContent className={styles.modal} busy={pending}>
        <header className={styles.header}>
          <DialogTitle className={styles.title}>{title}</DialogTitle>
          <DialogDescription className={styles.description}>
            {description}
          </DialogDescription>
        </header>
        {body}
      </DialogContent>
    </Dialog>
  );
}
